import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl, storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { generateClipMetadata } from "./metadata";
import { enqueueJob } from "./queue";
import { sanitizeStorageFileName } from "../shared/storage";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createPipelineAlert,
  cancelSourceVideoPipeline,
  createSourceVideo,
  getAnalyticsSummary,
  getLatestScoreCalibration,
  getPipelineDetail,
  getPipelineOverview,
  listAlerts,
  listIntegrationSettings,
  listPublications,
  upsertIntegrationSetting,
  markAlertRead,
  registerArtifact,
  listRecentJobs,
  listReviewCandidates,
  listSourceVideos,
  startSourceVideoPipeline,
  updateCandidateReview,
} from "./db";

const platformSchema = z.enum(["youtube", "tiktok", "instagram"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    overview: protectedProcedure.query(({ ctx }) => getPipelineOverview(ctx.user.id)),
    jobs: protectedProcedure.query(({ ctx }) => listRecentJobs(ctx.user.id)),
  }),
  videos: router({
    list: protectedProcedure.query(({ ctx }) => listSourceVideos(ctx.user.id)),
    register: protectedProcedure.input(z.object({ title: z.string().min(2).max(255), sourceType: z.enum(["upload", "youtube", "twitch", "live"]).default("upload"), originalUrl: z.string().url().optional(), idempotencyKey: z.string().min(8).max(128) })).mutation(({ ctx, input }) => createSourceVideo({ ...input, ownerId: ctx.user.id })),
    upload: protectedProcedure.input(z.object({ title: z.string().min(2).max(255), fileName: z.string().min(1).max(160), mimeType: z.string().startsWith("video/"), contentBase64: z.string().max(8_000_000), idempotencyKey: z.string().min(8).max(128) })).mutation(async ({ ctx, input }) => {
      const source = await createSourceVideo({ ownerId: ctx.user.id, title: input.title, sourceType: "upload", idempotencyKey: input.idempotencyKey });
      if (!source) throw new Error("Não foi possível registrar o vídeo");
      const content = Buffer.from(input.contentBase64, "base64");
      if (content.byteLength > 6 * 1024 * 1024) throw new Error("Arquivo acima do limite da primeira versão");
      const safeFileName = sanitizeStorageFileName(input.fileName);
      const stored = await storagePut(`owners/${ctx.user.id}/sources/${source.id}/${safeFileName}`, content, input.mimeType);
      const artifact = await registerArtifact({ sourceVideoId: source.id, ownerId: ctx.user.id, artifactType: "raw_video", storageKey: stored.key, mimeType: input.mimeType, byteSize: content.byteLength });
      const sourceUrl = await storageGetSignedUrl(stored.key);
      const queue = await enqueueJob({ queue: "cpu", idempotencyKey: `ingest:${source.id}:${input.idempotencyKey}`, payload: { job_id: source.id, source_video_id: source.id, source_url: sourceUrl, callback_url: `${process.env.PUBLIC_APP_URL ?? "http://localhost"}/api/pipeline/callback`, idempotency_key: `ingest:${source.id}:${input.idempotencyKey}` } });
      return { source, artifact, queue };
    }),
    start: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await startSourceVideoPipeline(ctx.user.id, input.id);
      if (!result) return null;
      for (const stage of result.stages) {
        const queue = stage === "transcribe" ? "gpu" : stage === "detect_highlights" ? "llm" : "cpu";
        await enqueueJob({ queue, idempotencyKey: `${stage}:${result.videoId}`, payload: { source_video_id: result.videoId, job_type: stage, owner_id: ctx.user.id, callback_url: `${process.env.PUBLIC_APP_URL ?? "http://localhost"}/api/pipeline/callback` } });
      }
      return result;
    }),
    cancel: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => cancelSourceVideoPipeline(ctx.user.id, input.id)),
    retry: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await startSourceVideoPipeline(ctx.user.id, input.id);
      if (!result) return null;
      for (const stage of result.stages) {
        const queue = stage === "transcribe" ? "gpu" : stage === "detect_highlights" ? "llm" : "cpu";
        await enqueueJob({ queue, idempotencyKey: `${stage}:${result.videoId}:retry`, payload: { source_video_id: result.videoId, job_type: stage, owner_id: ctx.user.id, callback_url: `${process.env.PUBLIC_APP_URL ?? "http://localhost"}/api/pipeline/callback` } });
      }
      return result;
    }),
    detail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const detail = await getPipelineDetail(ctx.user.id, input.id);
      if (!detail) return null;
      const artifacts = await Promise.all(detail.artifacts.map(async artifact => ({ ...artifact, signedUrl: await storageGetSignedUrl(artifact.storageKey) })));
      return { ...detail, artifacts };
    }),
  }),
  review: router({
    list: protectedProcedure.query(({ ctx }) => listReviewCandidates(ctx.user.id)),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]), rejectionReason: z.string().max(80).optional(), suggestedTitle: z.string().max(255).optional() })).mutation(({ ctx, input }) => updateCandidateReview({ ...input, ownerId: ctx.user.id })),
  }),
  publications: router({
    list: protectedProcedure.query(({ ctx }) => listPublications(ctx.user.id)),
    platforms: protectedProcedure.query(() => platformSchema.options),
  }),
  pipeline: router({
    reportEvent: protectedProcedure.input(z.object({ event: z.enum(["review_ready", "publication_failed", "score_anomaly", "pipeline_failed"]), entityType: z.string().max(40).optional(), entityId: z.number().int().positive().optional(), title: z.string().min(3).max(255), message: z.string().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
      const severity = input.event === "pipeline_failed" || input.event === "publication_failed" ? "critical" : input.event === "score_anomaly" ? "warning" : "info";
      const alert = await createPipelineAlert({ ownerId: ctx.user.id, alertType: input.event, severity, title: input.title, message: input.message, entityType: input.entityType, entityId: input.entityId });
      await notifyOwner({ title: input.title, content: input.message });
      return alert;
    }),
  }),
  integrations: router({
    list: protectedProcedure.query(({ ctx }) => listIntegrationSettings(ctx.user.id)),
    save: protectedProcedure.input(z.object({ platform: z.enum(["youtube", "tiktok", "instagram"]), accessToken: z.string().max(10000).optional(), publishEndpoint: z.string().url().optional().or(z.literal("")), enabled: z.boolean().default(false) })).mutation(({ ctx, input }) => upsertIntegrationSetting({ ...input, publishEndpoint: input.publishEndpoint || undefined, ownerId: ctx.user.id })),
  }),
  alerts: router({
    list: protectedProcedure.query(({ ctx }) => listAlerts(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => markAlertRead(ctx.user.id, input.id)),
  }),
  analytics: router({
    summary: protectedProcedure.query(({ ctx }) => getAnalyticsSummary(ctx.user.id)),
    latestCalibration: protectedProcedure.query(({ ctx }) => getLatestScoreCalibration(ctx.user.id)),
  }),
  ai: router({
    generateMetadata: protectedProcedure.input(z.object({ transcript: z.string().min(20).max(30000), category: z.string().max(40) })).mutation(({ input }) => generateClipMetadata(input.transcript, input.category)),
    detectHighlightsPreview: protectedProcedure.input(z.object({ transcriptChunk: z.string().min(20).max(30000), language: z.string().default("pt-BR") })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é editor especialista em cortes virais. Retorne apenas candidatos autocontidos, sem inventar contexto." },
          { role: "user", content: `Analise esta transcrição em ${input.language}. Encontre trechos de 20 a 90 segundos com gancho, arco narrativo e reação emocional.\n\n${input.transcriptChunk}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "highlight_candidates",
            strict: true,
            schema: {
              type: "object",
              properties: {
                candidates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      start: { type: "number" },
                      end: { type: "number" },
                      category: { type: "string" },
                      viral_score: { type: "number" },
                      hook_text: { type: "string" },
                      reasoning: { type: "string" },
                      suggested_title: { type: "string" },
                    },
                    required: ["start", "end", "category", "viral_score", "hook_text", "reasoning", "suggested_title"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["candidates"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = response.choices?.[0]?.message?.content;
      if (typeof content !== "string") return { candidates: [] };
      try {
        return z.object({ candidates: z.array(z.object({ start: z.number(), end: z.number(), category: z.string(), viral_score: z.number(), hook_text: z.string(), reasoning: z.string(), suggested_title: z.string() })) }).parse(JSON.parse(content));
      } catch {
        return { candidates: [] };
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
