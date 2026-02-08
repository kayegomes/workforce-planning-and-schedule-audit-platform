import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
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
import { eq, desc, and, sql } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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

        const wosWithEventResult = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${escalas.wo})` })
          .from(escalas)
          .where(and(
            eq(escalas.runId, input.runId),
            sql`${escalas.wo} IS NOT NULL`,
            sql`${escalas.wo} != ''`,
            sql`${escalas.eventoPrograma} IS NOT NULL`,
            sql`${escalas.eventoPrograma} != ''`
          ));

        const wosWithEvent = Number(wosWithEventResult[0]?.count || 0);
        const wosSemEvento = totalWOs - wosWithEvent;
        const percentualWOsSemEvento = totalWOs > 0 ? (wosSemEvento / totalWOs) * 100 : 0;

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
          wosSemEvento,
          percentualWOsSemEvento,
        };
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

        return {
          pessoa: input.pessoa,
          totalHoras: Number(hoursResult[0]?.total || 0),
          totalAtividades: Number(hoursResult[0]?.count || 0),
          totalConflitos: Number(conflitosCount[0]?.count || 0),
          totalViolacoesFolga: Number(folgaCount[0]?.count || 0),
          totalRiscosDeslocamento: Number(deslocamentoCount[0]?.count || 0),
          totalInterjornada: Number(interjornadaCount[0]?.count || 0),
          totalViagens: Number(viagensCount[0]?.count || 0),
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
  }),
});

export type AppRouter = typeof appRouter;
