ALTER TABLE `runs` ADD `totalAtividades` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `runs` ADD `totalHorasAtividades` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `runs` ADD `percentualWOsSemEvento` decimal(5,2) DEFAULT '0';