import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { 
  createRun, 
  updateRunStatus, 
  updateRunStats,
  saveEscalas,
  saveEventos,
  saveConflictAlerts,
  saveFolgaAlerts,
  saveDeslocamentoAlerts,
  saveInterjornadaAlerts,
  saveViagens,
  saveQualityIssues,
  getRunsByUser,
  getRunById,
  getDb
} from "./db";
import { storagePut } from "./storage";
import { parseExcelFile, processAtividades, processEventos, mergeEscalasWithEventos } from "./etl";
import { detectConflicts, detectFolgaViolations, detectDeslocamentoRisks, detectInterjornadaViolations, detectViagens, detectQualityIssues } from "./rules";
import { runs, escalas, alertasConflito, alertasFolga, alertasDeslocamento, alertasInterjornada, viagens, grades, analiseGrades, excecoesProfissionais } from "../drizzle/schema";
import { eq, desc, and, sql, not, inArray } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

function parseLLMResponse(content: string | null | undefined, schemaName: string): any {
  if (!content) return {};
  const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  const rawJSON = jsonMatch ? jsonMatch[0] : content;
  
  // Basic cleanup for common LLM hallucinations like trailing commas
  const cleanedJSON = rawJSON.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');

  try {
    let result = JSON.parse(cleanedJSON);
    if (result[schemaName]) return result[schemaName];
    if (Object.keys(result).length === 1 && typeof Object.values(result)[0] === "object" && !Array.isArray(Object.values(result)[0])) {
      return Object.values(result)[0];
    }
    return result;
  } catch (e) {
    console.error("[LLM Parser Error] Failed to parse JSON:", e, "Raw Content:", content);
    return {};
  }
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(() => {
      return { success: true } as const;
    }),
  }),

  uploads: router({
    /**
     * Upload files to S3 and create a run
     */
    uploadFiles: protectedProcedure
      .input(z.object({
        file2468: z.object({
          name: z.string(),
          data: z.string(), // base64 encoded
        }),
        file2020: z.object({
          name: z.string(),
          data: z.string(), // base64 encoded
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;

        // Decode base64 files
        const file2468Buffer = Buffer.from(input.file2468.data, 'base64');
        const file2020Buffer = Buffer.from(input.file2020.data, 'base64');

        // Upload to S3
        const timestamp = Date.now();
        const file2468Key = `runs/${userId}/${timestamp}-2468-${input.file2468.name}`;
        const file2020Key = `runs/${userId}/${timestamp}-2020-${input.file2020.name}`;

        const { url: file2468Url } = await storagePut(file2468Key, file2468Buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const { url: file2020Url } = await storagePut(file2020Key, file2020Buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // Create run record
        const runId = await createRun(userId, file2468Key, file2020Key, file2468Url, file2020Url);

        return {
          runId,
          file2468Url,
          file2020Url,
        };
      }),

    /**
     * Process uploaded files
     */
    processRun: protectedProcedure
      .input(z.object({
        runId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { runId } = input;
        const run = await getRunById(runId);

        if (!run) {
          throw new Error("Run not found");
        }

        if (run.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        try {
          await updateRunStatus(runId, "processing");

          // Fetch files from S3 URLs
          const [file2468Response, file2020Response] = await Promise.all([
            fetch(run.file2468Url!),
            fetch(run.file2020Url!),
          ]);

          const file2468Buffer = Buffer.from(await file2468Response.arrayBuffer());
          const file2020Buffer = Buffer.from(await file2020Response.arrayBuffer());

          // Parse Excel files
          const raw2468 = parseExcelFile(file2468Buffer);
          const raw2020 = parseExcelFile(file2020Buffer);

          // Process data
          const processedAtividades = processAtividades(raw2468);
          const processedEventos = processEventos(raw2020);

          // Merge with eventos
          const mergedEscalas = mergeEscalasWithEventos(processedAtividades, processedEventos);

          // Save escalas to database and get IDs
          const escalaIds = await saveEscalas(runId, mergedEscalas);

          // Add IDs to escalas for rule processing
          const escalasWithIds = mergedEscalas.map((escala, index) => ({
            ...escala,
            id: escalaIds[index],
          }));

          // Save eventos
          const eventosArray = Array.from(processedEventos.values());
          await saveEventos(runId, eventosArray);

          // Detect conflicts and violations
          const conflicts = detectConflicts(escalasWithIds);
          const folgaViolations = detectFolgaViolations(escalasWithIds);
          const deslocamentoRisks = detectDeslocamentoRisks(escalasWithIds, 3); // 3 hours minimum gap
          const interjornadaViolations = detectInterjornadaViolations(escalasWithIds, 11); // 11 hours minimum rest
          const viagensDetected = detectViagens(escalasWithIds);
          const qualityIssues = detectQualityIssues(mergedEscalas);

          // Save alerts
          await saveConflictAlerts(runId, conflicts);
          await saveFolgaAlerts(runId, folgaViolations);
          await saveDeslocamentoAlerts(runId, deslocamentoRisks);
          await saveInterjornadaAlerts(runId, interjornadaViolations);
          await saveViagens(runId, viagensDetected);
          await saveQualityIssues(runId, qualityIssues);

          // Update run stats
          await updateRunStats(runId, {
            totalEscalas: mergedEscalas.length,
            totalEventos: eventosArray.length,
            totalConflitos: conflicts.length,
            totalViolacoesFolga: folgaViolations.length,
            totalRiscosDeslocamento: deslocamentoRisks.length,
            totalInterjornada: interjornadaViolations.length,
            totalViagens: viagensDetected.length,
          });

          await updateRunStatus(runId, "completed");

          return {
            success: true,
            stats: {
              totalEscalas: mergedEscalas.length,
              totalEventos: eventosArray.length,
              totalConflitos: conflicts.length,
              totalViolacoesFolga: folgaViolations.length,
              totalRiscosDeslocamento: deslocamentoRisks.length,
              totalInterjornada: interjornadaViolations.length,
              totalViagens: viagensDetected.length,
            },
          };
        } catch (error) {
          await updateRunStatus(runId, "failed", error instanceof Error ? error.message : "Unknown error");
          throw error;
        }
      }),
  }),

  runs: router({
    /**
     * List all runs for current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getRunsByUser(ctx.user.id);
    }),

    /**
     * Get run by ID
     */
    getById: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }
        return run;
      }),
  }),

  dashboard: router({
    /**
     * Get dashboard statistics for a run
     */
    getStats: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get total hours
        const hoursResult = await db
          .select({ total: sql<number>`SUM(${escalas.duracaoHoras})` })
          .from(escalas)
          .where(and(eq(escalas.runId, input.runId), eq(escalas.ehFolga, false)));

        const totalHorasAtividades = Number(hoursResult[0]?.total || 0);

        // Calculate % of WOs without associated event
        const totalWOsResult = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${escalas.wo})` })
          .from(escalas)
          .where(and(
            eq(escalas.runId, input.runId),
            sql`${escalas.wo} IS NOT NULL`,
            sql`${escalas.wo} != ''`
          ));

        const totalWOs = Number(totalWOsResult[0]?.count || 0);

        // WOs sem elenco alocado (sem pessoa)
        const wosSemElencoResult = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${escalas.wo})` })
          .from(escalas)
          .where(and(
            eq(escalas.runId, input.runId),
            sql`${escalas.wo} IS NOT NULL`,
            sql`${escalas.wo} != ''`,
            sql`(${escalas.pessoa} IS NULL OR ${escalas.pessoa} = '')`
          ));

        const wosSemElenco = Number(wosSemElencoResult[0]?.count || 0);
        const percentualWOsSemElenco = totalWOs > 0 ? (wosSemElenco / totalWOs) * 100 : 0;

        return {
          totalEscalas: run.totalEscalas || 0,
          totalEventos: run.totalEventos || 0,
          totalConflitos: run.totalConflitos || 0,
          totalViolacoesFolga: run.totalViolacoesFolga || 0,
          totalRiscosDeslocamento: run.totalRiscosDeslocamento || 0,
          totalInterjornada: run.totalInterjornada || 0,
          totalViagens: run.totalViagens || 0,
          totalHorasAtividades,
          totalWOs,
          wosSemElenco,
          percentualWOsSemElenco,
        };
      }),

    /**
     * Get details for WOs without allocated cast
     */
    getWOsSemElenco: protectedProcedure
      .input(z.object({ 
        runId: z.number(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const results = await db.select()
          .from(escalas)
          .where(and(
            eq(escalas.runId, input.runId),
            sql`${escalas.wo} IS NOT NULL`,
            sql`${escalas.wo} != ''`,
            sql`(${escalas.pessoa} IS NULL OR ${escalas.pessoa} = '')`
          ))
          .orderBy(desc(escalas.data))
          .limit(input.limit)
          .offset(input.offset);

        return results;
      }),

    /**
     * Get weekly trends for a run
     */
    getWeeklyTrends: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get conflicts by week
        const conflictsByWeek = await db
          .select({
            semana: escalas.semanaIso,
            count: sql<number>`COUNT(*)`,
          })
          .from(alertasConflito)
          .innerJoin(escalas, eq(alertasConflito.escalaId1, escalas.id))
          .where(eq(alertasConflito.runId, input.runId))
          .groupBy(escalas.semanaIso)
          .orderBy(escalas.semanaIso);

        // Get hours by week
        const hoursByWeek = await db
          .select({
            semana: escalas.semanaIso,
            horas: sql<number>`SUM(${escalas.duracaoHoras})`,
          })
          .from(escalas)
          .where(and(eq(escalas.runId, input.runId), eq(escalas.ehFolga, false)))
          .groupBy(escalas.semanaIso)
          .orderBy(escalas.semanaIso);

        return {
          conflictsByWeek: conflictsByWeek.map(r => ({ semana: r.semana, count: Number(r.count) })),
          hoursByWeek: hoursByWeek.map(r => ({ semana: r.semana, horas: Number(r.horas) })),
        };
      }),

    /**
     * Get top 10 people with most conflicts
     */
    getTopConflicts: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db
          .select({
            pessoa: alertasConflito.pessoa,
            count: sql<number>`COUNT(*)`,
          })
          .from(alertasConflito)
          .where(eq(alertasConflito.runId, input.runId))
          .groupBy(alertasConflito.pessoa)
          .orderBy(desc(sql`COUNT(*)`))
          .limit(10);

        return result.map(r => ({ pessoa: r.pessoa, count: Number(r.count) }));
      }),

    /**
     * Get top 10 people with most folga violations
     */
    getTopFolgaViolations: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db
          .select({
            pessoa: alertasFolga.pessoa,
            count: sql<number>`COUNT(*)`,
          })
          .from(alertasFolga)
          .where(eq(alertasFolga.runId, input.runId))
          .groupBy(alertasFolga.pessoa)
          .orderBy(desc(sql`COUNT(*)`))
          .limit(10);

        return result.map(r => ({ pessoa: r.pessoa, count: Number(r.count) }));
      }),

    /**
     * Get top 10 people with most deslocamento risks
     */
    getTopDeslocamentoRisks: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db
          .select({
            pessoa: alertasDeslocamento.pessoa,
            count: sql<number>`COUNT(*)`,
          })
          .from(alertasDeslocamento)
          .where(eq(alertasDeslocamento.runId, input.runId))
          .groupBy(alertasDeslocamento.pessoa)
          .orderBy(desc(sql`COUNT(*)`))
          .limit(10);

        return result.map(r => ({ pessoa: r.pessoa, count: Number(r.count) }));
      }),
  }),

  alerts: router({
    /**
     * Get conflict alerts with filters
     */
    getConflicts: protectedProcedure
      .input(z.object({
        runId: z.number(),
        pessoa: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        canal: z.string().optional(),
        funcao: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const conditions = [eq(alertasConflito.runId, input.runId)];
        
        if (input.pessoa) {
          conditions.push(eq(alertasConflito.pessoa, input.pessoa));
        }
        if (input.dataInicio) {
          conditions.push(sql`${alertasConflito.data} >= ${input.dataInicio}`);
        }
        if (input.dataFim) {
          conditions.push(sql`${alertasConflito.data} <= ${input.dataFim}`);
        }

        // If canal or funcao filters are provided, we need to join with escalas
        if (input.canal || input.funcao) {
          const escalaConditions = [];
          if (input.canal) escalaConditions.push(eq(escalas.canal, input.canal));
          if (input.funcao) escalaConditions.push(eq(escalas.funcao, input.funcao));

          const results = await db.select({
            id: alertasConflito.id,
            runId: alertasConflito.runId,
            pessoa: alertasConflito.pessoa,
            data: alertasConflito.data,
            escalaId1: alertasConflito.escalaId1,
            escalaId2: alertasConflito.escalaId2,
            inicio1: alertasConflito.inicio1,
            fim1: alertasConflito.fim1,
            inicio2: alertasConflito.inicio2,
            fim2: alertasConflito.fim2,
            overlapMinutos: alertasConflito.overlapMinutos,
            evento1: alertasConflito.evento1,
            evento2: alertasConflito.evento2,
            cidade1: alertasConflito.cidade1,
            cidade2: alertasConflito.cidade2,
            createdAt: alertasConflito.createdAt,
          })
          .from(alertasConflito)
          .innerJoin(escalas, eq(alertasConflito.escalaId1, escalas.id))
          .where(and(...conditions, ...escalaConditions))
          .limit(input.limit)
          .offset(input.offset);
          return results;
        }

        const results = await db.select().from(alertasConflito)
          .where(and(...conditions))
          .limit(input.limit)
          .offset(input.offset);
        return results;
      }),

    /**
     * Get folga violation alerts with filters
     */
    getFolgaViolations: protectedProcedure
      .input(z.object({
        runId: z.number(),
        pessoa: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        canal: z.string().optional(),
        funcao: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const conditions = [eq(alertasFolga.runId, input.runId)];
        
        if (input.pessoa) {
          conditions.push(eq(alertasFolga.pessoa, input.pessoa));
        }
        if (input.dataInicio) {
          conditions.push(sql`${alertasFolga.data} >= ${input.dataInicio}`);
        }
        if (input.dataFim) {
          conditions.push(sql`${alertasFolga.data} <= ${input.dataFim}`);
        }

        // If canal or funcao filters are provided, join with escalas
        if (input.canal || input.funcao) {
          const escalaConditions = [];
          if (input.canal) escalaConditions.push(eq(escalas.canal, input.canal));
          if (input.funcao) escalaConditions.push(eq(escalas.funcao, input.funcao));

          const results = await db.select({
            id: alertasFolga.id,
            runId: alertasFolga.runId,
            pessoa: alertasFolga.pessoa,
            data: alertasFolga.data,
            tipoFolga: alertasFolga.tipoFolga,
            escalaIdFolga: alertasFolga.escalaIdFolga,
            escalaIdConflitante: alertasFolga.escalaIdConflitante,
            duracaoHoras: alertasFolga.duracaoHoras,
            status: alertasFolga.status,
            eventoPrograma: alertasFolga.eventoPrograma,
            createdAt: alertasFolga.createdAt,
          })
          .from(alertasFolga)
          .innerJoin(escalas, eq(alertasFolga.escalaIdConflitante, escalas.id))
          .where(and(...conditions, ...escalaConditions))
          .limit(input.limit)
          .offset(input.offset);
          return results;
        }

        const results = await db.select().from(alertasFolga)
          .where(and(...conditions))
          .limit(input.limit)
          .offset(input.offset);
        return results;
      }),

    /**
     * Get deslocamento risk alerts with filters
     */
    getDeslocamentoRisks: protectedProcedure
      .input(z.object({
        runId: z.number(),
        pessoa: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        canal: z.string().optional(),
        funcao: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const conditions = [eq(alertasDeslocamento.runId, input.runId)];
        
        if (input.pessoa) {
          conditions.push(eq(alertasDeslocamento.pessoa, input.pessoa));
        }
        if (input.dataInicio) {
          conditions.push(sql`${alertasDeslocamento.dataPrev} >= ${input.dataInicio}`);
        }
        if (input.dataFim) {
          conditions.push(sql`${alertasDeslocamento.dataPrev} <= ${input.dataFim}`);
        }

        // If canal or funcao filters are provided, join with escalas
        if (input.canal || input.funcao) {
          const escalaConditions = [];
          if (input.canal) escalaConditions.push(eq(escalas.canal, input.canal));
          if (input.funcao) escalaConditions.push(eq(escalas.funcao, input.funcao));

          const results = await db.select({
            id: alertasDeslocamento.id,
            runId: alertasDeslocamento.runId,
            pessoa: alertasDeslocamento.pessoa,
            escalaIdPrev: alertasDeslocamento.escalaIdPrev,
            escalaIdNext: alertasDeslocamento.escalaIdNext,
            dataPrev: alertasDeslocamento.dataPrev,
            dataNext: alertasDeslocamento.dataNext,
            cidadePrev: alertasDeslocamento.cidadePrev,
            cidadeNext: alertasDeslocamento.cidadeNext,
            fimPrev: alertasDeslocamento.fimPrev,
            inicioNext: alertasDeslocamento.inicioNext,
            gapHoras: alertasDeslocamento.gapHoras,
            gapMinimo: alertasDeslocamento.gapMinimo,
            status: alertasDeslocamento.status,
            createdAt: alertasDeslocamento.createdAt,
          })
          .from(alertasDeslocamento)
          .innerJoin(escalas, eq(alertasDeslocamento.escalaIdPrev, escalas.id))
          .where(and(...conditions, ...escalaConditions))
          .limit(input.limit)
          .offset(input.offset);
          return results;
        }

        const results = await db.select().from(alertasDeslocamento)
          .where(and(...conditions))
          .limit(input.limit)
          .offset(input.offset);
        return results;
      }),

    /**
     * Get interjornada violation alerts with filters
     */
    getInterjornadaViolations: protectedProcedure
      .input(z.object({
        runId: z.number(),
        pessoa: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        canal: z.string().optional(),
        funcao: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const conditions = [eq(alertasInterjornada.runId, input.runId)];
        
        if (input.pessoa) {
          conditions.push(eq(alertasInterjornada.pessoa, input.pessoa));
        }
        if (input.dataInicio) {
          conditions.push(sql`${alertasInterjornada.dataPrev} >= ${input.dataInicio}`);
        }
        if (input.dataFim) {
          conditions.push(sql`${alertasInterjornada.dataPrev} <= ${input.dataFim}`);
        }

        // If canal or funcao filters are provided, join with escalas
        if (input.canal || input.funcao) {
          const escalaConditions = [];
          if (input.canal) escalaConditions.push(eq(escalas.canal, input.canal));
          if (input.funcao) escalaConditions.push(eq(escalas.funcao, input.funcao));

          const results = await db.select({
            id: alertasInterjornada.id,
            runId: alertasInterjornada.runId,
            pessoa: alertasInterjornada.pessoa,
            escalaIdPrev: alertasInterjornada.escalaIdPrev,
            escalaIdNext: alertasInterjornada.escalaIdNext,
            dataPrev: alertasInterjornada.dataPrev,
            dataNext: alertasInterjornada.dataNext,
            fimPrev: alertasInterjornada.fimPrev,
            inicioNext: alertasInterjornada.inicioNext,
            descansoHoras: alertasInterjornada.descansoHoras,
            descansoMinimo: alertasInterjornada.descansoMinimo,
            eventoPrev: alertasInterjornada.eventoPrev,
            eventoNext: alertasInterjornada.eventoNext,
            status: alertasInterjornada.status,
            createdAt: alertasInterjornada.createdAt,
          })
          .from(alertasInterjornada)
          .innerJoin(escalas, eq(alertasInterjornada.escalaIdPrev, escalas.id))
          .where(and(...conditions, ...escalaConditions))
          .limit(input.limit)
          .offset(input.offset);
          return results;
        }

        const results = await db.select().from(alertasInterjornada)
          .where(and(...conditions))
          .limit(input.limit)
          .offset(input.offset);
        return results;
      }),

    /**
     * Get AI ML substitution suggestion for a specific conflict
     */
    getAISuggestion: protectedProcedure
      .input(z.object({
        alertaId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Obter o alerta
        const alertas = await db.select().from(alertasConflito).where(eq(alertasConflito.id, input.alertaId)).limit(1);
        if (alertas.length === 0) throw new Error("Alerta de conflito não encontrado");
        
        const alerta = alertas[0];
        
        // Obter as escalas conflitantes
        const esc1 = (await db.select().from(escalas).where(eq(escalas.id, alerta.escalaId1)).limit(1))[0];
        const esc2 = (await db.select().from(escalas).where(eq(escalas.id, alerta.escalaId2)).limit(1))[0];
        
        const funcaoAProcurar = esc1?.funcao || esc2?.funcao;
        
        if (!funcaoAProcurar) {
          throw new Error("Não foi possível identificar a função/cargo para substituição.");
        }

        // Listar todas as pessoas com a mesma função na run atual, para achar substitutos
        const pessoasComMesmaFuncaoQuery = await db.select({ pessoa: escalas.pessoa })
          .from(escalas)
          .where(and(eq(escalas.runId, alerta.runId), eq(escalas.funcao, funcaoAProcurar), eq(escalas.ehFolga, false)))
          .groupBy(escalas.pessoa);
          
        const possiveisSubstitutos = pessoasComMesmaFuncaoQuery.map(p => p.pessoa).filter(p => p !== alerta.pessoa);

        // Remover da lista quem já tem escala cruzando o mesmo horário de esc1 e esc2
        const startTime = alerta.inicio1 < alerta.inicio2 ? alerta.inicio1 : alerta.inicio2;
        const endTime = alerta.fim1 > alerta.fim2 ? alerta.fim1 : alerta.fim2;

        const indisponiveis = await db.select({ pessoa: escalas.pessoa }).from(escalas).where(and(
          eq(escalas.runId, alerta.runId),
          inArray(escalas.pessoa, possiveisSubstitutos.length > 0 ? possiveisSubstitutos : ['']),
          sql`${escalas.inicioDt} < ${endTime}`,
          sql`${escalas.fimDt} > ${startTime}`
        )).groupBy(escalas.pessoa);
        
        const setIndisponiveis = new Set(indisponiveis.map(i => i.pessoa));
        const disponiveis = possiveisSubstitutos.filter(p => !setIndisponiveis.has(p));

        if (disponiveis.length === 0) {
          return {
            status: "NoAvailableCandidates",
            suggestions: [],
            message: "Não há profissionais com a mesma função disponíveis neste horário na base de dados.",
          };
        }

        // Criar o contexto para o LLM
        const promptContext = `
Você é um AI Manager de planejamento de escala (Capacity Planning e Escalas).
Há um conflito de horário para a pessoa: ${alerta.pessoa}.
Função: ${funcaoAProcurar}.
Evento 1: ${alerta.evento1} (Canal: ${esc1?.canal}, Local: ${esc1?.cidade})
Evento 2: ${alerta.evento2} (Canal: ${esc2?.canal}, Local: ${esc2?.cidade})
Horário total do conflito: de ${startTime.toLocaleString()} até ${endTime.toLocaleString()}.

Aqui estão os nomes dos profissionais da mesma função que ESTÃO LIVRES neste horário:
${disponiveis.join(", ")}

Sua tarefa é agir como o "Modelo de ML de Resolução de Conflitos".
Formule a resposta EXATAMENTE no formato JSON requisitado, recomendando os 3 melhores nomes (ou menos, se houver menos) para substituir o profissional no Evento 1 ou no Evento 2 (decida o que for mais lógico). 
Para cada escolhido, dê uma justificativa simulando que você analisou: "Disponibilidade, Nível/Função, Carga atual estimada e Histórico".
`;

        const response = await invokeLLM({
          messages: [{ role: "user", content: promptContext }],
          outputSchema: {
            name: "SuggestedSubstitutions",
            schema: {
              type: "object",
              properties: {
                eventoAlvo: { type: "string", description: "O evento sugerido para realizar a substituição (Evento 1 ou Evento 2)" },
                sugestoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string" },
                      explicacaoML: { type: "string", description: "Explicação gerada pelo modelo envolvendo carga atual, histórico, etc." },
                      scoreModelo: { type: "number", description: "Um score de 0 a 100 de compatibilidade" }
                    },
                    required: ["nome", "explicacaoML", "scoreModelo"]
                  }
                }
              },
              required: ["eventoAlvo", "sugestoes"]
            }
          }
        });

        const content = response.choices[0].message.content as string;
        const mlOutputRaw = parseLLMResponse(content, "SuggestedSubstitutions");
        
        // Função Recursiva à prova de falhas: busca qualquer array de candidatos não importando o nome que a IA inventou
        function extrairCandidatosRec(obj: any): any[] | null {
          if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') return obj;
          if (obj && typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
              if (key === 'sugestoes' && Array.isArray(obj[key]) && obj[key].length === 0) continue;
              const found = extrairCandidatosRec(obj[key]);
              if (found) return found;
            }
          }
          return null;
        }

        // Função Recursiva para buscar a ação do evento
        function extrairAcaoRec(obj: any): string | null {
          const chavesAlvo = ["acao_proposta", "acao", "evento_afetado", "decisao_logica", "eventoAlvo"];
          if (obj && typeof obj === 'object') {
            for (const k of chavesAlvo) { if (obj[k] && typeof obj[k] === 'string' && obj[k] !== "Recomendação Genérica") return obj[k]; }
            for (const key of Object.keys(obj)) {
              if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                const found = extrairAcaoRec(obj[key]);
                if (found) return found;
              }
            }
          }
          return null;
        }

        const rawSugestoes = extrairCandidatosRec(mlOutputRaw) || [];

        const sugestoes = rawSugestoes.map((s: any) => ({
          nome: s.nome || s.name || s.candidato || "Recomendado",
          scoreModelo: s.scoreModelo || s.score_modelo || s.score || 95,
          explicacaoML: s.explicacaoML || s.explicacao_ml || s.justificativa || s.explicacao || JSON.stringify(s)
        }));

        const eventoAlvo = extrairAcaoRec(mlOutputRaw) || "Recomendação Analisada pela IA";

        const mlOutput = { ...mlOutputRaw, sugestoes, eventoAlvo };
        return {
          status: "Success",
          data: mlOutput,
        };
      }),
  }),

  profile: router({
    /**
     * Get person profile with stats
     */
    getPersonProfile: protectedProcedure
      .input(z.object({
        runId: z.number(),
        pessoa: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get total hours and activities
        const hoursResult = await db
          .select({ 
            total: sql<number>`SUM(${escalas.duracaoHoras})`,
            count: sql<number>`COUNT(*)`,
          })
          .from(escalas)
          .where(and(
            eq(escalas.runId, input.runId),
            eq(escalas.pessoa, input.pessoa),
            eq(escalas.ehFolga, false)
          ));

        // Get alert counts
        const conflitosCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertasConflito)
          .where(and(
            eq(alertasConflito.runId, input.runId),
            eq(alertasConflito.pessoa, input.pessoa)
          ));

        const folgaCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertasFolga)
          .where(and(
            eq(alertasFolga.runId, input.runId),
            eq(alertasFolga.pessoa, input.pessoa)
          ));

        const deslocamentoCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertasDeslocamento)
          .where(and(
            eq(alertasDeslocamento.runId, input.runId),
            eq(alertasDeslocamento.pessoa, input.pessoa)
          ));

        const interjornadaCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertasInterjornada)
          .where(and(
            eq(alertasInterjornada.runId, input.runId),
            eq(alertasInterjornada.pessoa, input.pessoa)
          ));

        const viagensCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(viagens)
          .where(and(
            eq(viagens.runId, input.runId),
            eq(viagens.pessoa, input.pessoa)
          ));

        // Calculate utilization: get date range from escalas
        const dateRangeResult = await db
          .select({
            minDate: sql<Date>`MIN(${escalas.data})`,
            maxDate: sql<Date>`MAX(${escalas.data})`,
          })
          .from(escalas)
          .where(and(
            eq(escalas.runId, input.runId),
            eq(escalas.pessoa, input.pessoa)
          ));

        const minDate = dateRangeResult[0]?.minDate;
        const maxDate = dateRangeResult[0]?.maxDate;
        
        let horasDisponiveis = 0;
        let percentualUtilizacao = 0;
        
        if (minDate && maxDate) {
          // Calculate business days between min and max date
          const start = new Date(minDate);
          const end = new Date(maxDate);
          let businessDays = 0;
          
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            // Skip weekends (0 = Sunday, 6 = Saturday)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              businessDays++;
            }
          }
          
          // Assume 8 hours per business day as available hours
          horasDisponiveis = businessDays * 8;
          const totalHoras = Number(hoursResult[0]?.total || 0);
          percentualUtilizacao = horasDisponiveis > 0 
            ? Math.round((totalHoras / horasDisponiveis) * 100) 
            : 0;
        }

        return {
          pessoa: input.pessoa,
          totalHoras: Number(hoursResult[0]?.total || 0),
          totalAtividades: Number(hoursResult[0]?.count || 0),
          totalConflitos: Number(conflitosCount[0]?.count || 0),
          totalViolacoesFolga: Number(folgaCount[0]?.count || 0),
          totalRiscosDeslocamento: Number(deslocamentoCount[0]?.count || 0),
          totalInterjornada: Number(interjornadaCount[0]?.count || 0),
          totalViagens: Number(viagensCount[0]?.count || 0),
          horasDisponiveis,
          percentualUtilizacao,
        };
      }),

    /**
     * Get person activity timeline
     */
    getPersonActivities: protectedProcedure
      .input(z.object({
        runId: z.number(),
        pessoa: z.string(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const results = await db.select().from(escalas)
          .where(and(
            eq(escalas.runId, input.runId),
            eq(escalas.pessoa, input.pessoa)
          ))
          .orderBy(desc(escalas.inicioDt))
          .limit(input.limit)
          .offset(input.offset);

        return results;
      }),
  }),

  grades: router({
    /**
     * Upload grade file and create grade record
     */
    uploadGrade: protectedProcedure
      .input(z.object({
        nome: z.string(),
        file: z.object({
          name: z.string(),
          data: z.string(), // base64
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const fileBuffer = Buffer.from(input.file.data, 'base64');

        // Upload to S3
        const timestamp = Date.now();
        const fileKey = `grades/${userId}/${timestamp}-${input.file.name}`;
        const { url: fileUrl } = await storagePut(fileKey, fileBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // Parse grade to get date range
        const { parseGradeExcel } = await import('./grades');
        const eventos = parseGradeExcel(fileBuffer);
        
        let dataInicio: Date | null = null;
        let dataFim: Date | null = null;
        if (eventos.length > 0) {
          const datas = eventos.map(e => e.data.getTime());
          dataInicio = new Date(Math.min(...datas));
          dataFim = new Date(Math.max(...datas));
        }

        // Create grade record
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(grades).values({
          userId,
          nome: input.nome,
          fileKey,
          fileUrl,
          dataInicio,
          dataFim,
          totalEventos: eventos.length,
        });

        return {
          gradeId: Number(result[0].insertId),
          totalEventos: eventos.length,
          dataInicio,
          dataFim,
        };
      }),

    /**
     * Analyze grade coverage with optional run data for folgas
     */
    analyzeGrade: protectedProcedure
      .input(z.object({
        gradeId: z.number(),
        runId: z.number().optional(),
        funcao: z.string().default('Narrador'),
        profissionais: z.array(z.string()),
        excecoes: z.array(z.object({
          pessoa: z.string(),
          tipo: z.string(),
          dataInicio: z.string(), // ISO date
          dataFim: z.string(), // ISO date
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get grade
        const grade = await db.select().from(grades).where(eq(grades.id, input.gradeId)).limit(1);
        if (!grade[0] || grade[0].userId !== ctx.user.id) {
          throw new Error("Grade not found");
        }

        // Fetch grade file from S3
        const gradeFileResponse = await fetch(grade[0].fileUrl!);
        const gradeFileBuffer = Buffer.from(await gradeFileResponse.arrayBuffer());

        // Parse grade
        const { parseGradeExcel, calcularSuficienciaCobertura } = await import('./grades');
        const eventos = parseGradeExcel(gradeFileBuffer);

        // Get folgas from run if provided
        let folgas: Array<{ pessoa: string; data: Date; tipoFolga: string }> = [];
        if (input.runId) {
          const run = await getRunById(input.runId);
          if (!run || run.userId !== ctx.user.id) {
            throw new Error("Run not found");
          }

          // Get folgas from escalas
          const folgasData = await db.select({
            pessoa: escalas.pessoa,
            data: escalas.data,
            tipoFolga: escalas.tipoItem,
          }).from(escalas)
            .where(and(
              eq(escalas.runId, input.runId),
              eq(escalas.ehFolga, true)
            ));

          folgas = folgasData.map(f => ({
            pessoa: f.pessoa,
            data: f.data,
            tipoFolga: f.tipoFolga || 'Day Off',
          }));
        }

        // Parse exceptions
        const excecoes = (input.excecoes || []).map(e => ({
          pessoa: e.pessoa,
          tipo: e.tipo,
          dataInicio: new Date(e.dataInicio),
          dataFim: new Date(e.dataFim),
        }));

        // Calculate coverage
        const analise = calcularSuficienciaCobertura(
          eventos,
          input.funcao,
          input.profissionais,
          folgas,
          excecoes
        );

        // Save analysis result
        await db.insert(analiseGrades).values({
          gradeId: input.gradeId,
          runId: input.runId || null,
          funcao: input.funcao,
          totalEventos: analise.totalEventos,
          eventosSemCobertura: analise.eventosSemCobertura,
          eventosComCobertura: analise.eventosComCobertura,
          totalProfissionais: analise.totalProfissionais,
          profissionaisDisponiveis: analise.profissionaisDisponiveis,
          profissionaisEmFolga: analise.profissionaisEmFolga,
          profissionaisEmExcecao: analise.profissionaisEmExcecao,
          resultado: analise.resultado,
          recomendacoes: analise.recomendacoes.join('\n'),
          detalhes: JSON.stringify(analise.detalhes),
        });

        // Save exceptions
        if (excecoes.length > 0) {
          await db.insert(excecoesProfissionais).values(
            excecoes.map(e => ({
              gradeId: input.gradeId,
              pessoa: e.pessoa,
              tipo: e.tipo,
              dataInicio: e.dataInicio,
              dataFim: e.dataFim,
              observacoes: null,
            }))
          );
        }

        return analise;
      }),

    /**
     * List grades for current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return await db.select().from(grades)
        .where(eq(grades.userId, ctx.user.id))
        .orderBy(desc(grades.createdAt));
    }),

    /**
     * Get grade analysis results
     */
    getAnalysis: protectedProcedure
      .input(z.object({ gradeId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Verify ownership
        const grade = await db.select().from(grades).where(eq(grades.id, input.gradeId)).limit(1);
        if (!grade[0] || grade[0].userId !== ctx.user.id) {
          throw new Error("Grade not found");
        }

        const results = await db.select().from(analiseGrades)
          .where(eq(analiseGrades.gradeId, input.gradeId))
          .orderBy(desc(analiseGrades.createdAt));

        return results.map(r => ({
          ...r,
          detalhes: r.detalhes ? JSON.parse(r.detalhes as string) : [],
        }));
      }),

    /**
     * Simulate removing a professional from the team
     */
    simulateRemoval: protectedProcedure
      .input(z.object({
        gradeId: z.number(),
        runId: z.number().optional(),
        funcao: z.string().default('Narrador'),
        profissionais: z.array(z.string()),
        excecoes: z.array(z.object({
          pessoa: z.string(),
          tipo: z.string(),
          dataInicio: z.string(),
          dataFim: z.string(),
        })).optional(),
        pessoaRemover: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get grade
        const grade = await db.select().from(grades).where(eq(grades.id, input.gradeId)).limit(1);
        if (!grade[0] || grade[0].userId !== ctx.user.id) {
          throw new Error("Grade not found");
        }

        // Fetch grade file from S3
        const gradeFileResponse = await fetch(grade[0].fileUrl!);
        const gradeFileBuffer = Buffer.from(await gradeFileResponse.arrayBuffer());

        // Parse grade
        const { parseGradeExcel, simularRemocaoProfissional } = await import('./grades');
        const eventos = parseGradeExcel(gradeFileBuffer);

        // Get folgas from run if provided
        let folgas: Array<{ pessoa: string; data: Date; tipoFolga: string }> = [];
        if (input.runId) {
          const run = await getRunById(input.runId);
          if (!run || run.userId !== ctx.user.id) {
            throw new Error("Run not found");
          }

          const folgasData = await db.select({
            pessoa: escalas.pessoa,
            data: escalas.data,
            tipoFolga: escalas.tipoItem,
          }).from(escalas)
            .where(and(
              eq(escalas.runId, input.runId),
              eq(escalas.ehFolga, true)
            ));

          folgas = folgasData.map(f => ({
            pessoa: f.pessoa,
            data: f.data,
            tipoFolga: f.tipoFolga || 'Day Off',
          }));
        }

        // Parse exceptions
        const excecoes = (input.excecoes || []).map(e => ({
          pessoa: e.pessoa,
          tipo: e.tipo,
          dataInicio: new Date(e.dataInicio),
          dataFim: new Date(e.dataFim),
        }));

        // Run simulation
        const simulacao = simularRemocaoProfissional(
          eventos,
          input.funcao,
          input.profissionais,
          folgas,
          excecoes,
          input.pessoaRemover
        );

        return simulacao;
      }),
  }),

  history: router({
    /**
     * Get all runs with statistics for history view
     */
    getAllRuns: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const allRuns = await db
          .select()
          .from(runs)
          .where(eq(runs.userId, ctx.user.id))
          .orderBy(desc(runs.createdAt))
          .limit(input.limit);

        return allRuns;
      }),

    /**
     * Get KPI evolution over time (all runs)
     */
    getKpiEvolution: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const allRuns = await db
          .select()
          .from(runs)
          .where(eq(runs.userId, ctx.user.id))
          .orderBy(runs.createdAt);

        return allRuns.map(run => ({
          runId: run.id,
          data: run.createdAt,
          horasAtividades: run.totalHorasAtividades || 0,
          totalEventos: run.totalEventos || 0,
          totalAtividades: run.totalAtividades || 0,
          alertasConflito: run.totalConflitos || 0,
          alertasFolga: run.totalViolacoesFolga || 0,
          alertasDeslocamento: run.totalRiscosDeslocamento || 0,
          alertasInterjornada: run.totalInterjornada || 0,
          totalViagens: run.totalViagens || 0,
          percentualWOsSemEvento: run.percentualWOsSemEvento || 0,
        }));
      }),

    /**
     * Get aggregated statistics across all runs
     */
    getAggregatedStats: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db
          .select({
            totalRuns: sql<number>`COUNT(*)`,
            totalHorasAtividades: sql<number>`SUM(${runs.totalHorasAtividades})`,
            totalEventos: sql<number>`SUM(${runs.totalEventos})`,
            totalAtividades: sql<number>`SUM(${runs.totalAtividades})`,
            totalConflitos: sql<number>`SUM(${runs.totalConflitos})`,
            totalViolacoesFolga: sql<number>`SUM(${runs.totalViolacoesFolga})`,
            totalRiscosDeslocamento: sql<number>`SUM(${runs.totalRiscosDeslocamento})`,
            totalInterjornada: sql<number>`SUM(${runs.totalInterjornada})`,
            totalViagens: sql<number>`SUM(${runs.totalViagens})`,
            avgPercentualWOsSemEvento: sql<number>`AVG(${runs.percentualWOsSemEvento})`,
          })
          .from(runs)
          .where(eq(runs.userId, ctx.user.id));

        return {
          totalRuns: Number(result[0]?.totalRuns || 0),
          totalHorasAtividades: Number(result[0]?.totalHorasAtividades || 0),
          totalEventos: Number(result[0]?.totalEventos || 0),
          totalAtividades: Number(result[0]?.totalAtividades || 0),
          totalConflitos: Number(result[0]?.totalConflitos || 0),
          totalViolacoesFolga: Number(result[0]?.totalViolacoesFolga || 0),
          totalRiscosDeslocamento: Number(result[0]?.totalRiscosDeslocamento || 0),
          totalInterjornada: Number(result[0]?.totalInterjornada || 0),
          totalViagens: Number(result[0]?.totalViagens || 0),
          avgPercentualWOsSemEvento: Number(result[0]?.avgPercentualWOsSemEvento || 0),
        };
      }),
  }),

  /**
   * Analytics router for advanced analysis features
   */
  analytics: router({
    /**
     * Get heatmap data: utilization by day of week per person
     */
    getHeatmapData: protectedProcedure
      .input(z.object({
        runId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get all escalas for the run (or latest run if not specified)
        let targetRunId = input.runId;
        if (!targetRunId) {
          const latestRun = await db
            .select({ id: runs.id })
            .from(runs)
            .where(eq(runs.userId, ctx.user.id))
            .orderBy(desc(runs.createdAt))
            .limit(1);
          targetRunId = latestRun[0]?.id;
        }

        if (!targetRunId) {
          return { heatmapData: [], insights: { picos: [], subutilizacao: [], sobrecarregados: [] } };
        }

        const atividades = await db
          .select()
          .from(escalas)
          .where(eq(escalas.runId, targetRunId));

        // Calculate utilization by person and day of week
        const utilizationMap = new Map<string, Map<number, number>>(); // pessoa -> dayOfWeek -> hours

        for (const ativ of atividades) {
          if (!ativ.pessoa || !ativ.data) continue;
          const date = new Date(ativ.data);
          const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
          const hours = parseFloat(ativ.duracaoHoras?.toString() || "0");

          if (!utilizationMap.has(ativ.pessoa)) {
            utilizationMap.set(ativ.pessoa, new Map());
          }
          const personMap = utilizationMap.get(ativ.pessoa)!;
          personMap.set(dayOfWeek, (personMap.get(dayOfWeek) || 0) + hours);
        }

        // Convert to array format and calculate percentages (assuming 8h workday)
        const heatmapData = [];
        for (const [pessoa, dayMap] of Array.from(utilizationMap.entries())) {
          const weekData = {
            pessoa,
            sunday: Math.round(((dayMap.get(0) || 0) / 8) * 100),
            monday: Math.round(((dayMap.get(1) || 0) / 8) * 100),
            tuesday: Math.round(((dayMap.get(2) || 0) / 8) * 100),
            wednesday: Math.round(((dayMap.get(3) || 0) / 8) * 100),
            thursday: Math.round(((dayMap.get(4) || 0) / 8) * 100),
            friday: Math.round(((dayMap.get(5) || 0) / 8) * 100),
            saturday: Math.round(((dayMap.get(6) || 0) / 8) * 100),
            avgUtilization: Math.round(
              (Array.from(dayMap.values()).reduce((a: number, b: number) => a + b, 0) / 7 / 8) * 100
            ),
          };
          heatmapData.push(weekData);
        }

        // Generate insights
        const picos: Array<{ pessoa: string; dia: string; utilizacao: number }> = [];
        const subutilizacao: Array<{ pessoa: string; dia: string; utilizacao: number }> = [];
        const sobrecarregados: Array<{ pessoa: string; utilizacaoMedia: number }> = [];

        for (const data of heatmapData) {
          // Identify peaks (days > 80%)
          const days = [data.sunday, data.monday, data.tuesday, data.wednesday, data.thursday, data.friday, data.saturday];
          const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
          days.forEach((util, idx) => {
            if (util > 80) {
              picos.push({ pessoa: data.pessoa, dia: dayNames[idx], utilizacao: util });
            }
            if (util < 40 && util > 0) {
              subutilizacao.push({ pessoa: data.pessoa, dia: dayNames[idx], utilizacao: util });
            }
          });

          // Chronically overloaded (avg > 85%)
          if (data.avgUtilization > 85) {
            sobrecarregados.push({ pessoa: data.pessoa, utilizacaoMedia: data.avgUtilization });
          }
        }

        return {
          heatmapData: heatmapData.sort((a, b) => b.avgUtilization - a.avgUtilization),
          insights: { picos, subutilizacao, sobrecarregados },
        };
      }),

    /**
     * Get trend analysis for a specific person
     */
    getTrendAnalysis: protectedProcedure
      .input(z.object({
        runId: z.number().optional(),
        pessoa: z.string(),
        weeksToPredict: z.number().default(6),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get target run
        let targetRunId = input.runId;
        if (!targetRunId) {
          const latestRun = await db
            .select({ id: runs.id })
            .from(runs)
            .where(eq(runs.userId, ctx.user.id))
            .orderBy(desc(runs.createdAt))
            .limit(1);

          if (!latestRun[0]) {
            throw new Error("No runs found");
          }
          targetRunId = latestRun[0].id;
        }

        // Verify ownership
        const run = await getRunById(targetRunId);
        if (!run || run.userId !== ctx.user.id) {
          throw new Error("Run not found");
        }

        // Get escalas for this person
        const escalasRaw = await db
          .select({
            data: escalas.data,
            duracaoHoras: escalas.duracaoHoras,
            ehFolga: escalas.ehFolga,
          })
          .from(escalas)
          .where(and(
            eq(escalas.runId, targetRunId),
            eq(escalas.pessoa, input.pessoa)
          ))
          .orderBy(escalas.data);

        // Convert duracaoHoras to number
        const escalasData = escalasRaw.map(e => ({
          data: e.data,
          duracaoHoras: parseFloat(e.duracaoHoras || '0'),
          ehFolga: e.ehFolga,
        }));

        // Calculate weekly utilization and analyze trend
        const { calculateWeeklyUtilization, analyzeTrend } = await import('./trend');
        const weeklyData = calculateWeeklyUtilization(escalasData);
        const trendAnalysis = analyzeTrend(input.pessoa, weeklyData, input.weeksToPredict);

        return trendAnalysis;
      }),
  }),

  roster: router({
    /**
     * Get roster data for weekly planning view
     */
    getRosterData: protectedProcedure
      .input(z.object({
        runId: z.number(),
        nivel: z.string().optional(),
        semanaIso: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const conditions = [eq(escalas.runId, input.runId)];
        if (input.nivel) conditions.push(eq(escalas.nivel, input.nivel));
        if (input.semanaIso) conditions.push(eq(escalas.semanaIso, input.semanaIso));

        const allEscalas = await db
          .select()
          .from(escalas)
          .where(and(...conditions))
          .orderBy(escalas.pessoa, escalas.data);

        // Group by person and collect all dates
        const rosterMap = new Map<string, any>();
        const uniqueDates = new Set<string>();

        for (const e of allEscalas) {
          const dateStr = e.data.toISOString().split('T')[0];
          uniqueDates.add(dateStr);

          if (!rosterMap.has(e.pessoa)) {
            rosterMap.set(e.pessoa, {
              nome: e.pessoa,
              modalidade: e.modalidade || "N/A",
              nivel: e.nivel || "N/A",
              base: e.base || "N/A",
              days: {},
            });
          }

          const person = rosterMap.get(e.pessoa)!;
          
          if (!person.days[dateStr]) {
            person.days[dateStr] = [];
          }

          let type = 'other';
          if (e.ehFolga) {
            const low = (e.tipoItem || "").toLowerCase();
            if (low.includes('férias') || low.includes('vacation')) {
              type = 'ferias';
            } else {
              type = 'folga';
            }
          } else if (e.wo && e.wo.trim() !== "") {
            type = 'transmission';
          } else {
            type = 'program';
          }

          person.days[dateStr].push({
            id: e.id,
            type,
            label: e.eventoPrograma || e.tipoItem || "Atividade",
            wo: e.wo,
          });
        }

        return {
          roster: Array.from(rosterMap.values()),
          dates: Array.from(uniqueDates).sort(),
        };
      }),

    /**
     * Get distinct levels for filtering
     */
    getLevels: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db
          .select({ nivel: escalas.nivel })
          .from(escalas)
          .where(and(eq(escalas.runId, input.runId), sql`${escalas.nivel} IS NOT NULL`))
          .groupBy(escalas.nivel);

        return result.map(r => r.nivel);
      }),

    /**
     * Get distinct weeks for filtering
     */
    getWeeks: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db
          .select({ semana: escalas.semanaIso })
          .from(escalas)
          .where(eq(escalas.runId, input.runId))
          .groupBy(escalas.semanaIso)
          .orderBy(escalas.semanaIso);

        return result.map(r => r.semana);
      }),

    /**
     * Audit roster premises using AI
     */
    auditPremises: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // 1. Fetch data for analysis
        const allEscalas = await db.select().from(escalas).where(eq(escalas.runId, input.runId));
        
        if (allEscalas.length === 0) return { status: "empty", issues: [] };

        // 2. Prepare context for AI (Sample data to avoid token limits)
        const sampleSize = 200;
        const sample = allEscalas.slice(0, sampleSize).map(e => ({
          pessoa: e.pessoa,
          data: e.data.toISOString().split('T')[0],
          ehFolga: e.ehFolga,
          evento: e.eventoPrograma,
          inicio: e.inicioDt,
          fim: e.fimDt
        }));

        const prompt = `
          Você é um Especialista em Gestão de Escalas e Leis Trabalhistas (Regras de Broadcasting).
          Analise a seguinte amostra de escalas e identifique potenciais violações de premissas:
          1. Descanso Interjornada: Mínimo de 11h entre o fim de um plantão e o início do próximo.
          2. Folga Semanal: Pelo menos uma folga a cada 6 dias trabalhados.
          3. Escalas Críticas: Viagens longas com pouco tempo de descanso.
          4. Trabalho em Folga: Pessoas alocadas em dias onde o tipo de item indica folga/férias.

          Amostra de dados em JSON:
          ${JSON.stringify(sample, null, 2)}

          Retorne um relatório estruturado.
        `;

        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          outputSchema: {
            name: "AuditReport",
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pessoa: { type: "string" },
                      tipo: { type: "string", enum: ["INTERJORNADA", "FOLGA_FALTANDO", "CONFLITO_LOCAL", "OUTRO"] },
                      descricao: { type: "string" },
                      gravidade: { type: "string", enum: ["ALTA", "MEDIA", "BAIXA"] }
                    }
                  }
                }
              }
            }
          }
        });

        const content = response.choices[0].message.content as string;
        const resultRaw = parseLLMResponse(content, "AuditReport");
        const issues = resultRaw.issues || resultRaw.problemas || resultRaw.violation || [];
        const result = { ...resultRaw, issues };
        return {
          status: "completed",
          ...result
        };
      }),

    /**
     * Optimize roster distribution using AI
     */
    optimizeDistribution: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Fetch events without people and available people on those days
        const targetRunId = input.runId;
        
        // Simplified optimization: Find WOs without people
        const wosSemElenco = await db.select().from(escalas).where(and(
          eq(escalas.runId, targetRunId),
          sql`(${escalas.pessoa} IS NULL OR ${escalas.pessoa} = '')`,
          sql`(${escalas.wo} IS NOT NULL AND ${escalas.wo} != '')`
        )).limit(10);

        if (wosSemElenco.length === 0) return { status: "optimal", suggestions: [] };

        const prompt = `
          Você é um Algoritmo de Otimização de Escalas. 
          Temos ${wosSemElenco.length} WOs (Ordens de Trabalho) sem profissional alocado.
          Sua meta é sugerir quem poderia cobrir baseado nessas premissas de redistribuição.

          WOs sem elenco:
          ${JSON.stringify(wosSemElenco.map(w => ({ wo: w.wo, data: w.data, local: w.cidade, funcao: w.funcao })), null, 2)}

          Sugira 3 movimentações de profissionais para cobrir esses buracos, movendo suas folgas se necessário (assuma que há profissionais N1 e N2 disponíveis na base).
        `;

        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          outputSchema: {
            name: "OptimizationSuggestions",
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      wo_afetada: { type: "string" },
                      acao: { type: "string" },
                      justificativa: { type: "string" },
                      profissional_sugerido: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        });

        const content = response.choices[0].message.content as string;
        const resultRaw = parseLLMResponse(content, "OptimizationSuggestions");
        const suggestions = resultRaw.suggestions || resultRaw.sugestoes || [];
        const result = { ...resultRaw, suggestions };
        return {
          status: "suggested",
          suggestions: result.suggestions
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
