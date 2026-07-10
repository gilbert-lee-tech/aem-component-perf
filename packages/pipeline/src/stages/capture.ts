import puppeteer from 'puppeteer';
import type { BoundingBox, ComponentNode, PipelineConfig } from '../types.js';

/**
 * Navigates the page in AEM author edit mode, which adds decoration divs with
 * [data-path] attributes. Uses those elements to record each component's
 * bounding box. Components without a decoration div (structural/hidden) return
 * no entry; the generate stage treats them as structural and never placeholders them.
 */
export async function captureLayout(
  pagePath: string,
  nodes: ComponentNode[],
  config: PipelineConfig,
): Promise<Map<string, BoundingBox>> {
  // Author edit mode is the reliable source of [data-path] decoration divs.
  const url = `${config.aemBaseUrl}${pagePath}.html?wcmmode=edit`;
  const authHeader = `Basic ${Buffer.from(`${config.aemUser}:${config.aemPass}`).toString('base64')}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ Authorization: authHeader });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

    const boxes = new Map<string, BoundingBox>();

    for (const node of nodes) {
      const box = await page.evaluate((path: string) => {
        // Attribute value is quoted so colons need no CSS escaping.
        const el = document.querySelector(`[data-path="${path}"]`);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
        };
      }, node.path);

      if (box) boxes.set(node.path, { path: node.path, ...box });
    }

    return boxes;
  } finally {
    await browser.close();
  }
}
