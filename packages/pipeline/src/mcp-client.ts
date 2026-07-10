import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { PageData } from './types.js';

export interface McpClient {
  readPage(pageUrl: string): Promise<PageData>;
  createPage(params: {
    parentPath: string;
    label: string;
    title: string;
    template: string;
    pageResourceType: string;
  }): Promise<{ path: string }>;
  setNode(
    nodePath: string,
    properties: Record<string, string | number | boolean>,
  ): Promise<void>;
  deletePage(pagePath: string): Promise<void>;
  close(): Promise<void>;
}

function extractText(result: unknown): string {
  const content = (result as { content: Array<{ type: string; text?: string }> }).content;
  return content.find((c) => c.type === 'text')?.text ?? '';
}

export class LocalMcpAdapter implements McpClient {
  readonly #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  static async create(
    serverPath: string,
    extraEnv?: Record<string, string>,
  ): Promise<LocalMcpAdapter> {
    const env = Object.fromEntries(
      Object.entries({ ...process.env, ...extraEnv }).filter(([, v]) => v !== undefined),
    ) as Record<string, string>;

    const transport = new StdioClientTransport({ command: 'node', args: [serverPath], env });
    const client = new Client(
      { name: 'aem-component-perf-pipeline', version: '0.0.1' },
      { capabilities: {} },
    );
    await client.connect(transport);
    return new LocalMcpAdapter(client);
  }

  async readPage(pageUrl: string): Promise<PageData> {
    const result = await this.#client.callTool({ name: 'read-page', arguments: { pageUrl } });
    return JSON.parse(extractText(result)) as PageData;
  }

  async createPage(params: {
    parentPath: string;
    label: string;
    title: string;
    template: string;
    pageResourceType: string;
  }): Promise<{ path: string }> {
    const result = await this.#client.callTool({ name: 'create-page', arguments: params });
    return JSON.parse(extractText(result)) as { path: string };
  }

  async setNode(
    nodePath: string,
    properties: Record<string, string | number | boolean>,
  ): Promise<void> {
    await this.#client.callTool({ name: 'set-node', arguments: { nodePath, properties } });
  }

  async deletePage(pagePath: string): Promise<void> {
    await this.#client.callTool({ name: 'delete-page', arguments: { pagePath } });
  }

  async close(): Promise<void> {
    await this.#client.close();
  }
}
