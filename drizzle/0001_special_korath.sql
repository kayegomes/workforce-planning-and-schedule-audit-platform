CREATE TABLE `alertas_conflito` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`pessoa` varchar(255) NOT NULL,
	`data` timestamp NOT NULL,
	`escalaId1` int NOT NULL,
	`escalaId2` int NOT NULL,
	`inicio1` timestamp NOT NULL,
	`fim1` timestamp NOT NULL,
	`inicio2` timestamp NOT NULL,
	`fim2` timestamp NOT NULL,
	`overlapMinutos` int,
	`evento1` text,
	`evento2` text,
	`cidade1` varchar(255),
	`cidade2` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertas_conflito_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alertas_deslocamento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`pessoa` varchar(255) NOT NULL,
	`escalaIdPrev` int NOT NULL,
	`escalaIdNext` int NOT NULL,
	`dataPrev` timestamp NOT NULL,
	`dataNext` timestamp NOT NULL,
	`cidadePrev` varchar(255),
	`cidadeNext` varchar(255),
	`fimPrev` timestamp NOT NULL,
	`inicioNext` timestamp NOT NULL,
	`gapHoras` decimal(10,2),
	`gapMinimo` decimal(10,2),
	`status` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertas_deslocamento_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alertas_folga` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`pessoa` varchar(255) NOT NULL,
	`data` timestamp NOT NULL,
	`tipoFolga` varchar(100),
	`escalaIdFolga` int NOT NULL,
	`escalaIdConflitante` int NOT NULL,
	`duracaoHoras` decimal(10,2),
	`status` varchar(100),
	`eventoPrograma` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertas_folga_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `escalas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`pessoa` varchar(255) NOT NULL,
	`funcao` varchar(255),
	`tipoItem` varchar(100),
	`descricaoItem` text,
	`status` varchar(100),
	`canal` varchar(255),
	`cliente` varchar(255),
	`eventoPrograma` text,
	`wo` varchar(100),
	`data` timestamp NOT NULL,
	`inicioDt` timestamp NOT NULL,
	`fimDt` timestamp NOT NULL,
	`duracaoHoras` decimal(10,2),
	`cidade` varchar(255),
	`uf` varchar(10),
	`local` varchar(255),
	`ehFolga` boolean NOT NULL DEFAULT false,
	`ehViagem` boolean NOT NULL DEFAULT false,
	`ano` int,
	`mes` int,
	`semanaIso` int,
	`diaSemana` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `escalas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eventos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`wo` varchar(100) NOT NULL,
	`data` timestamp NOT NULL,
	`tipoEvento` varchar(255),
	`produto` varchar(255),
	`canal` varchar(255),
	`cidade` varchar(255),
	`uf` varchar(10),
	`local` varchar(255),
	`tipoProducao` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eventos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qualidade_dados` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`tipo` varchar(100) NOT NULL,
	`descricao` text,
	`pessoa` varchar(255),
	`data` timestamp,
	`wo` varchar(100),
	`dadosOriginais` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qualidade_dados_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`file2468Key` text,
	`file2020Key` text,
	`file2468Url` text,
	`file2020Url` text,
	`totalEscalas` int DEFAULT 0,
	`totalEventos` int DEFAULT 0,
	`totalConflitos` int DEFAULT 0,
	`totalViolacoesFolga` int DEFAULT 0,
	`totalRiscosDeslocamento` int DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `runId_idx` ON `alertas_conflito` (`runId`);--> statement-breakpoint
CREATE INDEX `pessoa_idx` ON `alertas_conflito` (`pessoa`);--> statement-breakpoint
CREATE INDEX `data_idx` ON `alertas_conflito` (`data`);--> statement-breakpoint
CREATE INDEX `runId_idx` ON `alertas_deslocamento` (`runId`);--> statement-breakpoint
CREATE INDEX `pessoa_idx` ON `alertas_deslocamento` (`pessoa`);--> statement-breakpoint
CREATE INDEX `runId_idx` ON `alertas_folga` (`runId`);--> statement-breakpoint
CREATE INDEX `pessoa_idx` ON `alertas_folga` (`pessoa`);--> statement-breakpoint
CREATE INDEX `data_idx` ON `alertas_folga` (`data`);--> statement-breakpoint
CREATE INDEX `runId_idx` ON `escalas` (`runId`);--> statement-breakpoint
CREATE INDEX `pessoa_idx` ON `escalas` (`pessoa`);--> statement-breakpoint
CREATE INDEX `data_idx` ON `escalas` (`data`);--> statement-breakpoint
CREATE INDEX `wo_idx` ON `escalas` (`wo`);--> statement-breakpoint
CREATE INDEX `runId_idx` ON `eventos` (`runId`);--> statement-breakpoint
CREATE INDEX `wo_idx` ON `eventos` (`wo`);--> statement-breakpoint
CREATE INDEX `data_idx` ON `eventos` (`data`);--> statement-breakpoint
CREATE INDEX `runId_idx` ON `qualidade_dados` (`runId`);--> statement-breakpoint
CREATE INDEX `tipo_idx` ON `qualidade_dados` (`tipo`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `runs` (`userId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `runs` (`status`);