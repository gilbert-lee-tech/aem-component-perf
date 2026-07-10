import type { LighthouseMetrics } from '../types.js';

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function medianMetrics(
  runs: Array<{ metrics: LighthouseMetrics }>,
): LighthouseMetrics {
  return {
    lcp: median(runs.map((r) => r.metrics.lcp)),
    tbt: median(runs.map((r) => r.metrics.tbt)),
    cls: median(runs.map((r) => r.metrics.cls)),
    ttfb: median(runs.map((r) => r.metrics.ttfb)),
    performanceScore: median(runs.map((r) => r.metrics.performanceScore)),
    transferredBytes: median(runs.map((r) => r.metrics.transferredBytes)),
  };
}
