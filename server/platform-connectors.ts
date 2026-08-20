import type { PlatformName, PublishRequest, PublishResult } from "./platforms";
import { createPublishRequest } from "./platforms";

const requiredCredential: Record<PlatformName, string> = {
  youtube: "YOUTUBE_ACCESS_TOKEN",
  tiktok: "TIKTOK_ACCESS_TOKEN",
  instagram: "INSTAGRAM_ACCESS_TOKEN",
};

export function platformCredentialKey(platform: PlatformName) {
  return requiredCredential[platform];
}

export async function publishWithConnector(
  input: PublishRequest
): Promise<PublishResult> {
  const scheduled = createPublishRequest(input);
  if (scheduled.status === "blocked") return scheduled;
  const token = process.env[requiredCredential[input.platform]];
  if (!token)
    throw new Error(`${requiredCredential[input.platform]} is not configured`);
  const endpoint =
    process.env[`${input.platform.toUpperCase()}_PUBLISH_ENDPOINT`];
  if (!endpoint)
    throw new Error(
      `${input.platform.toUpperCase()}_PUBLISH_ENDPOINT is not configured`
    );
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": scheduled.idempotencyKey,
    },
    body: JSON.stringify({
      mediaUrl: input.mediaUrl,
      title: input.title,
      description: input.description,
      hashtags: input.hashtags,
      scheduledAt: input.scheduledAt.toISOString(),
    }),
  });
  if (!response.ok)
    throw new Error(
      `${input.platform} publish failed with HTTP ${response.status}`
    );
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: "published" | "scheduled";
  };
  return {
    ...scheduled,
    status: body.status ?? "published",
    externalId: body.id,
  };
}
