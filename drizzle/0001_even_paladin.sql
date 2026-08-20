CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`alertType` enum('review_ready','publication_failed','score_anomaly','pipeline_failed') NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`entityType` varchar(40),
	`entityId` int,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clip_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceVideoId` int NOT NULL,
	`ownerId` int NOT NULL,
	`startTimeMs` int NOT NULL,
	`endTimeMs` int NOT NULL,
	`category` varchar(40) NOT NULL,
	`llmScore` int,
	`audioScore` int,
	`chatScore` int,
	`finalScore` int NOT NULL,
	`hookText` varchar(255),
	`reasoning` text,
	`suggestedTitle` varchar(255),
	`status` enum('candidate','approved','rejected','rendering','ready','scheduled','published') NOT NULL DEFAULT 'candidate',
	`rejectionReason` varchar(80),
	`modelVersion` varchar(128),
	`promptVersion` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clip_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateId` int NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(255),
	`description` text,
	`hashtagsJson` json,
	`status` enum('draft','rendering','ready','approved','rejected','scheduled','published') NOT NULL DEFAULT 'draft',
	`reviewedBy` int,
	`rejectionReason` varchar(80),
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceVideoId` int,
	`ownerId` int NOT NULL,
	`artifactType` enum('raw_video','normalized_video','audio','clip','vertical_clip','captioned_clip','thumbnail','captions') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` bigint,
	`processingVersion` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicationId` int NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`likes` int NOT NULL DEFAULT 0,
	`comments` int NOT NULL DEFAULT 0,
	`shares` int NOT NULL DEFAULT 0,
	`avgWatchTimeMs` int,
	`retentionRate` int,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `processing_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`sourceVideoId` int,
	`candidateId` int,
	`jobType` enum('ingest','transcribe','detect_highlights','render','thumbnail','metadata','publish','collect_metrics','recalibrate') NOT NULL,
	`queueName` varchar(64) NOT NULL,
	`status` enum('queued','running','succeeded','failed','cancelled') NOT NULL DEFAULT 'queued',
	`retryCount` int NOT NULL DEFAULT 0,
	`maxRetries` int NOT NULL DEFAULT 3,
	`errorMessage` text,
	`modelVersion` varchar(128),
	`promptVersion` varchar(64),
	`idempotencyKey` varchar(160) NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `processing_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobs_idempotency_idx` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `publications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clipId` int NOT NULL,
	`ownerId` int NOT NULL,
	`platform` enum('youtube','tiktok','instagram') NOT NULL,
	`platformVideoId` varchar(255),
	`status` enum('draft','scheduled','publishing','published','failed','cancelled') NOT NULL DEFAULT 'draft',
	`scheduledAt` timestamp,
	`publishedAt` timestamp,
	`retryCount` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`idempotencyKey` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publications_id` PRIMARY KEY(`id`),
	CONSTRAINT `publications_idempotency_idx` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `source_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`sourceType` enum('upload','youtube','twitch','live') NOT NULL DEFAULT 'upload',
	`originalUrl` text,
	`status` enum('uploaded','normalizing','transcribing','detecting','rendering','awaiting_review','completed','failed') NOT NULL DEFAULT 'uploaded',
	`durationSeconds` int,
	`resolution` varchar(32),
	`fps` int,
	`language` varchar(10) DEFAULT 'pt',
	`processingVersion` varchar(64) DEFAULT 'v1',
	`retryCount` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`idempotencyKey` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_videos_idempotency_idx` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceVideoId` int NOT NULL,
	`ownerId` int NOT NULL,
	`language` varchar(10) NOT NULL,
	`engine` varchar(80) NOT NULL,
	`modelVersion` varchar(128),
	`segmentsJson` json NOT NULL,
	`wordCount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transcripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `alerts_owner_read_idx` ON `alerts` (`ownerId`,`readAt`);--> statement-breakpoint
CREATE INDEX `candidates_review_idx` ON `clip_candidates` (`ownerId`,`status`,`finalScore`);--> statement-breakpoint
CREATE INDEX `artifacts_source_type_idx` ON `media_artifacts` (`sourceVideoId`,`artifactType`);--> statement-breakpoint
CREATE INDEX `metrics_publication_idx` ON `metrics` (`publicationId`,`collectedAt`);--> statement-breakpoint
CREATE INDEX `jobs_queue_status_idx` ON `processing_jobs` (`queueName`,`status`);--> statement-breakpoint
CREATE INDEX `publications_schedule_idx` ON `publications` (`ownerId`,`status`,`scheduledAt`);--> statement-breakpoint
CREATE INDEX `source_videos_owner_status_idx` ON `source_videos` (`ownerId`,`status`);--> statement-breakpoint
CREATE INDEX `transcripts_source_idx` ON `transcripts` (`sourceVideoId`);