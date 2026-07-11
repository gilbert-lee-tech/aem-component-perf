import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { type AemClient } from './aem-client.js';
import { traverseNodes } from './jcr.js';
import { type PageData } from './types.js';

function normalizePagePath(input: string): string {
  let path: string;
  try {
    path = new URL(input).pathname;
  } catch {
    path = input;
  }
  path = path.replace(/^\/editor\.html/, '');
  return path.replace(/\.(html|infinity\.json)$/, '');
}

export function createServer(aem: AemClient): McpServer {
  const server = new McpServer({ name: 'aem-component-perf', version: '0.0.1' });

  server.tool(
    'read-page',
    'Read an AEM page via .infinity.json and return its template, page resource type, and depth-first ordered list of all component nodes with their JCR properties.',
    {
      pageUrl: z
        .string()
        .describe(
          'Full AEM URL or JCR path of the page, e.g. http://localhost:4502/content/site/page or /content/site/page',
        ),
    },
    async ({ pageUrl }) => {
      const pagePath = normalizePagePath(pageUrl);
      const raw = (await aem.getJson(`${pagePath}.infinity.json`)) as Record<string, unknown>;

      const content = raw['jcr:content'];
      if (!content || typeof content !== 'object' || Array.isArray(content)) {
        throw new Error(`No jcr:content at ${pagePath}`);
      }
      const jcrContent = content as Record<string, unknown>;

      const nodes: PageData['nodes'] = [];
      traverseNodes(jcrContent, `${pagePath}/jcr:content`, 0, nodes);

      // Enrich nodes with sling:resourceSuperType from component definitions.
      // Content nodes don't carry this; it lives on the component node in /apps or /libs.
      const superTypeCache = new Map<string, string>();
      for (const node of nodes) {
        if (superTypeCache.has(node.resourceType)) continue;
        for (const prefix of ['/apps', '/libs']) {
          try {
            const def = await aem.getJson(`${prefix}/${node.resourceType}.json`) as Record<string, unknown>;
            if (typeof def['sling:resourceSuperType'] === 'string') {
              superTypeCache.set(node.resourceType, def['sling:resourceSuperType']);
              break;
            }
          } catch {
            // not found at this prefix, try next
          }
        }
      }
      for (const node of nodes) {
        const looked = superTypeCache.get(node.resourceType);
        if (looked) node.superResourceType = looked;
      }

      const result: PageData = {
        pagePath,
        template:
          typeof jcrContent['cq:template'] === 'string' ? jcrContent['cq:template'] : '',
        pageResourceType:
          typeof jcrContent['sling:resourceType'] === 'string'
            ? jcrContent['sling:resourceType']
            : '',
        pageTitle:
          typeof jcrContent['jcr:title'] === 'string' ? jcrContent['jcr:title'] : '',
        nodes,
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'create-page',
    'Create a new cq:Page and its jcr:content node via Sling POST. The parent path must already exist. Does not initialize template content — call set-node for each component node afterward.',
    {
      parentPath: z
        .string()
        .describe('JCR path of the parent node, e.g. /content/site/perf-test'),
      label: z.string().describe('Node name for the new page (becomes the URL segment)'),
      title: z.string().describe('Value written to jcr:content/jcr:title'),
      template: z.string().describe('Full JCR path of the CQ template, e.g. /conf/site/settings/wcm/templates/page'),
      pageResourceType: z
        .string()
        .describe('sling:resourceType for jcr:content, copied from the original page'),
    },
    async ({ parentPath, label, title, template, pageResourceType }) => {
      const pagePath = `${parentPath.replace(/\/$/, '')}/${label}`;

      await aem.post(pagePath, { 'jcr:primaryType': 'cq:Page' });

      await aem.post(`${pagePath}/jcr:content`, {
        'jcr:primaryType': 'cq:PageContent',
        'jcr:title': title,
        'cq:template': template,
        'sling:resourceType': pageResourceType,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: pagePath }) }] };
    },
  );

  server.tool(
    'set-node',
    'Create or update a JCR node at the given path via Sling POST, writing the supplied properties. Parent node must exist. Use this to populate component nodes on a test page after create-page.',
    {
      nodePath: z
        .string()
        .describe(
          'Full JCR path of the node, e.g. /content/site/perf-test/control/jcr:content/root/hero',
        ),
      properties: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .describe('Key-value pairs to write; values are stored as JCR String'),
    },
    async ({ nodePath, properties }) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(properties)) fields[k] = String(v);
      await aem.post(nodePath, fields);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: nodePath }) }] };
    },
  );

  server.tool(
    'delete-page',
    'Delete an AEM page and all its descendants via Sling POST :operation=delete. Intended for explicit teardown of perf-test pages only.',
    {
      pagePath: z
        .string()
        .describe('JCR path of the page to delete, e.g. /content/site/perf-test/control'),
    },
    async ({ pagePath }) => {
      await aem.post(pagePath, { ':operation': 'delete' });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: pagePath }) }] };
    },
  );

  return server;
}
