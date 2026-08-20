import { describe, expect, it } from "vitest";
import { combinedHighlightScore, createIdempotencyKey, isValidTransition } from "../shared/pipeline";

describe("pipeline contracts", () => {
  it("combines signals and clamps the result to 0-100", () => {
    expect(combinedHighlightScore({ llm: 90, audio: 70, chat: 50 })).toBe(78);
    expect(combinedHighlightScore({ llm: 200, audio: 200, chat: 200 })).toBe(100);
    expect(combinedHighlightScore({ llm: -20 })).toBe(0);
  });

  it("accepts only forward pipeline transitions", () => {
    expect(isValidTransition("uploaded", "normalizing")).toBe(true);
    expect(isValidTransition("awaiting_review", "approved")).toBe(true);
    expect(isValidTransition("published", "uploaded")).toBe(false);
    expect(isValidTransition("rendering", "published")).toBe(false);
  });

  it("creates stable safe idempotency keys", () => {
    expect(createIdempotencyKey(["render", 12, "clip/2"])).toBe("render:12:clip-2");
  });
});
