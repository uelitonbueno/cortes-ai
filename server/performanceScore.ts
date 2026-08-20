export type PerformanceMetrics = {
  editorialScore: number;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  retentionRate?: number | null;
};

/** Combina o score editorial do detector com métricas reais coletadas por publicação. */
export function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  const editorial = Math.max(0, Math.min(100, metrics.editorialScore));
  const views = Math.min(100, Math.log10(Math.max(0, metrics.views ?? 0) + 1) * 20);
  const engagementBase = Math.max(0, (metrics.likes ?? 0) + (metrics.comments ?? 0) * 2 + (metrics.shares ?? 0) * 3);
  const engagement = Math.min(100, Math.log10(engagementBase + 1) * 25);
  const retention = Math.max(0, Math.min(100, metrics.retentionRate ?? 0));
  const hasAnalytics = [metrics.views, metrics.likes, metrics.comments, metrics.shares, metrics.retentionRate]
    .some(value => value !== null && value !== undefined);
  if (!hasAnalytics) return Math.round(editorial);
  return Math.round(editorial * 0.35 + views * 0.2 + engagement * 0.25 + retention * 0.2);
}
