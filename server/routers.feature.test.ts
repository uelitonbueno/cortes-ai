import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSourceVideo: vi.fn(),
  updateCandidateReview: vi.fn(),
  listIntegrationSettings: vi.fn(),
  upsertIntegrationSetting: vi.fn(),
  startSourceVideoPipeline: vi.fn(),
  cancelSourceVideoPipeline: vi.fn(),
  getPipelineDetail: vi.fn(),
  enqueueJob: vi.fn(),
}));
const { createSourceVideo, updateCandidateReview } = mocks;

vi.mock("./db", () => ({
  createSourceVideo: mocks.createSourceVideo,
  updateCandidateReview: mocks.updateCandidateReview,
  listIntegrationSettings: mocks.listIntegrationSettings,
  upsertIntegrationSetting: mocks.upsertIntegrationSetting,
  startSourceVideoPipeline: mocks.startSourceVideoPipeline,
  cancelSourceVideoPipeline: mocks.cancelSourceVideoPipeline,
  getAnalyticsSummary: vi.fn(),
  getPipelineDetail: mocks.getPipelineDetail,
  getPipelineOverview: vi.fn(),
  listAlerts: vi.fn(),
  listPublications: vi.fn(),
  listRecentJobs: vi.fn(),
  listReviewCandidates: vi.fn(),
  listSourceVideos: vi.fn(),
  markAlertRead: vi.fn(),
  registerArtifact: vi.fn(),
  createPipelineAlert: vi.fn(),
}));
vi.mock("./queue", () => ({ enqueueJob: mocks.enqueueJob }));
vi.mock("./storage", () => ({
  storagePut: vi
    .fn()
    .mockResolvedValue({
      key: "owners/22/raw.mp4",
      url: "/manus-storage/owners/22/raw.mp4",
    }),
  storageGetSignedUrl: vi
    .fn()
    .mockResolvedValue("https://signed.example/owners/22/raw.mp4"),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(): TrpcContext {
  return {
    user: {
      id: 22,
      openId: "feature-user",
      name: "Ueliton",
      email: "ueliton@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("feature mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPipelineDetail.mockResolvedValue({
      video: { id: 3, sourceType: "upload" },
      artifacts: [
        { artifactType: "raw_video", storageKey: "owners/22/raw.mp4" },
      ],
    });
    mocks.enqueueJob.mockResolvedValue({ queued: true });
  });

  it("registers a source video for the authenticated owner", async () => {
    createSourceVideo.mockResolvedValue({
      id: 3,
      ownerId: 22,
      title: "Podcast",
      status: "uploaded",
    });
    const result = await appRouter
      .createCaller(context())
      .videos.register({
        title: "Podcast",
        sourceType: "upload",
        idempotencyKey: "register-12345",
      });
    expect(createSourceVideo).toHaveBeenCalledWith({
      ownerId: 22,
      title: "Podcast",
      sourceType: "upload",
      idempotencyKey: "register-12345",
    });
    expect(result?.id).toBe(3);
  });

  it("starts and cancels a pipeline for the authenticated owner", async () => {
    mocks.startSourceVideoPipeline.mockResolvedValue({
      videoId: 3,
      status: "normalizing",
      stages: ["ingest", "transcribe", "vision", "detect_highlights", "render"],
    });
    mocks.cancelSourceVideoPipeline.mockResolvedValue({
      videoId: 3,
      status: "failed",
    });
    const caller = appRouter.createCaller(context());
    expect(await caller.videos.start({ id: 3 })).toMatchObject({
      status: "normalizing",
    });
    expect(await caller.videos.cancel({ id: 3 })).toEqual({
      videoId: 3,
      status: "failed",
    });
    expect(mocks.startSourceVideoPipeline).toHaveBeenCalledWith(22, 3);
    expect(mocks.cancelSourceVideoPipeline).toHaveBeenCalledWith(22, 3);
    await caller.videos.retry({ id: 3 });
    expect(mocks.startSourceVideoPipeline).toHaveBeenCalledWith(22, 3);
  });

  it("saves integration settings for the authenticated owner", async () => {
    mocks.upsertIntegrationSetting.mockResolvedValue({
      platform: "youtube",
      enabled: false,
      accessToken: "abcd••••mnop",
    });
    const result = await appRouter
      .createCaller(context())
      .integrations.save({
        platform: "youtube",
        accessToken: "abcdefghijklmnop",
        publishEndpoint: "https://gateway.example/publish",
        enabled: false,
      });
    expect(mocks.upsertIntegrationSetting).toHaveBeenCalledWith({
      ownerId: 22,
      platform: "youtube",
      accessToken: "abcdefghijklmnop",
      publishEndpoint: "https://gateway.example/publish",
      enabled: false,
    });
    expect(result?.accessToken).toContain("••••");
  });

  it("records an approval decision for a candidate", async () => {
    updateCandidateReview.mockResolvedValue({
      id: 8,
      ownerId: 22,
      status: "approved",
    });
    const result = await appRouter
      .createCaller(context())
      .review.update({
        id: 8,
        status: "approved",
        suggestedTitle: "Grande momento",
      });
    expect(updateCandidateReview).toHaveBeenCalledWith({
      id: 8,
      ownerId: 22,
      status: "approved",
      suggestedTitle: "Grande momento",
    });
    expect(result?.status).toBe("approved");
  });
});
