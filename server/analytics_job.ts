
import { getDb, getLatestScoreCalibration, saveScoreCalibration } from "./db";
import { metrics, publications, clipCandidates } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { recalibrateWeights } from "../shared/analytics";

export async function runAnalyticsRecalibration(ownerId: number) {
  const db = await getDb();
  if (!db) return { success: false, reason: "database_unavailable" };

  // 1. Buscar observações reais (predição vs retenção/aprovação)
  const observations = await db
    .select({
      predictedScore: clipCandidates.finalScore,
      retentionRate: sql<number>`coalesce(${metrics.retentionRate}, 0)`,
      approved: sql<boolean>`${clipCandidates.status} = 'approved'`,
    })
    .from(clipCandidates)
    .innerJoin(publications, eq(clipCandidates.id, publications.clipId))
    .innerJoin(metrics, eq(publications.id, metrics.publicationId))
    .where(eq(clipCandidates.ownerId, ownerId))
    .limit(100);

  if (observations.length < 10) {
    return { success: false, reason: "insufficient_data", count: observations.length };
  }

  // 2. Buscar pesos atuais
  const latestCalibration = await getLatestScoreCalibration(ownerId);
  const currentWeights = (latestCalibration?.weightsJson as any) || {
    llm: 0.5,
    vision: 0.2,
    audio: 0.15,
    chat: 0.15,
  };

  // 3. Recalibrar
  const newWeights = recalibrateWeights(observations, currentWeights);

  // 4. Salvar nova calibração
  await saveScoreCalibration({
    ownerId,
    weights: newWeights,
    sampleSize: observations.length,
    modelVersion: "v1-auto",
  });

  return { success: true, newWeights, sampleSize: observations.length };
}
