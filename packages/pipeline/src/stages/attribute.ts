import type { AttributionResult, PageMeasurement } from '../types.js';

export function computeAttribution(
  control: PageMeasurement,
  isolated: Record<string, PageMeasurement>,
): AttributionResult[] {
  const results: AttributionResult[] = Object.entries(isolated).map(
    ([resourceType, measurement]) => ({
      resourceType,
      lcp: measurement.median.lcp - control.median.lcp,
      tbt: measurement.median.tbt - control.median.tbt,
      cls: measurement.median.cls - control.median.cls,
      ttfb: measurement.median.ttfb - control.median.ttfb,
      performanceScore: measurement.median.performanceScore - control.median.performanceScore,
      transferredBytes:
        measurement.median.transferredBytes - control.median.transferredBytes,
    }),
  );

  // Highest TBT cost first — TBT is the most actionable metric for JS-heavy components.
  return results.sort((a, b) => Math.abs(b.tbt) - Math.abs(a.tbt));
}
