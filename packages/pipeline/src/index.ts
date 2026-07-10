#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { LocalMcpAdapter } from './mcp-client.js';
import { run, normalizeUrl, makePageId } from './pipeline.js';
import type { PipelineConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SERVER_PATH = join(__dirname, '../../mcp-server/dist/index.js');

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string' },
    'aem-url': { type: 'string', default: process.env['AEM_URL'] ?? 'http://localhost:4502' },
    'aem-user': { type: 'string', default: process.env['AEM_USER'] ?? 'admin' },
    'aem-pass': { type: 'string', default: process.env['AEM_PASS'] ?? 'admin' },
    'test-root': { type: 'string', default: '/content/perf-test' },
    'placeholder-type': {
      type: 'string',
      default: 'aem-component-perf/placeholder',
    },
    runs: { type: 'string', default: '5' },
    'results-dir': { type: 'string', default: './results' },
    'server-path': { type: 'string', default: DEFAULT_SERVER_PATH },
  },
});

const subcommand = positionals[0];

const config: PipelineConfig = {
  aemBaseUrl: values['aem-url']!,
  aemUser: values['aem-user']!,
  aemPass: values['aem-pass']!,
  testRoot: values['test-root']!,
  placeholderResourceType: values['placeholder-type']!,
  lighthouseRuns: parseInt(values['runs']!, 10),
  resultsDir: values['results-dir']!,
};

const serverPath = values['server-path']!;

if (subcommand === 'run') {
  const url = values['url'];
  if (!url) {
    console.error('Usage: aem-pipeline run --url <aem-page-url> [options]');
    process.exit(1);
  }

  const mcp = await LocalMcpAdapter.create(serverPath, {
    AEM_URL: config.aemBaseUrl,
    AEM_USER: config.aemUser,
    AEM_PASS: config.aemPass,
  });

  try {
    const result = await run(url, mcp, config);

    console.log('\n--- Attribution (sorted by TBT cost) ---');
    for (const r of result.attribution) {
      const sign = (n: number) => (n >= 0 ? `+${n.toFixed(0)}` : n.toFixed(0));
      console.log(
        `  ${r.resourceType}\n` +
          `    TBT ${sign(r.tbt)}ms  LCP ${sign(r.lcp)}ms  CLS ${r.cls.toFixed(3)}  score ${sign(r.performanceScore)}`,
      );
    }

    const outPath = join(config.resultsDir, result.pageId, 'attribution.json');
    await writeFile(outPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\nFull results → ${outPath}`);
  } finally {
    await mcp.close();
  }
} else if (subcommand === 'teardown') {
  const url = values['url'];
  if (!url) {
    console.error('Usage: aem-pipeline teardown --url <original-aem-page-url> [options]');
    process.exit(1);
  }

  const mcp = await LocalMcpAdapter.create(serverPath, {
    AEM_URL: config.aemBaseUrl,
    AEM_USER: config.aemUser,
    AEM_PASS: config.aemPass,
  });

  try {
    const pagePath = normalizeUrl(url);
    const pageId = makePageId(pagePath);
    const testPath = `${config.testRoot}/${pageId}`;
    console.log(`Deleting ${testPath} and all test pages within…`);
    await mcp.deletePage(testPath);
    console.log('Done.');
  } finally {
    await mcp.close();
  }
} else {
  console.error('Usage: aem-pipeline <run|teardown> [options]');
  console.error('');
  console.error('Commands:');
  console.error('  run       --url <url>    Run the full pipeline against an AEM page');
  console.error('  teardown  --url <url>    Delete all test pages for a given original page');
  process.exit(1);
}
