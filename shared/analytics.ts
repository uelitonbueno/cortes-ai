export type CalibrationObservation = {
  predictedScore: number;
  retentionRate: number;
  approved: boolean;
};
export type ScoreWeights = { llm: number; audio: number; chat: number };

export function recalibrateWeights(
  observations: CalibrationObservation[],
  current: ScoreWeights = { llm: 0.6, audio: 0.2, chat: 0.2 }
): ScoreWeights {
  if (observations.length < 10) return current;
  const quality =
    observations.reduce(
      (sum, item) =>
        sum + (item.retentionRate / 100) * (item.approved ? 1 : 0.5),
      0
    ) / observations.length;
  const adjustment = Math.max(-0.08, Math.min(0.08, quality - 0.5));
  const llm = Math.max(0.4, Math.min(0.8, current.llm + adjustment));
  const remaining = 1 - llm;
  const audioRatio =
    current.audio / Math.max(0.01, current.audio + current.chat);
  return {
    llm,
    audio: remaining * audioRatio,
    chat: remaining * (1 - audioRatio),
  };
}
