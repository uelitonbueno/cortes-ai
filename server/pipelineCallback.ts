import type { Request, Response } from "express";
import { z } from "zod";
import { completeIngestCallback, updatePipelineJobFromWorker } from "./db";

const payloadSchema = z.object({ jobId: z.number().int().positive(), sourceVideoId: z.number().int().positive(), ownerId: z.number().int().positive(), jobType: z.enum(["ingest", "transcribe", "detect_highlights", "render"]).default("ingest"), status: z.enum(["running", "succeeded", "failed"]).default("succeeded"), errorMessage: z.string().optional(), idempotencyKey: z.string().min(8).max(160), normalized: z.object({ storageKey: z.string().min(1), mimeType: z.string(), byteSize: z.number().int().nonnegative() }).optional(), audio: z.object({ storageKey: z.string().min(1), mimeType: z.string(), byteSize: z.number().int().nonnegative() }).optional() });

export async function pipelineCallback(req: Request, res: Response) {
  try {
    const expected = process.env.PIPELINE_CALLBACK_TOKEN;
    if (!expected || req.header("x-pipeline-token") !== expected) return res.status(401).json({ error: "invalid_callback_token" });
    const payload = payloadSchema.parse(req.body);
    const result = await updatePipelineJobFromWorker(payload);
    if (payload.jobType === "ingest" && payload.status === "succeeded") {
      const ingest = await completeIngestCallback(payload);
      return res.json({ ok: true, ...result, ...ingest });
    }
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "invalid_callback" });
  }
}
