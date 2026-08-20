import type { Request, Response } from "express";
import { Buffer } from "node:buffer";
import { storagePut } from "./storage";
import { z } from "zod";
import { completeIngestCallback, updatePipelineJobFromWorker } from "./db";

const payloadSchema = z.object({
  jobId: z.number().int().positive(),
  sourceVideoId: z.number().int().positive(),
  ownerId: z.number().int().positive(),
  jobType: z
    .enum(["ingest", "transcribe", "detect_highlights", "render"])
    .default("ingest"),
  status: z.enum(["running", "succeeded", "failed"]).default("succeeded"),
  errorMessage: z.string().optional(),
  idempotencyKey: z.string().min(8).max(160),
  normalizedBase64: z.string().optional(),
  audioBase64: z.string().optional(),
  normalizedBytes: z.number().int().nonnegative().optional(),
  audioBytes: z.number().int().nonnegative().optional(),
});

export async function pipelineCallback(req: Request, res: Response) {
  try {
    const expected = process.env.PIPELINE_CALLBACK_TOKEN;
    if (!expected || req.header("x-pipeline-token") !== expected)
      return res.status(401).json({ error: "invalid_callback_token" });
    const payload = payloadSchema.parse(req.body);
    const result = await updatePipelineJobFromWorker(payload);
    if (payload.jobType === "ingest" && payload.status === "succeeded") {
      const normalized = payload.normalizedBase64
        ? await storagePut(
            `owners/${payload.ownerId}/sources/${payload.sourceVideoId}/normalized.mp4`,
            Buffer.from(payload.normalizedBase64, "base64"),
            "video/mp4"
          )
        : null;
      const audio = payload.audioBase64
        ? await storagePut(
            `owners/${payload.ownerId}/sources/${payload.sourceVideoId}/audio.wav`,
            Buffer.from(payload.audioBase64, "base64"),
            "audio/wav"
          )
        : null;
      const ingest = await completeIngestCallback({
        ...payload,
        normalized: normalized
          ? {
              storageKey: normalized.key,
              mimeType: "video/mp4",
              byteSize: payload.normalizedBytes ?? 0,
            }
          : undefined,
        audio: audio
          ? {
              storageKey: audio.key,
              mimeType: "audio/wav",
              byteSize: payload.audioBytes ?? 0,
            }
          : undefined,
      });
      return res.json({ ok: true, ...result, ...ingest });
    }
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res
      .status(400)
      .json({
        error: error instanceof Error ? error.message : "invalid_callback",
      });
  }
}
