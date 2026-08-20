import { getPipelineDetail } from "../server/db.ts";
import { storageGetSignedUrl } from "../server/storage.ts";
import { enqueueJob } from "../server/queue.ts";
import Redis from "ioredis";

const ownerId = Number(process.argv[2] ?? 1);
const sourceVideoId = Number(process.argv[3] ?? 30001);
const detail = await getPipelineDetail(ownerId, sourceVideoId);
const raw = detail?.artifacts.find(
  artifact => artifact.artifactType === "raw_video"
);
if (!raw) throw new Error(`raw_video artifact not found for ${sourceVideoId}`);
const sourceUrl = await storageGetSignedUrl(raw.storageKey);
const redis = new Redis(process.env.REDIS_URL);
await redis.del("pipeline.cpu");
const idempotencyKey = `ingest:${sourceVideoId}:worker-retry`;
const payload = {
  job_id: sourceVideoId,
  source_video_id: sourceVideoId,
  owner_id: ownerId,
  source_url: sourceUrl,
  callback_url: "http://localhost:3000/api/pipeline/callback",
  idempotency_key: idempotencyKey,
};
const result = await enqueueJob({ queue: "cpu", idempotencyKey, payload });
console.log(
  JSON.stringify(
    { sourceVideoId, queue: result, artifactKey: raw.storageKey },
    null,
    2
  )
);
await redis.quit();
