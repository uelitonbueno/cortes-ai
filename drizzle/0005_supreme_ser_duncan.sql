CREATE TABLE `integration_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`platform` enum('youtube','tiktok','instagram') NOT NULL,
	`accessToken` text,
	`publishEndpoint` varchar(512),
	`enabled` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_owner_platform_idx` UNIQUE(`ownerId`,`platform`)
);
