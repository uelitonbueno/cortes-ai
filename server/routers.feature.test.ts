import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSourceVideo: vi.fn(), updateCandidateReview: vi.fn(), listIntegrationSettings: vi.fn(), upsertIntegrationSetting: vi.fn() }));
const { createSourceVideo, updateCandidateReview } = mocks;

vi.mock("./db", () => ({
  createSourceVideo: mocks.createSourceVideo,
  updateCandidateReview: mocks.updateCandidateReview,
  listIntegrationSettings: mocks.listIntegrationSettings,
  upsertIntegrationSetting: mocks.upsertIntegrationSetting,
  getAnalyticsSummary: vi.fn(),
  getPipelineDetail: vi.fn(),
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

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(): TrpcContext {
  return { user: { id: 22, openId: "feature-user", name: "Ueliton", email: "ueliton@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("feature mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers a source video for the authenticated owner", async () => {
    createSourceVideo.mockResolvedValue({ id: 3, ownerId: 22, title: "Podcast", status: "uploaded" });
    const result = await appRouter.createCaller(context()).videos.register({ title: "Podcast", sourceType: "upload", idempotencyKey: "register-12345" });
    expect(createSourceVideo).toHaveBeenCalledWith({ ownerId: 22, title: "Podcast", sourceType: "upload", idempotencyKey: "register-12345" });
    expect(result?.id).toBe(3);
  });

  it("saves integration settings for the authenticated owner", async () => {
    mocks.upsertIntegrationSetting.mockResolvedValue({ platform: "youtube", enabled: false, accessToken: "abcd••••mnop" });
    const result = await appRouter.createCaller(context()).integrations.save({ platform: "youtube", accessToken: "abcdefghijklmnop", publishEndpoint: "https://gateway.example/publish", enabled: false });
    expect(mocks.upsertIntegrationSetting).toHaveBeenCalledWith({ ownerId: 22, platform: "youtube", accessToken: "abcdefghijklmnop", publishEndpoint: "https://gateway.example/publish", enabled: false });
    expect(result?.accessToken).toContain("••••");
  });

  it("records an approval decision for a candidate", async () => {
    updateCandidateReview.mockResolvedValue({ id: 8, ownerId: 22, status: "approved" });
    const result = await appRouter.createCaller(context()).review.update({ id: 8, status: "approved", suggestedTitle: "Grande momento" });
    expect(updateCandidateReview).toHaveBeenCalledWith({ id: 8, ownerId: 22, status: "approved", suggestedTitle: "Grande momento" });
    expect(result?.status).toBe("approved");
  });
});
