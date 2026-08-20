CREATE TABLE `score_calibrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`weightsJson` json NOT NULL,
	`sampleSize` int NOT NULL,
	`modelVersion` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `score_calibrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `score_calibrations_owner_idx` ON `score_calibrations` (`ownerId`,`createdAt`);