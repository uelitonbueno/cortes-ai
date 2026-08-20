import { describe, expect, it } from "vitest";
import Redis from "ioredis";

describe("Redis queue configuration", () => {
  it("connects with REDIS_URL when configured", async () => {
    const url = process.env.REDIS_URL;
    if (!url) {
      expect(url).toBeTruthy();
      return;
    }
    const redis = new Redis(url, { lazyConnect: true, connectTimeout: 1500, maxRetriesPerRequest: 1, enableOfflineQueue: false });
    try {
      await redis.connect();
      expect(await redis.ping()).toBe("PONG");
    } finally {
      redis.disconnect();
    }
  }, 5000);
});
