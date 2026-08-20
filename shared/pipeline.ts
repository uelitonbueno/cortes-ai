export const PIPELINE_STATES = ["uploaded", "normalizing", "transcribing", "detecting", "rendering", "awaiting_review", "approved", "scheduled", "published"] as const;
export type PipelineState = (typeof PIPELINE_STATES)[number];

export const QUEUES = {
  cpu: "pipeline.cpu",
  gpu: "pipeline.gpu",
  llm: "pipeline.llm",
  publishing: "pipeline.publishing",
  analytics: "pipeline.analytics",
} as const;

export type ScoreSignals = { llm: number; audio?: number; chat?: number };

export function normalizeScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function combinedHighlightScore(signals: ScoreSignals, weights = { llm: 0.6, audio: 0.2, chat: 0.2 }) {
  const audio = signals.audio ?? 0;
  const chat = signals.chat ?? 0;
  return normalizeScore(signals.llm * weights.llm + audio * weights.audio + chat * weights.chat);
}

export function createIdempotencyKey(parts: Array<string | number>) {
  return parts.map(String).join(":").replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 160);
}

export function isValidTransition(from: PipelineState, to: PipelineState) {
  const allowed: Record<PipelineState, PipelineState[]> = {
    uploaded: ["normalizing"],
    normalizing: ["transcribing"],
    transcribing: ["detecting"],
    detecting: ["rendering"],
    rendering: ["awaiting_review"],
    awaiting_review: ["approved"],
    approved: ["scheduled"],
    scheduled: ["published"],
    published: [],
  };
  return allowed[from].includes(to);
}
