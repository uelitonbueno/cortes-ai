import { describe, expect, it } from "vitest";
import { validateGeneratedMetadata } from "../shared/content";
import { createPublishRequest } from "./platforms";
import { recalibrateWeights } from "../shared/analytics";
import {
  platformCredentialKey,
  publishWithConnector,
} from "./platform-connectors";
import {
  buildAssKaraoke,
  combinedHighlightScore,
  createIdempotencyKey,
  createVerticalRenderRequest,
  isPublicationAllowed,
  isValidTransition,
  removeOverlappingCandidates,
  splitTranscriptWindows,
  verticalRenderFilter,
} from "../shared/pipeline";

describe("pipeline contracts", () => {
  it("combines signals and clamps the result to 0-100", () => {
    // Pesos: llm: 0.5, vision: 0.2, audio: 0.15, chat: 0.15
    // 90*0.5 + 0*0.2 + 70*0.15 + 50*0.15 = 45 + 0 + 10.5 + 7.5 = 63
    expect(combinedHighlightScore({ llm: 90, audio: 70, chat: 50 })).toBe(63);
    expect(
      combinedHighlightScore({ llm: 90, vision: 80, audio: 70, chat: 50 })
    ).toBe(79);
    expect(combinedHighlightScore({ llm: 200, audio: 200, chat: 200 })).toBe(
      100
    );
    expect(combinedHighlightScore({ llm: -20 })).toBe(0);
  });

  it("accepts only forward pipeline transitions", () => {
    expect(isValidTransition("uploaded", "normalizing")).toBe(true);
    expect(isValidTransition("awaiting_review", "approved")).toBe(true);
    expect(isValidTransition("published", "uploaded")).toBe(false);
    expect(isValidTransition("rendering", "published")).toBe(false);
  });

  it("creates stable safe idempotency keys", () => {
    expect(createIdempotencyKey(["render", 12, "clip/2"])).toBe(
      "render:12:clip-2"
    );
  });

  it("splits transcript windows with overlap", () => {
    const segments = Array.from({ length: 4 }, (_, index) => ({
      id: index,
      start: index * 600,
      end: index * 600 + 500,
      text: `segment ${index}`,
      words: [],
    }));
    const windows = splitTranscriptWindows(segments, 900, 120);
    expect(windows.length).toBeGreaterThan(1);
    expect(windows[0]?.[0]?.id).toBe(0);
  });

  it("keeps only the highest scoring overlapping candidate", () => {
    const result = removeOverlappingCandidates([
      { start: 0, end: 60, finalScore: 90, category: "educativo" },
      { start: 20, end: 80, finalScore: 70, category: "curioso" },
      { start: 100, end: 150, finalScore: 80, category: "engraçado" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]?.finalScore).toBe(90);
  });

  it("builds word-level ASS karaoke events", () => {
    const ass = buildAssKaraoke([
      { word: "Olá", start: 0, end: 0.5 },
      { word: "mundo", start: 0.5, end: 1.2 },
    ]);
    expect(ass).toContain("\\k50Olá");
    expect(ass).toContain("\\k70mundo");
  });

  it("creates a 9:16 render contract and ffmpeg filter", () => {
    const request = createVerticalRenderRequest({
      sourceArtifactKey: "input.mp4",
      outputArtifactKey: "vertical.mp4",
      startSeconds: 10,
      endSeconds: 50,
      cropMode: "center",
    });
    expect(request.width).toBe(1080);
    expect(request.height).toBe(1920);
    expect(verticalRenderFilter(request)).toContain("scale=1080:1920");
  });

  it("normalizes generated metadata to platform-safe limits", () => {
    const result = validateGeneratedMetadata({
      titles: ["  título longo ".repeat(10)],
      description: " descrição ".repeat(100),
      hashtags: ["#cortes", "#cortes", "ia"],
      thumbnailText: "texto chamativo",
    });
    expect(result.titles[0]?.length).toBeLessThanOrEqual(60);
    expect(result.description.length).toBeLessThanOrEqual(500);
    expect(result.hashtags).toEqual(["#cortes", "ia"]);
    expect(result.thumbnailText).toBe("TEXTO CHAMATIVO");
  });

  it("blocks publication when connector credentials are missing", async () => {
    delete process.env.YOUTUBE_ACCESS_TOKEN;
    delete process.env.YOUTUBE_PUBLISH_ENDPOINT;
    await expect(
      publishWithConnector({
        platform: "youtube",
        clipId: 7,
        mediaUrl: "https://storage.example/clip.mp4",
        title: "Corte",
        description: "Descrição",
        hashtags: [],
        scheduledAt: new Date("2026-08-20T11:00:00Z"),
      })
    ).rejects.toThrow("YOUTUBE_ACCESS_TOKEN is not configured");
  });

  it("maps every publication platform to an isolated credential", () => {
    expect(platformCredentialKey("youtube")).toBe("YOUTUBE_ACCESS_TOKEN");
    expect(platformCredentialKey("tiktok")).toBe("TIKTOK_ACCESS_TOKEN");
    expect(platformCredentialKey("instagram")).toBe("INSTAGRAM_ACCESS_TOKEN");
  });

  it("recalibrates weights only with sufficient observations", () => {
    const current = { llm: 0.6, audio: 0.2, chat: 0.2 };
    expect(
      recalibrateWeights(
        [{ predictedScore: 80, retentionRate: 80, approved: true }],
        current
      )
    ).toEqual(current);
    const observations = Array.from({ length: 10 }, () => ({
      predictedScore: 80,
      retentionRate: 90,
      approved: true,
    }));
    const result = recalibrateWeights(observations, current);
    expect(result.llm).toBeGreaterThan(current.llm);
    expect(result.llm + result.audio + result.chat).toBeCloseTo(1);
  });

  it("creates idempotent scheduled publication requests", () => {
    const result = createPublishRequest({
      platform: "youtube",
      clipId: 7,
      mediaUrl: "https://storage.example/clip.mp4",
      title: "Corte",
      description: "Descrição",
      hashtags: ["#shorts"],
      scheduledAt: new Date("2026-08-20T11:00:00Z"),
      lastScheduledAt: new Date("2026-08-20T09:00:00Z"),
    });
    expect(result.status).toBe("scheduled");
    expect(result.idempotencyKey).toContain("youtube:7");
  });

  it("enforces a minimum publication gap", () => {
    const last = new Date("2026-08-20T10:00:00Z");
    expect(
      isPublicationAllowed(last, new Date("2026-08-20T10:30:00Z"), 60)
    ).toBe(false);
    expect(
      isPublicationAllowed(last, new Date("2026-08-20T11:00:00Z"), 60)
    ).toBe(true);
  });
});
