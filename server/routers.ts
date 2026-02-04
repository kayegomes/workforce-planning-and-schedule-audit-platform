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
  saveQualityIssues,
  getRunsByUser,
  getRunById,
  getDb
} from "./db";
import { storagePut } from "./storage";
import { parseExcelFile, processAtividades, processEventos, mergeEscalasWithEventos } from "./etl";
import { detectConflicts, detectFolgaViolations, detectDeslocamentoRisks, detectQualityIssues } from "./rules";
import { runs, escalas, alertasConflito, alertasFolga, alertasDeslocamento } from "../drizzle/schema";
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
          const qualityIssues = detectQualityIssues(mergedEscalas);

          // Save alerts
          await saveConflictAlerts(runId, conflicts);
          await saveFolgaAlerts(runId, folgaViolations);
          await saveDeslocamentoAlerts(runId, deslocamentoRisks);
          await saveQualityIssues(runId, qualityIssues);

          // Update run stats
          await updateRunStats(runId, {
            totalEscalas: mergedEscalas.length,
            totalEventos: eventosArray.length,
            totalConflitos: conflicts.length,
            totalViolacoesFolga: folgaViolations.length,
            totalRiscosDeslocamento: deslocamentoRisks.length,
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

        return {
          totalEscalas: run.totalEscalas || 0,
          totalEventos: run.totalEventos || 0,
          totalConflitos: run.totalConflitos || 0,
          totalViolacoesFolga: run.totalViolacoesFolga || 0,
          totalRiscosDeslocamento: run.totalRiscosDeslocamento || 0,
          totalHorasAtividades,
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

        const results = await db.select().from(alertasDeslocamento)
          .where(and(...conditions))
          .limit(input.limit)
          .offset(input.offset);
        return results;
      }),
  }),
});

export type AppRouter = typeof appRouter;
