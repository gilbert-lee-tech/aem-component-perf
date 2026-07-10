// Mirrors packages/pipeline/src/types.ts — re-declared so the report package
// has no runtime dependency on pipeline.

export interface LighthouseMetrics {
  lcp: number;
  tbt: number;
  cls: number;
  ttfb: number;
  performanceScore: number;
  transferredBytes: number;
}

export interface PageMeasurement {
  pageId: string;
  url: string;
  runs: Array<{ index: number; metrics: LighthouseMetrics; rawPath: string }>;
  median: LighthouseMetrics;
}

export interface AttributionResult {
  resourceType: string;
  lcp: number;
  tbt: number;
  cls: number;
  ttfb: number;
  performanceScore: number;
  transferredBytes: number;
}

export interface PipelineResult {
  originalUrl: string;
  pageId: string;
  control: PageMeasurement;
  isolated: Record<string, PageMeasurement>;
  attribution: AttributionResult[];
  timestamp: string;
}
