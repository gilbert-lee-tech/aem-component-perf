import type { McpClient } from '../mcp-client.js';
import type {
  BoundingBox,
  ComponentNode,
  PageData,
  PipelineConfig,
  TestPageManifest,
} from '../types.js';

const STRUCTURAL_SUPER_TYPES = ['container', 'contentfragment', 'experiencefragment'];

function isStructural(node: ComponentNode): boolean {
  return !!node.superResourceType &&
    STRUCTURAL_SUPER_TYPES.some((t) => node.superResourceType!.includes(t));
}

function slugify(resourceType: string): string {
  return resourceType
    .replace(/\//g, '--')
    .replace(/[^a-z0-9-]/gi, '-')
    .slice(0, 60);
}

function uniqueContentTypes(
  nodes: ComponentNode[],
  boxes: Map<string, BoundingBox>,
): string[] {
  const seen = new Set<string>();
  for (const node of nodes) {
    if (boxes.has(node.path)) seen.add(node.resourceType);
  }
  return [...seen];
}

/**
 * Recreates every node from the original page under `testPagePath`.
 * Nodes with bounding boxes that are NOT in `keepTypes` become placeholders;
 * everything else (structural nodes, kept component types) keeps its original properties.
 */
async function populatePage(
  mcp: McpClient,
  originalBase: string,
  testPagePath: string,
  nodes: ComponentNode[],
  boxes: Map<string, BoundingBox>,
  keepTypes: Set<string>,
  placeholderResourceType: string,
): Promise<void> {
  // Shallow-first so parent nodes exist before children.
  const sorted = [...nodes].sort((a, b) => a.path.length - b.path.length);

  for (const node of sorted) {
    const relPath = node.path.slice(originalBase.length);
    const testNodePath = `${testPagePath}${relPath}`;
    const box = boxes.get(node.path);
    const placeholder = box !== undefined && !keepTypes.has(node.resourceType) && !isStructural(node);

    if (placeholder) {
      await mcp.setNode(testNodePath, {
        'jcr:primaryType': node.jcrPrimaryType,
        'sling:resourceType': placeholderResourceType,
        width: box.width,
        height: box.height,
      });
    } else {
      await mcp.setNode(testNodePath, {
        'jcr:primaryType': node.jcrPrimaryType,
        ...node.properties,
      });
    }
  }
}

export async function generateTestPages(
  mcp: McpClient,
  pageData: PageData,
  boxes: Map<string, BoundingBox>,
  config: PipelineConfig,
  pageId: string,
): Promise<TestPageManifest> {
  // Create the per-run container page that holds control + all isolated pages.
  await mcp.createPage({
    parentPath: config.testRoot,
    label: pageId,
    title: `Perf Run — ${pageId}`,
    template: pageData.template,
    pageResourceType: pageData.pageResourceType,
  });
  const testParent = `${config.testRoot}/${pageId}`;
  const sharedPageArgs = {
    template: pageData.template,
    pageResourceType: pageData.pageResourceType,
  };

  // Control: every visible component becomes a placeholder.
  const controlLabel = 'control';
  await mcp.createPage({
    parentPath: testParent,
    label: controlLabel,
    title: pageData.pageTitle || `Perf Control — ${pageId}`,
    ...sharedPageArgs,
  });
  const controlPath = `${testParent}/${controlLabel}`;
  await populatePage(
    mcp,
    pageData.pagePath,
    controlPath,
    pageData.nodes,
    boxes,
    new Set(),
    config.placeholderResourceType,
  );

  // Isolated pages: one per unique content component type.
  const contentTypes = uniqueContentTypes(pageData.nodes, boxes);
  const isolated: Record<string, string> = {};

  for (const resourceType of contentTypes) {
    const label = slugify(resourceType);
    await mcp.createPage({
      parentPath: testParent,
      label,
      title: pageData.pageTitle || `Perf Isolated — ${resourceType}`,
      ...sharedPageArgs,
    });
    const isolatedPath = `${testParent}/${label}`;
    await populatePage(
      mcp,
      pageData.pagePath,
      isolatedPath,
      pageData.nodes,
      boxes,
      new Set([resourceType]),
      config.placeholderResourceType,
    );
    isolated[resourceType] = isolatedPath;
  }

  return { pageId, controlPath, isolated };
}
