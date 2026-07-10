// Re-declared here (not imported from mcp-server) to keep pipeline MCP-agnostic.
export interface ComponentNode {
  path: string;
  resourceType: string;
  superResourceType?: string;
  jcrPrimaryType: string;
  properties: Record<string, string | number | boolean>;
  depth: number;
}

export interface PageData {
  pagePath: string;
  template: string;
  pageResourceType: string;
  nodes: ComponentNode[];
}

export interface BoundingBox {
  path: string;
  width: number;
  height: number;
  top: number;
}

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

export interface PipelineConfig {
  aemBaseUrl: string;
  aemUser: string;
  aemPass: string;
  /** JCR path where test pages are created; must already exist. */
  testRoot: string;
  placeholderResourceType: string;
  lighthouseRuns: number;
  resultsDir: string;
}

export interface TestPageManifest {
  pageId: string;
  controlPath: string;
  /** resourceType → JCR path of its isolated test page */
  isolated: Record<string, string>;
}
