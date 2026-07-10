import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer';
import type { LighthouseMetrics, PageMeasurement, PipelineConfig } from '../types.js';
import { medianMetrics } from '../utils/median.js';
import { saveRunResult } from '../utils/results.js';

// Minimal local types so we don't have to import Lighthouse's deep type tree.
interface LhrAudit {
  numericValue?: number;
}
interface Lhr {
  audits: Record<string, LhrAudit | undefined>;
  categories: Record<string, { score?: number | null } | undefined>;
}
interface LhRunnerResult {
  lhr: Lhr;
  report: string | string[];
}

const LIGHTHOUSE_FLAGS = {
  logLevel: 'error' as const,
  output: 'json' as const,
  onlyCategories: ['performance'],
  formFactor: 'desktop' as const,
  throttlingMethod: 'simulate' as const,
  throttling: {
    rttMs: 40,
    throughputKbps: 10_240,
    cpuSlowdownMultiplier: 1,
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0,
  },
  screenEmulation: {
    mobile: false,
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    disabled: false,
  },
  disableStorageReset: false,
};

function extractMetrics(lhr: Lhr): LighthouseMetrics {
  const audit = (id: string) => lhr.audits[id]?.numericValue ?? 0;
  return {
    lcp: audit('largest-contentful-paint'),
    tbt: audit('total-blocking-time'),
    cls: audit('cumulative-layout-shift'),
    ttfb: audit('server-response-time'),
    performanceScore: (lhr.categories['performance']?.score ?? 0) * 100,
    transferredBytes: audit('total-byte-weight'),
  };
}

export async function measurePage(
  url: string,
  pageId: string,
  config: PipelineConfig,
): Promise<PageMeasurement> {
  const authHeader = `Basic ${Buffer.from(`${config.aemUser}:${config.aemPass}`).toString('base64')}`;
  const runs: PageMeasurement['runs'] = [];

  for (let i = 0; i < config.lighthouseRuns; i++) {
    // Fresh browser per run = cold cache, as required.
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const port = Number(new URL(browser.wsEndpoint()).port);
      const result = (await lighthouse(url, {
        ...LIGHTHOUSE_FLAGS,
        port,
        extraHeaders: { Authorization: authHeader },
      })) as LhRunnerResult | null;

      if (!result) throw new Error(`Lighthouse returned null for ${url} (run ${i})`);

      const metrics = extractMetrics(result.lhr);
      const rawJson = Array.isArray(result.report) ? result.report[0]! : result.report;
      const rawPath = await saveRunResult(config.resultsDir, pageId, i, rawJson);

      runs.push({ index: i, metrics, rawPath });
      console.log(`      run ${i + 1}/${config.lighthouseRuns} — score ${metrics.performanceScore.toFixed(0)}, TBT ${metrics.tbt.toFixed(0)}ms`);
    } finally {
      await browser.close();
    }
  }

  return { pageId, url, runs, median: medianMetrics(runs) };
}
