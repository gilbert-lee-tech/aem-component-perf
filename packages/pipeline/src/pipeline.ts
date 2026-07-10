import type { McpClient } from './mcp-client.js';
import { captureLayout } from './stages/capture.js';
import { generateTestPages } from './stages/generate.js';
import { measurePage } from './stages/measure.js';
import { computeAttribution } from './stages/attribute.js';
import type { PipelineConfig, PipelineResult } from './types.js';

export function normalizeUrl(input: string): string {
  try {
    return new URL(input).pathname.replace(/\.html$/, '');
  } catch {
    return input.replace(/\.html$/, '');
  }
}

export function makePageId(pagePath: string): string {
  return pagePath
    .replace(/^\/content\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '')
    .slice(0, 50);
}

export async function run(
  pageUrl: string,
  mcp: McpClient,
  config: PipelineConfig,
): Promise<PipelineResult> {
  console.log(`[1/4] Reading page structure…`);
  const pageData = await mcp.readPage(pageUrl);
  const pageId = makePageId(pageData.pagePath);
  console.log(`      ${pageData.nodes.length} nodes, template: ${pageData.template}`);

  console.log(`[2/4] Capturing layout (author edit mode)…`);
  const boxes = await captureLayout(pageData.pagePath, pageData.nodes, config);
  console.log(`      ${boxes.size}/${pageData.nodes.length} nodes have bounding boxes`);

  console.log(`[3/4] Generating test pages…`);
  const manifest = await generateTestPages(mcp, pageData, boxes, config, pageId);
  const totalPages = 1 + Object.keys(manifest.isolated).length;
  console.log(`      Control + ${totalPages - 1} isolated pages created`);

  console.log(`[4/4] Measuring (${config.lighthouseRuns} runs × ${totalPages} pages)…`);

  const toUrl = (jcrPath: string) =>
    `${config.aemBaseUrl}${jcrPath}.html?wcmmode=disabled`;

  console.log(`    control`);
  const control = await measurePage(toUrl(manifest.controlPath), `${pageId}/control`, config);

  const isolated: Record<string, PipelineResult['isolated'][string]> = {};
  for (const [resourceType, jcrPath] of Object.entries(manifest.isolated)) {
    const slug = jcrPath.split('/').pop()!;
    console.log(`    ${resourceType}`);
    isolated[resourceType] = await measurePage(toUrl(jcrPath), `${pageId}/${slug}`, config);
  }

  return {
    originalUrl: pageUrl,
    pageId,
    control,
    isolated,
    attribution: computeAttribution(control, isolated),
    timestamp: new Date().toISOString(),
  };
}
