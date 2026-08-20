import {
  bigint,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

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

export const sourceVideos = mysqlTable(
  "source_videos",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    sourceType: mysqlEnum("sourceType", ["upload", "youtube", "twitch", "live"]).default("upload").notNull(),
    originalUrl: text("originalUrl"),
    status: mysqlEnum("status", ["uploaded", "normalizing", "transcribing", "detecting", "rendering", "awaiting_review", "completed", "failed"]).default("uploaded").notNull(),
    durationSeconds: int("durationSeconds"),
    resolution: varchar("resolution", { length: 32 }),
    fps: int("fps"),
    language: varchar("language", { length: 10 }).default("pt"),
    processingVersion: varchar("processingVersion", { length: 64 }).default("v1"),
    retryCount: int("retryCount").default(0).notNull(),
    errorMessage: text("errorMessage"),
    idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerStatusIdx: index("source_videos_owner_status_idx").on(table.ownerId, table.status),
    idempotencyIdx: uniqueIndex("source_videos_idempotency_idx").on(table.idempotencyKey),
  }),
);

export const mediaArtifacts = mysqlTable(
  "media_artifacts",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceVideoId: int("sourceVideoId"),
    ownerId: int("ownerId").notNull(),
    artifactType: mysqlEnum("artifactType", ["raw_video", "normalized_video", "audio", "clip", "vertical_clip", "captioned_clip", "thumbnail", "captions"]).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    byteSize: bigint("byteSize", { mode: "number" }),
    processingVersion: varchar("processingVersion", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sourceTypeIdx: index("artifacts_source_type_idx").on(table.sourceVideoId, table.artifactType),
  }),
);

export const processingJobs = mysqlTable(
  "processing_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    sourceVideoId: int("sourceVideoId"),
    candidateId: int("candidateId"),
    jobType: mysqlEnum("jobType", ["ingest", "transcribe", "detect_highlights", "render", "thumbnail", "metadata", "publish", "collect_metrics", "recalibrate"]).notNull(),
    queueName: varchar("queueName", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["queued", "running", "succeeded", "failed", "cancelled"]).default("queued").notNull(),
    retryCount: int("retryCount").default(0).notNull(),
    maxRetries: int("maxRetries").default(3).notNull(),
    errorMessage: text("errorMessage"),
    modelVersion: varchar("modelVersion", { length: 128 }),
    promptVersion: varchar("promptVersion", { length: 64 }),
    idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    queueStatusIdx: index("jobs_queue_status_idx").on(table.queueName, table.status),
    jobIdempotencyIdx: uniqueIndex("jobs_idempotency_idx").on(table.idempotencyKey),
  }),
);

export const transcripts = mysqlTable(
  "transcripts",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceVideoId: int("sourceVideoId").notNull(),
    ownerId: int("ownerId").notNull(),
    language: varchar("language", { length: 10 }).notNull(),
    engine: varchar("engine", { length: 80 }).notNull(),
    modelVersion: varchar("modelVersion", { length: 128 }),
    segmentsJson: json("segmentsJson").notNull(),
    wordCount: int("wordCount"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    transcriptSourceIdx: index("transcripts_source_idx").on(table.sourceVideoId),
  }),
);

export const clipCandidates = mysqlTable(
  "clip_candidates",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceVideoId: int("sourceVideoId").notNull(),
    ownerId: int("ownerId").notNull(),
    startTimeMs: int("startTimeMs").notNull(),
    endTimeMs: int("endTimeMs").notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    llmScore: int("llmScore"),
    audioScore: int("audioScore"),
    chatScore: int("chatScore"),
    finalScore: int("finalScore").notNull(),
    hookText: varchar("hookText", { length: 255 }),
    reasoning: text("reasoning"),
    suggestedTitle: varchar("suggestedTitle", { length: 255 }),
    status: mysqlEnum("status", ["candidate", "approved", "rejected", "rendering", "ready", "scheduled", "published"]).default("candidate").notNull(),
    rejectionReason: varchar("rejectionReason", { length: 80 }),
    modelVersion: varchar("modelVersion", { length: 128 }),
    promptVersion: varchar("promptVersion", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    reviewIdx: index("candidates_review_idx").on(table.ownerId, table.status, table.finalScore),
  }),
);

export const clips = mysqlTable("clips", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(),
  ownerId: int("ownerId").notNull(),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  hashtagsJson: json("hashtagsJson"),
  status: mysqlEnum("status", ["draft", "rendering", "ready", "approved", "rejected", "scheduled", "published"]).default("draft").notNull(),
  reviewedBy: int("reviewedBy"),
  rejectionReason: varchar("rejectionReason", { length: 80 }),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const publications = mysqlTable(
  "publications",
  {
    id: int("id").autoincrement().primaryKey(),
    clipId: int("clipId").notNull(),
    ownerId: int("ownerId").notNull(),
    platform: mysqlEnum("platform", ["youtube", "tiktok", "instagram"]).notNull(),
    platformVideoId: varchar("platformVideoId", { length: 255 }),
    status: mysqlEnum("status", ["draft", "scheduled", "publishing", "published", "failed", "cancelled"]).default("draft").notNull(),
    scheduledAt: timestamp("scheduledAt"),
    publishedAt: timestamp("publishedAt"),
    retryCount: int("retryCount").default(0).notNull(),
    errorMessage: text("errorMessage"),
    idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    publicationScheduleIdx: index("publications_schedule_idx").on(table.ownerId, table.status, table.scheduledAt),
    publicationPlatformIdx: index("publications_platform_idx").on(table.ownerId, table.platform, table.status),
    publicationIdempotencyIdx: uniqueIndex("publications_idempotency_idx").on(table.idempotencyKey),
  }),
);

export const metrics = mysqlTable(
  "metrics",
  {
    id: int("id").autoincrement().primaryKey(),
    publicationId: int("publicationId").notNull(),
    views: int("views").default(0).notNull(),
    likes: int("likes").default(0).notNull(),
    comments: int("comments").default(0).notNull(),
    shares: int("shares").default(0).notNull(),
    avgWatchTimeMs: int("avgWatchTimeMs"),
    retentionRate: int("retentionRate"),
    collectedAt: timestamp("collectedAt").defaultNow().notNull(),
  },
  table => ({
    metricsPublicationIdx: index("metrics_publication_idx").on(table.publicationId, table.collectedAt),
  }),
);

export const alerts = mysqlTable(
  "alerts",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    alertType: mysqlEnum("alertType", ["review_ready", "publication_failed", "score_anomaly", "pipeline_failed"]).notNull(),
    severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    entityType: varchar("entityType", { length: 40 }),
    entityId: int("entityId"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerReadIdx: index("alerts_owner_read_idx").on(table.ownerId, table.readAt),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SourceVideo = typeof sourceVideos.$inferSelect;
export type ClipCandidate = typeof clipCandidates.$inferSelect;
export type ProcessingJob = typeof processingJobs.$inferSelect;
