import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, runs, escalas, eventos, alertasConflito, alertasFolga, alertasDeslocamento, alertasInterjornada, viagens, qualidadeDados } from "../drizzle/schema";
import type { ProcessedEscala } from "./etl";
import type { ConflictAlert, FolgaAlert, DeslocamentoAlert, InterjornadaAlert, ViagemDetected, QualidadeIssue } from "./rules";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create a new run record
 */
export async function createRun(userId: number, file2468Key: string, file2020Key: string, file2468Url: string, file2020Url: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(runs).values({
    userId,
    status: "pending",
    file2468Key,
    file2020Key,
    file2468Url,
    file2020Url,
  });

  return Number(result[0].insertId);
}

/**
 * Update run status
 */
export async function updateRunStatus(
  runId: number,
  status: "processing" | "completed" | "failed",
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status };
  
  if (status === "completed" || status === "failed") {
    updateData.completedAt = new Date();
  }
  
  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }

  await db.update(runs).set(updateData).where(eq(runs.id, runId));
}

/**
 * Update run statistics
 */
export async function updateRunStats(
  runId: number,
  stats: {
    totalEscalas: number;
    totalEventos: number;
    totalConflitos: number;
    totalViolacoesFolga: number;
    totalRiscosDeslocamento: number;
    totalInterjornada: number;
    totalViagens: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(runs).set(stats).where(eq(runs.id, runId));
}

/**
 * Save escalas to database
 */
export async function saveEscalas(runId: number, escalasData: ProcessedEscala[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (escalasData.length === 0) return [];

  const values = escalasData.map(e => ({
    runId,
    pessoa: e.pessoa,
    funcao: e.funcao,
    tipoItem: e.tipoItem,
    descricaoItem: e.descricaoItem,
    status: e.status,
    canal: e.canal,
    cliente: e.cliente,
    eventoPrograma: e.eventoPrograma,
    wo: e.wo,
    data: e.data,
    inicioDt: e.inicioDt,
    fimDt: e.fimDt,
    duracaoHoras: e.duracaoHoras.toFixed(2),
    cidade: e.cidade,
    uf: e.uf,
    local: e.local,
    ehFolga: e.ehFolga,
    ehViagem: e.ehViagem,
    ano: e.ano,
    mes: e.mes,
    semanaIso: e.semanaIso,
    diaSemana: e.diaSemana,
  }));

  const result = await db.insert(escalas).values(values);
  const firstId = Number(result[0].insertId);
  
  // Return array of IDs
  return escalasData.map((_, index) => firstId + index);
}

/**
 * Save eventos to database
 */
export async function saveEventos(runId: number, eventosData: Array<{ wo: string; data: Date; tipoEvento: string | null; produto: string | null; canal: string | null; cidade: string | null; uf: string | null; local: string | null; tipoProducao: string | null }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (eventosData.length === 0) return;

  const values = eventosData.map(e => ({
    runId,
    wo: e.wo,
    data: e.data,
    tipoEvento: e.tipoEvento,
    produto: e.produto,
    canal: e.canal,
    cidade: e.cidade,
    uf: e.uf,
    local: e.local,
    tipoProducao: e.tipoProducao,
  }));

  await db.insert(eventos).values(values);
}

/**
 * Save conflict alerts to database
 */
export async function saveConflictAlerts(runId: number, conflicts: ConflictAlert[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (conflicts.length === 0) return;

  const values = conflicts.map(c => ({
    runId,
    pessoa: c.pessoa,
    data: c.data,
    escalaId1: c.escalaId1,
    escalaId2: c.escalaId2,
    inicio1: c.inicio1,
    fim1: c.fim1,
    inicio2: c.inicio2,
    fim2: c.fim2,
    overlapMinutos: c.overlapMinutos,
    evento1: c.evento1,
    evento2: c.evento2,
    cidade1: c.cidade1,
    cidade2: c.cidade2,
  }));

  await db.insert(alertasConflito).values(values);
}

/**
 * Save folga violation alerts to database
 */
export async function saveFolgaAlerts(runId: number, violations: FolgaAlert[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (violations.length === 0) return;

  const values = violations.map(v => ({
    runId,
    pessoa: v.pessoa,
    data: v.data,
    tipoFolga: v.tipoFolga,
    escalaIdFolga: v.escalaIdFolga,
    escalaIdConflitante: v.escalaIdConflitante,
    duracaoHoras: v.duracaoHoras.toFixed(2),
    status: v.status,
    eventoPrograma: v.eventoPrograma,
  }));

  await db.insert(alertasFolga).values(values);
}

/**
 * Save deslocamento risk alerts to database
 */
export async function saveDeslocamentoAlerts(runId: number, risks: DeslocamentoAlert[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (risks.length === 0) return;

  const values = risks.map(r => ({
    runId,
    pessoa: r.pessoa,
    escalaIdPrev: r.escalaIdPrev,
    escalaIdNext: r.escalaIdNext,
    dataPrev: r.dataPrev,
    dataNext: r.dataNext,
    cidadePrev: r.cidadePrev,
    cidadeNext: r.cidadeNext,
    fimPrev: r.fimPrev,
    inicioNext: r.inicioNext,
    gapHoras: r.gapHoras.toFixed(2),
    gapMinimo: r.gapMinimo.toFixed(2),
    status: r.status,
  }));

  await db.insert(alertasDeslocamento).values(values);
}

/**
 * Save quality issues to database
 */
export async function saveQualityIssues(runId: number, issues: QualidadeIssue[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (issues.length === 0) return;

  const values = issues.map(i => ({
    runId,
    tipo: i.tipo,
    descricao: i.descricao,
    pessoa: i.pessoa,
    data: i.data,
    wo: i.wo,
    dadosOriginais: i.dadosOriginais,
  }));

  await db.insert(qualidadeDados).values(values);
}

/**
 * Get runs for a user
 */
export async function getRunsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(runs).where(eq(runs.userId, userId)).orderBy(runs.createdAt);
}

/**
 * Get run by ID
 */
export async function getRunById(runId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  return result[0];
}

/**
 * Save interjornada violation alerts to database
 */
export async function saveInterjornadaAlerts(runId: number, violations: InterjornadaAlert[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (violations.length === 0) return;

  const values = violations.map(v => ({
    runId,
    pessoa: v.pessoa,
    escalaIdPrev: v.escalaIdPrev,
    escalaIdNext: v.escalaIdNext,
    dataPrev: v.dataPrev,
    dataNext: v.dataNext,
    fimPrev: v.fimPrev,
    inicioNext: v.inicioNext,
    descansoHoras: v.descansoHoras.toFixed(2),
    descansoMinimo: v.descansoMinimo.toFixed(2),
    eventoPrev: v.eventoPrev,
    eventoNext: v.eventoNext,
    status: v.status,
  }));

  await db.insert(alertasInterjornada).values(values);
}

/**
 * Save detected viagens to database
 */
export async function saveViagens(runId: number, viagensData: ViagemDetected[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (viagensData.length === 0) return;

  const values = viagensData.map(v => ({
    runId,
    pessoa: v.pessoa,
    escalaIdOrigem: v.escalaIdOrigem,
    escalaIdDestino: v.escalaIdDestino,
    cidadeOrigem: v.cidadeOrigem,
    cidadeDestino: v.cidadeDestino,
    dataOrigem: v.dataOrigem,
    dataDestino: v.dataDestino,
  }));

  await db.insert(viagens).values(values);
}
