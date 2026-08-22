import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { SourceType, PipelineState } from "../shared/pipeline";
import {
  alerts,
  integrationSettings,
  clipCandidates,
  clips,
  InsertUser,
  metrics,
  mediaArtifacts,
  scoreCalibrations,
  processingJobs,
  publications,
  sourceVideos,
  users,
  brandKits,
  captionTemplates,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function getPipelineOverview(ownerId: number) {
  const db = await getDb();
  if (!db)
    return { videos: 0, review: 0, scheduled: 0, published: 0, failedJobs: 0 };
  const [videoCount, reviewCount, scheduledCount, publishedCount, failedCount] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(sourceVideos)
        .where(eq(sourceVideos.ownerId, ownerId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(clipCandidates)
        .where(
          and(
            eq(clipCandidates.ownerId, ownerId),
            eq(clipCandidates.status, "candidate")
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(publications)
        .where(
          and(
            eq(publications.ownerId, ownerId),
            eq(publications.status, "scheduled")
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(publications)
        .where(
          and(
            eq(publications.ownerId, ownerId),
            eq(publications.status, "published")
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(processingJobs)
        .where(
          and(
            eq(processingJobs.ownerId, ownerId),
            eq(processingJobs.status, "failed")
          )
        ),
    ]);
  return {
    videos: Number(videoCount[0]?.count ?? 0),
    review: Number(reviewCount[0]?.count ?? 0),
    scheduled: Number(scheduledCount[0]?.count ?? 0),
    published: Number(publishedCount[0]?.count ?? 0),
    failedJobs: Number(failedCount[0]?.count ?? 0),
  };
}

export async function listSourceVideos(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(sourceVideos)
    .where(eq(sourceVideos.ownerId, ownerId))
    .orderBy(desc(sourceVideos.createdAt))
    .limit(50);
}

export async function listReviewCandidates(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clipCandidates)
    .where(
      and(
        eq(clipCandidates.ownerId, ownerId),
        eq(clipCandidates.status, "candidate")
      )
    )
    .orderBy(desc(clipCandidates.finalScore), desc(clipCandidates.createdAt))
    .limit(50);
}

export async function getPipelineDetail(
  ownerId: number,
  sourceVideoId: number
) {
  const db = await getDb();
  if (!db) return null;
  const video = await db
    .select()
    .from(sourceVideos)
    .where(
      and(eq(sourceVideos.ownerId, ownerId), eq(sourceVideos.id, sourceVideoId))
    )
    .limit(1);
  if (!video[0]) return null;
  const [jobs, artifacts, candidates] = await Promise.all([
    db
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.ownerId, ownerId),
          eq(processingJobs.sourceVideoId, sourceVideoId)
        )
      )
      .orderBy(desc(processingJobs.createdAt)),
    db
      .select()
      .from(mediaArtifacts)
      .where(
        and(
          eq(mediaArtifacts.ownerId, ownerId),
          eq(mediaArtifacts.sourceVideoId, sourceVideoId)
        )
      )
      .orderBy(desc(mediaArtifacts.createdAt)),
    db
      .select()
      .from(clipCandidates)
      .where(
        and(
          eq(clipCandidates.ownerId, ownerId),
          eq(clipCandidates.sourceVideoId, sourceVideoId)
        )
      )
      .orderBy(desc(clipCandidates.finalScore)),
  ]);
  return { video: video[0], jobs, artifacts, candidates };
}

export async function listRecentJobs(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(processingJobs)
    .where(eq(processingJobs.ownerId, ownerId))
    .orderBy(desc(processingJobs.createdAt))
    .limit(20);
}

export async function createPipelineAlert(input: {
  ownerId: number;
  alertType:
    | "review_ready"
    | "publication_failed"
    | "score_anomaly"
    | "pipeline_failed";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(alerts).values(input);
  const result = await db
    .select()
    .from(alerts)
    .where(
      and(eq(alerts.ownerId, input.ownerId), eq(alerts.title, input.title))
    )
    .orderBy(desc(alerts.createdAt))
    .limit(1);
  return result[0];
}

export function maskIntegrationSecret(value?: string | null) {
  if (!value) return null;
  return value.length <= 8
    ? "••••••••"
    : `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function listIntegrationSettings(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.ownerId, ownerId));
  return rows.map(row => ({
    ...row,
    accessToken: maskIntegrationSecret(row.accessToken),
  }));
}

export async function upsertIntegrationSetting(input: {
  ownerId: number;
  platform: "youtube" | "tiktok" | "instagram";
  accessToken?: string;
  publishEndpoint?: string;
  enabled?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db
    .select()
    .from(integrationSettings)
    .where(
      and(
        eq(integrationSettings.ownerId, input.ownerId),
        eq(integrationSettings.platform, input.platform)
      )
    )
    .limit(1);
  const values = {
    ownerId: input.ownerId,
    platform: input.platform,
    ...(input.accessToken ? { accessToken: input.accessToken } : {}),
    publishEndpoint: input.publishEndpoint ?? null,
    enabled: input.enabled ?? false,
  };
  if (existing[0])
    await db
      .update(integrationSettings)
      .set(values)
      .where(eq(integrationSettings.id, existing[0].id));
  else await db.insert(integrationSettings).values(values);
  const saved = await db
    .select()
    .from(integrationSettings)
    .where(
      and(
        eq(integrationSettings.ownerId, input.ownerId),
        eq(integrationSettings.platform, input.platform)
      )
    )
    .limit(1);
  return saved[0]
    ? { ...saved[0], accessToken: maskIntegrationSecret(saved[0].accessToken) }
    : null;
}

export async function listAlerts(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(alerts)
    .where(eq(alerts.ownerId, ownerId))
    .orderBy(desc(alerts.createdAt))
    .limit(50);
}

export async function markAlertRead(ownerId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(alerts)
    .set({ readAt: new Date() })
    .where(and(eq(alerts.ownerId, ownerId), eq(alerts.id, id)));
  return { success: true };
}

export async function listPublications(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(publications)
    .where(eq(publications.ownerId, ownerId))
    .orderBy(desc(publications.createdAt))
    .limit(50);
}

export async function updateCandidateReview(input: {
  id: number;
  ownerId: number;
  status: "approved" | "rejected";
  rejectionReason?: string;
  suggestedTitle?: string;
  brandKitId?: number;
  templateId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const candidate = await db
    .select()
    .from(clipCandidates)
    .where(
      and(
        eq(clipCandidates.id, input.id),
        eq(clipCandidates.ownerId, input.ownerId)
      )
    )
    .limit(1);
  if (!candidate[0]) return null;
  await db
    .update(clipCandidates)
    .set({
      status: input.status,
      rejectionReason: input.rejectionReason ?? null,
      suggestedTitle: input.suggestedTitle ?? candidate[0].suggestedTitle,
    })
    .where(eq(clipCandidates.id, input.id));
  if (input.status === "approved") {
    await db
      .insert(clips)
      .values({
        candidateId: input.id,
        ownerId: input.ownerId,
        title: input.suggestedTitle ?? candidate[0].suggestedTitle,
        status: "rendering",
      });
    const clip = await db
      .select()
      .from(clips)
      .where(
        and(eq(clips.candidateId, input.id), eq(clips.ownerId, input.ownerId))
      )
      .orderBy(desc(clips.createdAt))
      .limit(1);
    if (clip[0]) {
      await db.insert(processingJobs).values([
        {
          ownerId: input.ownerId,
          sourceVideoId: candidate[0].sourceVideoId,
          candidateId: input.id,
          clipId: clip[0].id,
          jobType: "metadata",
          queueName: "pipeline.llm",
          status: "queued",
          idempotencyKey: `metadata:clip:${clip[0].id}`,
          metadata: {
            brandKitId: input.brandKitId,
            templateId: input.templateId,
          },
        },
        {
          ownerId: input.ownerId,
          sourceVideoId: candidate[0].sourceVideoId,
          candidateId: input.id,
          clipId: clip[0].id,
          jobType: "thumbnail",
          queueName: "pipeline.cpu",
          status: "queued",
          idempotencyKey: `thumbnail:clip:${clip[0].id}`,
          metadata: {
            brandKitId: input.brandKitId,
            templateId: input.templateId,
          },
        },
      ]);
    }
  }
  return { ...candidate[0], status: input.status };
}

export async function saveScoreCalibration(input: {
  ownerId: number;
  weights: { llm: number; vision?: number; audio: number; chat: number };
  sampleSize: number;
  modelVersion?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(scoreCalibrations)
    .values({
      ownerId: input.ownerId,
      weightsJson: input.weights,
      sampleSize: input.sampleSize,
      modelVersion: input.modelVersion ?? "v1",
    });
  const rows = await db
    .select()
    .from(scoreCalibrations)
    .where(eq(scoreCalibrations.ownerId, input.ownerId))
    .orderBy(desc(scoreCalibrations.createdAt))
    .limit(1);
  return rows[0];
}

export async function getLatestScoreCalibration(ownerId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(scoreCalibrations)
    .where(eq(scoreCalibrations.ownerId, ownerId))
    .orderBy(desc(scoreCalibrations.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAnalyticsSummary(ownerId: number) {
  const db = await getDb();
  if (!db)
    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      retention: 0,
      publications: 0,
    };
  const rows = await db
    .select({
      views: sql<number>`coalesce(sum(${metrics.views}), 0)`,
      likes: sql<number>`coalesce(sum(${metrics.likes}), 0)`,
      comments: sql<number>`coalesce(sum(${metrics.comments}), 0)`,
      shares: sql<number>`coalesce(sum(${metrics.shares}), 0)`,
      retention: sql<number>`coalesce(avg(${metrics.retentionRate}), 0)`,
      publications: sql<number>`count(distinct ${publications.id})`,
    })
    .from(metrics)
    .innerJoin(publications, eq(metrics.publicationId, publications.id))
    .where(eq(publications.ownerId, ownerId));
  const row = rows[0];
  return {
    views: Number(row?.views ?? 0),
    likes: Number(row?.likes ?? 0),
    comments: Number(row?.comments ?? 0),
    shares: Number(row?.shares ?? 0),
    retention: Number(row?.retention ?? 0),
    publications: Number(row?.publications ?? 0),
  };
}

export async function updatePipelineJobFromWorker(input: {
  jobId: number;
  sourceVideoId: number;
  ownerId: number;
  jobType: "ingest" | "transcribe" | "detect_highlights" | "render";
  status: "running" | "succeeded" | "failed";
  errorMessage?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const job = await db
    .select()
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.id, input.jobId),
        eq(processingJobs.ownerId, input.ownerId),
        eq(processingJobs.sourceVideoId, input.sourceVideoId)
      )
    )
    .limit(1);
  if (!job[0]) return { updated: false, reason: "job_not_found" };
  await db
    .update(processingJobs)
    .set({
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      startedAt: input.status === "running" ? new Date() : job[0].startedAt,
      completedAt: ["succeeded", "failed"].includes(input.status)
        ? new Date()
        : null,
      updatedAt: new Date(),
    })
    .where(eq(processingJobs.id, input.jobId));
  const nextStatus =
    input.status === "failed"
      ? "failed"
      : input.status === "running"
        ? (
            {
              ingest: "normalizing",
              transcribe: "transcribing",
              vision: "visioning",
              detect_highlights: "detecting",
              render: "rendering",
            } as const
          )[input.jobType]
        : (
            {
              ingest: "transcribing",
              transcribe: "visioning",
              vision: "detecting",
              detect_highlights: "rendering",
              render: "awaiting_review",
            } as const
          )[input.jobType];
  await db
    .update(sourceVideos)
    .set({
      status: nextStatus as any,
      errorMessage: input.errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sourceVideos.id, input.sourceVideoId),
        eq(sourceVideos.ownerId, input.ownerId)
      )
    );
  return { updated: true, status: nextStatus };
}

export async function completeIngestCallback(input: {
  jobId: number;
  sourceVideoId: number;
  ownerId: number;
  idempotencyKey: string;
  normalized?: { storageKey: string; mimeType: string; byteSize: number };
  audio?: { storageKey: string; mimeType: string; byteSize: number };
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const job = await db
    .select()
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.id, input.jobId),
        eq(processingJobs.ownerId, input.ownerId),
        eq(processingJobs.idempotencyKey, input.idempotencyKey)
      )
    )
    .limit(1);
  if (!job[0]) return { updated: false, reason: "job_not_found" };
  if (job[0].status === "succeeded") return { updated: false, duplicate: true };
  if (input.normalized)
    await db
      .insert(mediaArtifacts)
      .values({
        sourceVideoId: input.sourceVideoId,
        ownerId: input.ownerId,
        artifactType: "normalized_video",
        storageKey: input.normalized.storageKey,
        mimeType: input.normalized.mimeType,
        byteSize: input.normalized.byteSize,
        processingVersion: "v1",
      });
  if (input.audio)
    await db
      .insert(mediaArtifacts)
      .values({
        sourceVideoId: input.sourceVideoId,
        ownerId: input.ownerId,
        artifactType: "audio",
        storageKey: input.audio.storageKey,
        mimeType: input.audio.mimeType,
        byteSize: input.audio.byteSize,
        processingVersion: "v1",
      });
  await db
    .update(processingJobs)
    .set({
      status: "succeeded",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(processingJobs.id, input.jobId));
  await db
    .update(sourceVideos)
    .set({ status: "transcribing", updatedAt: new Date() })
    .where(
      and(
        eq(sourceVideos.id, input.sourceVideoId),
        eq(sourceVideos.ownerId, input.ownerId)
      )
    );
  return { updated: true };
}

export async function registerArtifact(input: {
  sourceVideoId: number;
  ownerId: number;
  artifactType:
    | "raw_video"
    | "normalized_video"
    | "audio"
    | "clip"
    | "vertical_clip"
    | "captioned_clip"
    | "thumbnail"
    | "captions";
  storageKey: string;
  mimeType: string;
  byteSize: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(mediaArtifacts).values(input);
  const result = await db
    .select()
    .from(mediaArtifacts)
    .where(
      and(
        eq(mediaArtifacts.ownerId, input.ownerId),
        eq(mediaArtifacts.sourceVideoId, input.sourceVideoId),
        eq(mediaArtifacts.storageKey, input.storageKey)
      )
    )
    .limit(1);
  return result[0];
}

export async function cancelSourceVideoPipeline(
  ownerId: number,
  sourceVideoId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select()
    .from(sourceVideos)
    .where(
      and(eq(sourceVideos.ownerId, ownerId), eq(sourceVideos.id, sourceVideoId))
    )
    .limit(1);
  if (!rows[0]) return null;
  await db
    .update(processingJobs)
    .set({
      status: "cancelled",
      errorMessage: "Cancelado pelo usuário",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(processingJobs.ownerId, ownerId),
        eq(processingJobs.sourceVideoId, sourceVideoId)
      )
    );
  await db
    .update(sourceVideos)
    .set({
      status: "failed",
      errorMessage: "Pipeline cancelado pelo usuário",
      updatedAt: new Date(),
    })
    .where(eq(sourceVideos.id, sourceVideoId));
  return { videoId: sourceVideoId, status: "failed" as const };
}

export async function startSourceVideoPipeline(
  ownerId: number,
  sourceVideoId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select()
    .from(sourceVideos)
    .where(
      and(eq(sourceVideos.ownerId, ownerId), eq(sourceVideos.id, sourceVideoId))
    )
    .limit(1);
  const video = rows[0];
  if (!video) return null;
  const stages = [
    {
      jobType: "ingest" as const,
      queueName: "pipeline.cpu",
      idempotencyKey: `ingest:${sourceVideoId}`,
    },
    {
      jobType: "transcribe" as const,
      queueName: "pipeline.gpu",
      idempotencyKey: `transcribe:${sourceVideoId}`,
    },
    {
      jobType: "vision" as const,
      queueName: "pipeline.cpu",
      idempotencyKey: `vision:${sourceVideoId}`,
    },
    {
      jobType: "detect_highlights" as const,
      queueName: "pipeline.llm",
      idempotencyKey: `detect:${sourceVideoId}`,
    },
    {
      jobType: "render" as const,
      queueName: "pipeline.cpu",
      idempotencyKey: `render:${sourceVideoId}`,
    },
  ];
  for (const stage of stages)
    await db
      .insert(processingJobs)
      .values({
        ownerId,
        sourceVideoId,
        jobType: stage.jobType,
        queueName: stage.queueName,
        status: stage.jobType === "ingest" ? "queued" : "cancelled",
        idempotencyKey: stage.idempotencyKey,
      })
      .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  await db
    .update(sourceVideos)
    .set({ status: "normalizing", errorMessage: null, updatedAt: new Date() })
    .where(eq(sourceVideos.id, sourceVideoId));
  return {
    videoId: sourceVideoId,
    status: "normalizing" as PipelineState,
    stages: stages.map(stage => stage.jobType),
  };
}

export async function createSourceVideo(input: {
  ownerId: number;
  title: string;
  sourceType: SourceType;
  originalUrl?: string;
  idempotencyKey: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(sourceVideos).values({ ...input, status: "uploaded" });
  const result = await db
    .select()
    .from(sourceVideos)
    .where(
      and(
        eq(sourceVideos.ownerId, input.ownerId),
        eq(sourceVideos.idempotencyKey, input.idempotencyKey)
      )
    )
    .limit(1);
  const source = result[0];
  if (source) {
    await db
      .insert(processingJobs)
      .values({
        ownerId: input.ownerId,
        sourceVideoId: source.id,
        jobType: "ingest",
        queueName: "pipeline.cpu",
        status: "queued",
        idempotencyKey: `ingest:${input.idempotencyKey}`,
      })
      .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  }
  return source;
}

export async function listBrandKits(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(brandKits)
    .where(eq(brandKits.ownerId, ownerId))
    .orderBy(desc(brandKits.isDefault), desc(brandKits.createdAt));
}

export async function listCaptionTemplates(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(captionTemplates)
    .where(eq(captionTemplates.ownerId, ownerId))
    .orderBy(desc(captionTemplates.isDefault), desc(captionTemplates.createdAt));
}

export async function upsertBrandKit(input: {
  id?: number;
  ownerId: number;
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  isDefault?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  
  if (input.isDefault) {
    await db.update(brandKits).set({ isDefault: false }).where(eq(brandKits.ownerId, input.ownerId));
  }

  if (input.id) {
    await db.update(brandKits).set(input).where(and(eq(brandKits.id, input.id), eq(brandKits.ownerId, input.ownerId)));
    return input;
  } else {
    await db.insert(brandKits).values(input);
    return input;
  }
}

export async function bulkApproveCandidates(input: {
  ownerId: number;
  candidateIds: number[];
  brandKitId?: number;
  templateId?: number;
}) {
  const results = [];
  for (const id of input.candidateIds) {
    const res = await updateCandidateReview({
      id,
      ownerId: input.ownerId,
      status: "approved",
      brandKitId: input.brandKitId,
      templateId: input.templateId,
    });
    results.push(res);
  }
  return results;
}
