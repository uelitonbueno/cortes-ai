export const PIPELINE_STATES = [
  "uploaded",
  "normalizing",
  "transcribing",
  "visioning",
  "detecting",
  "rendering",
  "awaiting_review",
  "approved",
  "scheduled",
  "published",
] as const;
export type PipelineState = (typeof PIPELINE_STATES)[number];

export const SOURCE_TYPES = ["upload", "youtube", "twitch", "live", "gdrive", "kick"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const QUEUES = {
  cpu: "pipeline.cpu",
  gpu: "pipeline.gpu",
  llm: "pipeline.llm",
  publishing: "pipeline.publishing",
  analytics: "pipeline.analytics",
} as const;

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
  probability?: number;
};
export type TranscriptSegment = {
  id: number;
  start: number;
  end: number;
  speaker?: string;
  text: string;
  words: TranscriptWord[];
};
export type HighlightCandidate = {
  start: number;
  end: number;
  category: string;
  finalScore: number;
  hookText?: string;
  reasoning?: string;
  suggestedTitle?: string;
};
export type VerticalRenderRequest = {
  sourceArtifactKey: string;
  outputArtifactKey: string;
  startSeconds: number;
  endSeconds: number;
  width: 1080;
  height: 1920;
  cropMode: "center" | "face_tracking" | "speaker_tracking";
  captionsArtifactKey?: string;
  brandKitId?: number;
  templateId?: number;
  watermarkArtifactKey?: string;
};

export function createVerticalRenderRequest(
  input: Omit<VerticalRenderRequest, "width" | "height">
): VerticalRenderRequest {
  return { ...input, width: 1080, height: 1920 };
}

export function normalizeScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function combinedHighlightScore(
  signals: { llm: number; audio?: number; chat?: number; vision?: number },
  weights = { llm: 0.5, vision: 0.2, audio: 0.15, chat: 0.15 }
) {
  return normalizeScore(
    signals.llm * weights.llm +
      (signals.vision ?? 0) * weights.vision +
      (signals.audio ?? 0) * weights.audio +
      (signals.chat ?? 0) * weights.chat
  );
}

export function createIdempotencyKey(parts: Array<string | number>) {
  return parts
    .map(String)
    .join(":")
    .replace(/[^a-zA-Z0-9:_-]/g, "-")
    .slice(0, 160);
}

export function isValidTransition(from: PipelineState, to: PipelineState) {
  const allowed: Record<PipelineState, PipelineState[]> = {
    uploaded: ["normalizing"],
    normalizing: ["transcribing"],
    transcribing: ["visioning"],
    visioning: ["detecting"],
    detecting: ["rendering"],
    rendering: ["awaiting_review"],
    awaiting_review: ["approved"],
    approved: ["scheduled"],
    scheduled: ["published"],
    published: [],
  };
  return allowed[from].includes(to);
}

export function splitTranscriptWindows(
  segments: TranscriptSegment[],
  windowSeconds = 900,
  overlapSeconds = 120
) {
  if (!segments.length) return [] as TranscriptSegment[][];
  const lastEnd = segments[segments.length - 1].end;
  const windows: TranscriptSegment[][] = [];
  for (
    let start = 0;
    start < lastEnd;
    start += Math.max(1, windowSeconds - overlapSeconds)
  ) {
    const end = start + windowSeconds;
    const chunk = segments.filter(
      segment => segment.end > start && segment.start < end
    );
    if (chunk.length) windows.push(chunk);
    if (end >= lastEnd) break;
  }
  return windows;
}

export function removeOverlappingCandidates(
  candidates: HighlightCandidate[],
  overlapThreshold = 0.3
) {
  const ordered = [...candidates].sort((a, b) => b.finalScore - a.finalScore);
  const selected: HighlightCandidate[] = [];
  for (const candidate of ordered) {
    const duration = Math.max(1, candidate.end - candidate.start);
    const overlaps = selected.some(existing => {
      const intersection = Math.max(
        0,
        Math.min(candidate.end, existing.end) -
          Math.max(candidate.start, existing.start)
      );
      const union =
        Math.max(candidate.end, existing.end) -
        Math.min(candidate.start, existing.start);
      return intersection / Math.max(duration, union) > overlapThreshold;
    });
    if (!overlaps) selected.push(candidate);
  }
  return selected.sort((a, b) => a.start - b.start);
}

export function formatAssTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${remaining.toFixed(2).padStart(5, "0")}`;
}

export function buildAssKaraoke(words: TranscriptWord[]) {
  const events = words
    .map(word => {
      const durationCentiseconds = Math.max(
        1,
        Math.round((word.end - word.start) * 100)
      );
      return `\\k${durationCentiseconds}${word.word.replace(/[{}]/g, "")}`;
    })
    .join(" ");
  const start = words[0]?.start ?? 0;
  const end = words[words.length - 1]?.end ?? start;
  return `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,${events}`;
}

export function verticalRenderFilter(request: VerticalRenderRequest) {
  const crop =
    request.cropMode === "center"
      ? "crop=ih*9/16:ih:x=(iw-ih*9/16)/2:y=0"
      : "crop=ih*9/16:ih:x=(iw-ih*9/16)/2:y=0";
  return `${crop},scale=${request.width}:${request.height}`;
}

export function isPublicationAllowed(
  lastScheduledAt: Date | null,
  nextScheduledAt: Date,
  minimumGapMinutes = 60
) {
  if (!lastScheduledAt) return true;
  return (
    nextScheduledAt.getTime() - lastScheduledAt.getTime() >=
    minimumGapMinutes * 60_000
  );
}
