import type { Request, Response } from "express";
import { z } from "zod";
import { completeIngestCallback } from "./db";

const payloadSchema = z.object({ jobId: z.number().int().positive(), sourceVideoId: z.number().int().positive(), ownerId: z.number().int().positive(), idempotencyKey: z.string().min(8).max(160), normalized: z.object({ storageKey: z.string().min(1), mimeType: z.string(), byteSize: z.number().int().nonnegative() }).optional(), audio: z.object({ storageKey: z.string().min(1), mimeType: z.string(), byteSize: z.number().int().nonnegative() }).optional() });

export async function pipelineCallback(req: Request, res: Response) {
  try {
    const expected = process.env.PIPELINE_CALLBACK_TOKEN;
    if (!expected || req.header("x-pipeline-token") !== expected) return res.status(401).json({ error: "invalid_callback_token" });
    const payload = payloadSchema.parse(req.body);
    const result = await completeIngestCallback(payload);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "invalid_callback" });
  }
}
