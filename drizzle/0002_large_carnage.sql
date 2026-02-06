CREATE TABLE `alertas_interjornada` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`pessoa` varchar(255) NOT NULL,
	`escalaIdPrev` int NOT NULL,
	`escalaIdNext` int NOT NULL,
	`dataPrev` timestamp NOT NULL,
	`dataNext` timestamp NOT NULL,
	`fimPrev` timestamp NOT NULL,
	`inicioNext` timestamp NOT NULL,
	`descansoHoras` decimal(10,2),
	`descansoMinimo` decimal(10,2) DEFAULT '11.00',
	`eventoPrev` text,
	`eventoNext` text,
	`status` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertas_interjornada_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analise_grades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gradeId` int NOT NULL,
	`runId` int,
	`funcao` varchar(255) NOT NULL,
	`totalEventos` int DEFAULT 0,
	`eventosSemCobertura` int DEFAULT 0,
	`eventosComCobertura` int DEFAULT 0,
	`totalProfissionais` int DEFAULT 0,
	`profissionaisDisponiveis` int DEFAULT 0,
	`profissionaisEmFolga` int DEFAULT 0,
	`profissionaisEmExcecao` int DEFAULT 0,
	`resultado` enum('suficiente','insuficiente','critico') NOT NULL,
	`recomendacoes` text,
	`detalhes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analise_grades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `excecoes_profissionais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gradeId` int NOT NULL,
	`pessoa` varchar(255) NOT NULL,
	`tipo` varchar(100) NOT NULL,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp NOT NULL,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `excecoes_profissionais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`nome` varchar(255) NOT NULL,
	`fileKey` text,
	`fileUrl` text,
	`dataInicio` timestamp,
	`dataFim` timestamp,
	`totalEventos` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `grades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `viagens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`pessoa` varchar(255) NOT NULL,
	`escalaIdOrigem` int NOT NULL,
	`escalaIdDestino` int NOT NULL,
	`cidadeOrigem` varchar(255),
	`cidadeDestino` varchar(255),
	`dataOrigem` timestamp NOT NULL,
	`dataDestino` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `viagens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `runs` ADD `totalInterjornada` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `runs` ADD `totalViagens` int DEFAULT 0;--> statement-breakpoint
CREATE INDEX `runId_idx` ON `alertas_interjornada` (`runId`);--> statement-breakpoint
CREATE INDEX `pessoa_idx` ON `alertas_interjornada` (`pessoa`);--> statement-breakpoint
CREATE INDEX `gradeId_idx` ON `analise_grades` (`gradeId`);--> statement-breakpoint
CREATE INDEX `runId_idx` ON `analise_grades` (`runId`);--> statement-breakpoint
CREATE INDEX `gradeId_idx` ON `excecoes_profissionais` (`gradeId`);--> statement-breakpoint
CREATE INDEX `pessoa_idx` ON `excecoes_profissionais` (`pessoa`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `grades` (`userId`);--> statement-breakpoint
CREATE INDEX `runId_idx` ON `viagens` (`runId`);--> statement-breakpoint
CREATE INDEX `pessoa_idx` ON `viagens` (`pessoa`);