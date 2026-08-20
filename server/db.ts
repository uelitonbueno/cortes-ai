import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  alerts,
  clipCandidates,
  clips,
  InsertUser,
  metrics,
  mediaArtifacts,
  processingJobs,
  publications,
  sourceVideos,
  users,
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
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getPipelineOverview(ownerId: number) {
  const db = await getDb();
  if (!db) return { videos: 0, review: 0, scheduled: 0, published: 0, failedJobs: 0 };
  const [videoCount, reviewCount, scheduledCount, publishedCount, failedCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(sourceVideos).where(eq(sourceVideos.ownerId, ownerId)),
    db.select({ count: sql<number>`count(*)` }).from(clipCandidates).where(and(eq(clipCandidates.ownerId, ownerId), eq(clipCandidates.status, "candidate"))),
    db.select({ count: sql<number>`count(*)` }).from(publications).where(and(eq(publications.ownerId, ownerId), eq(publications.status, "scheduled"))),
    db.select({ count: sql<number>`count(*)` }).from(publications).where(and(eq(publications.ownerId, ownerId), eq(publications.status, "published"))),
    db.select({ count: sql<number>`count(*)` }).from(processingJobs).where(and(eq(processingJobs.ownerId, ownerId), eq(processingJobs.status, "failed"))),
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
  return db.select().from(sourceVideos).where(eq(sourceVideos.ownerId, ownerId)).orderBy(desc(sourceVideos.createdAt)).limit(50);
}

export async function listReviewCandidates(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clipCandidates).where(and(eq(clipCandidates.ownerId, ownerId), eq(clipCandidates.status, "candidate"))).orderBy(desc(clipCandidates.finalScore), desc(clipCandidates.createdAt)).limit(50);
}

export async function getPipelineDetail(ownerId: number, sourceVideoId: number) {
  const db = await getDb();
  if (!db) return null;
  const video = await db.select().from(sourceVideos).where(and(eq(sourceVideos.ownerId, ownerId), eq(sourceVideos.id, sourceVideoId))).limit(1);
  if (!video[0]) return null;
  const [jobs, artifacts, candidates] = await Promise.all([
    db.select().from(processingJobs).where(and(eq(processingJobs.ownerId, ownerId), eq(processingJobs.sourceVideoId, sourceVideoId))).orderBy(desc(processingJobs.createdAt)),
    db.select().from(mediaArtifacts).where(and(eq(mediaArtifacts.ownerId, ownerId), eq(mediaArtifacts.sourceVideoId, sourceVideoId))).orderBy(desc(mediaArtifacts.createdAt)),
    db.select().from(clipCandidates).where(and(eq(clipCandidates.ownerId, ownerId), eq(clipCandidates.sourceVideoId, sourceVideoId))).orderBy(desc(clipCandidates.finalScore)),
  ]);
  return { video: video[0], jobs, artifacts, candidates };
}

export async function listRecentJobs(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(processingJobs).where(eq(processingJobs.ownerId, ownerId)).orderBy(desc(processingJobs.createdAt)).limit(20);
}

export async function listPublications(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(publications).where(eq(publications.ownerId, ownerId)).orderBy(desc(publications.createdAt)).limit(50);
}

export async function updateCandidateReview(input: {
  id: number;
  ownerId: number;
  status: "approved" | "rejected";
  rejectionReason?: string;
  suggestedTitle?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const candidate = await db.select().from(clipCandidates).where(and(eq(clipCandidates.id, input.id), eq(clipCandidates.ownerId, input.ownerId))).limit(1);
  if (!candidate[0]) return null;
  await db.update(clipCandidates).set({ status: input.status, rejectionReason: input.rejectionReason ?? null, suggestedTitle: input.suggestedTitle ?? candidate[0].suggestedTitle }).where(eq(clipCandidates.id, input.id));
  if (input.status === "approved") {
    await db.insert(clips).values({ candidateId: input.id, ownerId: input.ownerId, title: input.suggestedTitle ?? candidate[0].suggestedTitle, status: "ready" });
  }
  return { ...candidate[0], status: input.status };
}

export async function getAnalyticsSummary(ownerId: number) {
  const db = await getDb();
  if (!db) return { views: 0, likes: 0, comments: 0, shares: 0, retention: 0, publications: 0 };
  const rows = await db.select({ views: sql<number>`coalesce(sum(${metrics.views}), 0)`, likes: sql<number>`coalesce(sum(${metrics.likes}), 0)`, comments: sql<number>`coalesce(sum(${metrics.comments}), 0)`, shares: sql<number>`coalesce(sum(${metrics.shares}), 0)`, retention: sql<number>`coalesce(avg(${metrics.retentionRate}), 0)`, publications: sql<number>`count(distinct ${publications.id})` }).from(metrics).innerJoin(publications, eq(metrics.publicationId, publications.id)).where(eq(publications.ownerId, ownerId));
  const row = rows[0];
  return { views: Number(row?.views ?? 0), likes: Number(row?.likes ?? 0), comments: Number(row?.comments ?? 0), shares: Number(row?.shares ?? 0), retention: Number(row?.retention ?? 0), publications: Number(row?.publications ?? 0) };
}

export async function createSourceVideo(input: { ownerId: number; title: string; sourceType: "upload" | "youtube" | "twitch" | "live"; originalUrl?: string; idempotencyKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(sourceVideos).values({ ...input, status: "uploaded" });
  const result = await db.select().from(sourceVideos).where(and(eq(sourceVideos.ownerId, input.ownerId), eq(sourceVideos.idempotencyKey, input.idempotencyKey))).limit(1);
  return result[0];
}
