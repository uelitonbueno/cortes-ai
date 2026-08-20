import { createIdempotencyKey, isPublicationAllowed } from "../shared/pipeline";

export type PlatformName = "youtube" | "tiktok" | "instagram";
export type PublishRequest = {
  platform: PlatformName;
  clipId: number;
  mediaUrl: string;
  title: string;
  description: string;
  hashtags: string[];
  scheduledAt: Date;
  lastScheduledAt?: Date | null;
};

export type PublishResult = {
  status: "published" | "scheduled" | "blocked";
  platform: PlatformName;
  externalId?: string;
  idempotencyKey: string;
  reason?: string;
};

export function createPublishRequest(input: PublishRequest): PublishResult {
  const idempotencyKey = createIdempotencyKey([
    input.platform,
    input.clipId,
    input.scheduledAt.toISOString(),
  ]);
  if (
    !isPublicationAllowed(input.lastScheduledAt ?? null, input.scheduledAt, 60)
  )
    return {
      status: "blocked",
      platform: input.platform,
      idempotencyKey,
      reason: "minimum_cadence_gap",
    };
  return { status: "scheduled", platform: input.platform, idempotencyKey };
}

export interface PlatformPublisher {
  readonly platform: PlatformName;
  publish(input: PublishRequest): Promise<PublishResult>;
}

export class CredentialedPlatformPublisher implements PlatformPublisher {
  constructor(public readonly platform: PlatformName) {}

  async publish(input: PublishRequest): Promise<PublishResult> {
    const request = createPublishRequest(input);
    if (request.status === "blocked") return request;
    throw new Error(
      `${this.platform} credentials are not configured; publication remains scheduled`
    );
  }
}

export const publishers: Record<PlatformName, PlatformPublisher> = {
  youtube: new CredentialedPlatformPublisher("youtube"),
  tiktok: new CredentialedPlatformPublisher("tiktok"),
  instagram: new CredentialedPlatformPublisher("instagram"),
};
