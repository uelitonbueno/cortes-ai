import { describe, expect, it } from "vitest";
import { calculatePerformanceScore } from "./performanceScore";

describe("calculatePerformanceScore", () => {
  it("uses the editorial score when there are no collected metrics", () => {
    expect(calculatePerformanceScore({ editorialScore: 82 })).toBe(82);
  });

  it("increases ranking with strong real-world performance signals", () => {
    const score = calculatePerformanceScore({ editorialScore: 70, views: 1_000_000, likes: 100_000, comments: 10_000, shares: 5_000, retentionRate: 95 });
    expect(score).toBeGreaterThan(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("does not invent engagement when values are absent or zero", () => {
    expect(calculatePerformanceScore({ editorialScore: 40, views: 0, likes: 0, comments: 0, shares: 0, retentionRate: 0 })).toBeLessThan(50);
  });
});
