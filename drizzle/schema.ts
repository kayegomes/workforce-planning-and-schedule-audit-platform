import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Runs table - tracks each processing execution
 */
export const runs = mysqlTable("runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  file2468Key: text("file2468Key"), // S3 key for 2468 file
  file2020Key: text("file2020Key"), // S3 key for 2020 file
  file2468Url: text("file2468Url"), // S3 URL for 2468 file
  file2020Url: text("file2020Url"), // S3 URL for 2020 file
  totalEscalas: int("totalEscalas").default(0),
  totalEventos: int("totalEventos").default(0),
  totalConflitos: int("totalConflitos").default(0),
  totalViolacoesFolga: int("totalViolacoesFolga").default(0),
  totalRiscosDeslocamento: int("totalRiscosDeslocamento").default(0),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  statusIdx: index("status_idx").on(table.status),
}));

export type Run = typeof runs.$inferSelect;
export type InsertRun = typeof runs.$inferInsert;

/**
 * Escalas table - consolidated activities (F_Escalas)
 */
export const escalas = mysqlTable("escalas", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  pessoa: varchar("pessoa", { length: 255 }).notNull(),
  funcao: varchar("funcao", { length: 255 }),
  tipoItem: varchar("tipoItem", { length: 100 }), // Booking, Other Time Off, Roster, Quick Hold
  descricaoItem: text("descricaoItem"),
  status: varchar("status", { length: 100 }),
  canal: varchar("canal", { length: 255 }),
  cliente: varchar("cliente", { length: 255 }),
  eventoPrograma: text("eventoPrograma"),
  wo: varchar("wo", { length: 100 }),
  data: timestamp("data").notNull(),
  inicioDt: timestamp("inicioDt").notNull(),
  fimDt: timestamp("fimDt").notNull(),
  duracaoHoras: decimal("duracaoHoras", { precision: 10, scale: 2 }),
  cidade: varchar("cidade", { length: 255 }),
  uf: varchar("uf", { length: 10 }),
  local: varchar("local", { length: 255 }),
  ehFolga: boolean("ehFolga").default(false).notNull(),
  ehViagem: boolean("ehViagem").default(false).notNull(),
  ano: int("ano"),
  mes: int("mes"),
  semanaIso: int("semanaIso"),
  diaSemana: varchar("diaSemana", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runIdIdx: index("runId_idx").on(table.runId),
  pessoaIdx: index("pessoa_idx").on(table.pessoa),
  dataIdx: index("data_idx").on(table.data),
  woIdx: index("wo_idx").on(table.wo),
}));

export type Escala = typeof escalas.$inferSelect;
export type InsertEscala = typeof escalas.$inferInsert;

/**
 * Eventos table - consolidated events (D_Eventos)
 */
export const eventos = mysqlTable("eventos", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  wo: varchar("wo", { length: 100 }).notNull(),
  data: timestamp("data").notNull(),
  tipoEvento: varchar("tipoEvento", { length: 255 }),
  produto: varchar("produto", { length: 255 }),
  canal: varchar("canal", { length: 255 }),
  cidade: varchar("cidade", { length: 255 }),
  uf: varchar("uf", { length: 10 }),
  local: varchar("local", { length: 255 }),
  tipoProducao: varchar("tipoProducao", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runIdIdx: index("runId_idx").on(table.runId),
  woIdx: index("wo_idx").on(table.wo),
  dataIdx: index("data_idx").on(table.data),
}));

export type Evento = typeof eventos.$inferSelect;
export type InsertEvento = typeof eventos.$inferInsert;

/**
 * Alertas Conflito table - time overlap conflicts
 */
export const alertasConflito = mysqlTable("alertas_conflito", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  pessoa: varchar("pessoa", { length: 255 }).notNull(),
  data: timestamp("data").notNull(),
  escalaId1: int("escalaId1").notNull(),
  escalaId2: int("escalaId2").notNull(),
  inicio1: timestamp("inicio1").notNull(),
  fim1: timestamp("fim1").notNull(),
  inicio2: timestamp("inicio2").notNull(),
  fim2: timestamp("fim2").notNull(),
  overlapMinutos: int("overlapMinutos"),
  evento1: text("evento1"),
  evento2: text("evento2"),
  cidade1: varchar("cidade1", { length: 255 }),
  cidade2: varchar("cidade2", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runIdIdx: index("runId_idx").on(table.runId),
  pessoaIdx: index("pessoa_idx").on(table.pessoa),
  dataIdx: index("data_idx").on(table.data),
}));

export type AlertaConflito = typeof alertasConflito.$inferSelect;
export type InsertAlertaConflito = typeof alertasConflito.$inferInsert;

/**
 * Alertas Folga table - work during time-off violations
 */
export const alertasFolga = mysqlTable("alertas_folga", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  pessoa: varchar("pessoa", { length: 255 }).notNull(),
  data: timestamp("data").notNull(),
  tipoFolga: varchar("tipoFolga", { length: 100 }), // Day Off, Vacation, Comp Day
  escalaIdFolga: int("escalaIdFolga").notNull(),
  escalaIdConflitante: int("escalaIdConflitante").notNull(),
  duracaoHoras: decimal("duracaoHoras", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 100 }),
  eventoPrograma: text("eventoPrograma"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runIdIdx: index("runId_idx").on(table.runId),
  pessoaIdx: index("pessoa_idx").on(table.pessoa),
  dataIdx: index("data_idx").on(table.data),
}));

export type AlertaFolga = typeof alertasFolga.$inferSelect;
export type InsertAlertaFolga = typeof alertasFolga.$inferInsert;

/**
 * Alertas Deslocamento table - insufficient gap between activities in different cities
 */
export const alertasDeslocamento = mysqlTable("alertas_deslocamento", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  pessoa: varchar("pessoa", { length: 255 }).notNull(),
  escalaIdPrev: int("escalaIdPrev").notNull(),
  escalaIdNext: int("escalaIdNext").notNull(),
  dataPrev: timestamp("dataPrev").notNull(),
  dataNext: timestamp("dataNext").notNull(),
  cidadePrev: varchar("cidadePrev", { length: 255 }),
  cidadeNext: varchar("cidadeNext", { length: 255 }),
  fimPrev: timestamp("fimPrev").notNull(),
  inicioNext: timestamp("inicioNext").notNull(),
  gapHoras: decimal("gapHoras", { precision: 10, scale: 2 }),
  gapMinimo: decimal("gapMinimo", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runIdIdx: index("runId_idx").on(table.runId),
  pessoaIdx: index("pessoa_idx").on(table.pessoa),
}));

export type AlertaDeslocamento = typeof alertasDeslocamento.$inferSelect;
export type InsertAlertaDeslocamento = typeof alertasDeslocamento.$inferInsert;

/**
 * Qualidade Dados table - data quality issues
 */
export const qualidadeDados = mysqlTable("qualidade_dados", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  tipo: varchar("tipo", { length: 100 }).notNull(), // data_invalida, hora_faltando, duracao_negativa, etc
  descricao: text("descricao"),
  pessoa: varchar("pessoa", { length: 255 }),
  data: timestamp("data"),
  wo: varchar("wo", { length: 100 }),
  dadosOriginais: text("dadosOriginais"), // JSON string with original row data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runIdIdx: index("runId_idx").on(table.runId),
  tipoIdx: index("tipo_idx").on(table.tipo),
}));

export type QualidadeDado = typeof qualidadeDados.$inferSelect;
export type InsertQualidadeDado = typeof qualidadeDados.$inferInsert;
