import Redis from "ioredis";
import { QUEUES } from "../shared/pipeline";

let client: Redis | null = null;

function getRedis() {
  if (!process.env.REDIS_URL) return null;
  client ??= new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
  return client;
}

export async function enqueueJob(input: {
  queue: keyof typeof QUEUES;
  payload: unknown;
  idempotencyKey: string;
}) {
  const redis = getRedis();
  if (!redis)
    return {
      queued: false,
      reason: "REDIS_URL_not_configured",
      queue: QUEUES[input.queue],
    };
  const key = `cortes:queue:idempotency:${input.idempotencyKey}`;
  const created = await redis.set(key, "queued", "EX", 86400, "NX");
  if (!created)
    return { queued: false, duplicate: true, queue: QUEUES[input.queue] };
  await redis.rpush(QUEUES[input.queue], JSON.stringify(input.payload));
  return { queued: true, queue: QUEUES[input.queue] };
}
