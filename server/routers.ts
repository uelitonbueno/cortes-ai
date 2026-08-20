import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createSourceVideo,
  getAnalyticsSummary,
  getPipelineDetail,
  getPipelineOverview,
  listPublications,
  listRecentJobs,
  listReviewCandidates,
  listSourceVideos,
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
  analytics: router({
    summary: protectedProcedure.query(({ ctx }) => getAnalyticsSummary(ctx.user.id)),
  }),
  ai: router({
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
