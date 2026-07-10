import { type ComponentNode } from './types.js';

const SKIP_PROPERTY_EXACT = new Set([
  'jcr:uuid',
  'jcr:baseVersion',
  'jcr:isCheckedOut',
  'jcr:predecessors',
  'jcr:versionHistory',
]);

const SKIP_PROPERTY_PREFIXES = [
  'jcr:created',
  'jcr:lastModified',
  'cq:lastModified',
  'cq:lastRolledout',
];

// Child node keys starting with these are versioning / security nodes; skip entirely.
const SKIP_CHILD_PREFIXES = ['jcr:', 'rep:'];

function isNode(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function skipProperty(key: string): boolean {
  if (SKIP_PROPERTY_EXACT.has(key)) return true;
  return SKIP_PROPERTY_PREFIXES.some((p) => key.startsWith(p));
}

function extractProperties(
  node: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(node)) {
    if (isNode(v) || Array.isArray(v) || skipProperty(k)) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/**
 * Depth-first traversal of a JCR node tree, starting at `node` (already extracted
 * from the raw .infinity.json response). Appends every node that carries a
 * sling:resourceType to `results` in document order.
 *
 * Call with the jcr:content object and path = "<pagePath>/jcr:content".
 */
export function traverseNodes(
  node: Record<string, unknown>,
  path: string,
  depth: number,
  results: ComponentNode[],
): void {
  if (typeof node['sling:resourceType'] === 'string') {
    const superResourceType =
      typeof node['sling:resourceSuperType'] === 'string'
        ? node['sling:resourceSuperType']
        : undefined;
    results.push({
      path,
      resourceType: node['sling:resourceType'],
      ...(superResourceType !== undefined && { superResourceType }),
      jcrPrimaryType:
        typeof node['jcr:primaryType'] === 'string' ? node['jcr:primaryType'] : 'nt:unstructured',
      properties: extractProperties(node),
      depth,
    });
  }

  for (const [key, val] of Object.entries(node)) {
    if (!isNode(val)) continue;
    if (SKIP_CHILD_PREFIXES.some((p) => key.startsWith(p))) continue;
    traverseNodes(val, `${path}/${key}`, depth + 1, results);
  }
}
