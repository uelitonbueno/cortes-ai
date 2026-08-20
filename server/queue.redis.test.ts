import { describe, expect, it } from "vitest";
import Redis from "ioredis";
import { QUEUES } from "../shared/pipeline";
import { enqueueJob } from "./queue";

const redisUrl = process.env.REDIS_URL ?? "";

describe("Redis queue configuration", () => {
  it("connects with REDIS_URL when configured", async () => {
    if (!redisUrl) {
      return;
    }
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    try {
      await redis.connect();
      expect(await redis.ping()).toBe("PONG");
    } finally {
      redis.disconnect();
    }
  }, 5000);
});

describe("job enqueue with idempotency", () => {
  it("reports reason when REDIS_URL is not configured", async () => {
    if (redisUrl) {
      return;
    }
    const result = await enqueueJob({
      queue: "cpu",
      idempotencyKey: "local-only:check",
      payload: { probe: true },
    });
    expect(result).toMatchObject({
      queued: false,
      reason: "REDIS_URL_not_configured",
      queue: QUEUES.cpu,
    });
  });

  it("enqueues once and deduplicates identical idempotency keys", async () => {
    if (!redisUrl) {
      return;
    }
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    await redis.connect();
    const queueName = QUEUES.cpu;
    await redis.del(queueName);
    try {
      const key = `queue:local:dedup:${Date.now()}`;
      const first = await enqueueJob({
        queue: "cpu",
        idempotencyKey: key,
        payload: { id: 1 },
      });
      const second = await enqueueJob({
        queue: "cpu",
        idempotencyKey: key,
        payload: { id: 1 },
      });
      const third = await enqueueJob({
        queue: "cpu",
        idempotencyKey: `${key}:2`,
        payload: { id: 2 },
      });
      expect(first).toMatchObject({ queued: true });
      expect(second).toMatchObject({ queued: false, duplicate: true });
      expect(third).toMatchObject({ queued: true });
      expect(await redis.llen(queueName)).toBe(2);
    } finally {
      await redis.del(queueName);
      redis.disconnect();
    }
  }, 5000);
});
