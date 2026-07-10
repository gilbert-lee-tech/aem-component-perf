import type { AttributionResult, LighthouseMetrics, PipelineResult } from './types.js';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function ms(n: number, signed = false): string {
  const s = signed && n > 0 ? '+' : '';
  return `${s}${Math.round(n)}&thinsp;ms`;
}

function score(n: number, signed = false): string {
  const s = signed && n > 0 ? '+' : '';
  return `${s}${n.toFixed(1)}`;
}

function cls(n: number, signed = false): string {
  const s = signed && n > 0 ? '+' : '';
  return `${s}${n.toFixed(3)}`;
}

function bytes(n: number, signed = false): string {
  const s = signed && n > 0 ? '+' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(1)}&thinsp;MB`;
  if (abs >= 1_000) return `${s}${Math.round(n / 1_000)}&thinsp;KB`;
  return `${s}${Math.round(n)}&thinsp;B`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Delta colouring: for lower-is-better metrics, positive delta = cost added = bad.
// ---------------------------------------------------------------------------

type DeltaClass = 'bad' | 'warn' | 'good' | 'neutral';

function deltaClass(value: number, lowerIsBetter: boolean, threshold = 0): DeltaClass {
  if (Math.abs(value) <= threshold) return 'neutral';
  const worse = lowerIsBetter ? value > 0 : value < 0;
  if (worse) return Math.abs(value) > threshold * 5 ? 'bad' : 'warn';
  return 'good';
}

function td(content: string, cls_: DeltaClass): string {
  return `<td class="${cls_}">${content}</td>`;
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function baselineCards(m: LighthouseMetrics): string {
  const card = (label: string, value: string, sub?: string) => `
    <div class="card">
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
      ${sub ? `<div class="card-sub">${sub}</div>` : ''}
    </div>`;

  return `
  <div class="cards">
    ${card('Performance', score(m.performanceScore), 'score 0–100')}
    ${card('TBT', ms(m.tbt), 'total blocking time')}
    ${card('LCP', ms(m.lcp), 'largest contentful paint')}
    ${card('CLS', cls(m.cls), 'cumulative layout shift')}
    ${card('TTFB', ms(m.ttfb), 'time to first byte')}
    ${card('Transfer', bytes(m.transferredBytes), 'total byte weight')}
  </div>`;
}

function attributionRow(rank: number, r: AttributionResult): string {
  return `
  <tr>
    <td class="rank">${rank}</td>
    <td class="resource-type" title="${esc(r.resourceType)}">${esc(r.resourceType)}</td>
    ${td(ms(r.tbt, true), deltaClass(r.tbt, true, 5))}
    ${td(ms(r.lcp, true), deltaClass(r.lcp, true, 20))}
    ${td(cls(r.cls, true), deltaClass(r.cls, true, 0.005))}
    ${td(ms(r.ttfb, true), deltaClass(r.ttfb, true, 10))}
    ${td(score(r.performanceScore, true), deltaClass(r.performanceScore, false, 0.5))}
    ${td(bytes(r.transferredBytes, true), deltaClass(r.transferredBytes, true, 1024))}
  </tr>`;
}

function attributionTable(attribution: AttributionResult[]): string {
  if (attribution.length === 0) {
    return `<p class="empty">No component types were isolated — no bounding boxes were captured.</p>`;
  }
  const rows = attribution.map((r, i) => attributionRow(i + 1, r)).join('');
  return `
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Component type</th>
        <th>TBT&thinsp;Δ</th>
        <th>LCP&thinsp;Δ</th>
        <th>CLS&thinsp;Δ</th>
        <th>TTFB&thinsp;Δ</th>
        <th>Score&thinsp;Δ</th>
        <th>Bytes&thinsp;Δ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="table-note">
    Δ = isolated page median − control page median.
    Sorted by |TBT Δ| descending.
    <span class="bad swatch">■</span> adds cost &nbsp;
    <span class="warn swatch">■</span> minor &nbsp;
    <span class="good swatch">■</span> reduces cost &nbsp;
    <span class="neutral swatch">■</span> noise
  </p>`;
}

const DISTORTIONS = [
  'Placeholders paint instantly. If a placeholder is the largest element on a page, LCP is artificially fast. <strong>Rankings remain valid; absolute numbers are not.</strong>',
  'Components whose height depends on their own JS (carousels, embeds) get placeholders sized to the <em>rendered</em> state.',
  'Cross-type interaction effects (total page weight thresholds, third-party tags fired only in combination) are invisible by design — the original-page Lighthouse trace covers this.',
  'Local dev has no dispatcher or CDN and uses unminified clientlibs. Scores are valid for <strong>relative comparison only</strong>.',
];

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

const CSS = `
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a2e;
  background: #f4f5f7;
  margin: 0;
  padding: 24px 32px 48px;
}
a { color: #0066cc; }
h1 { font-size: 20px; font-weight: 700; margin: 0 0 2px; }
h2 { font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
     color: #555; margin: 32px 0 10px; }
.meta { color: #666; font-size: 13px; margin-bottom: 6px; }
.runs-badge {
  display: inline-block; font-size: 11px; font-weight: 600;
  background: #e8f0fe; color: #1a56db; border-radius: 10px;
  padding: 2px 8px; margin-left: 8px; vertical-align: middle;
}

/* baseline cards */
.cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
.card {
  background: #fff; border: 1px solid #e0e4ea; border-radius: 8px;
  padding: 12px 18px; min-width: 110px;
}
.card-label { font-size: 10px; font-weight: 700; letter-spacing: .08em;
              text-transform: uppercase; color: #888; }
.card-value { font-size: 24px; font-weight: 700; margin: 2px 0 0; }
.card-sub   { font-size: 10px; color: #bbb; margin-top: 1px; }

/* attribution table */
table {
  width: 100%; border-collapse: collapse; background: #fff;
  border: 1px solid #dde1e8; border-radius: 8px; overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
thead tr { background: #1a1a2e; }
thead th {
  color: #d0d4e0; font-size: 11px; font-weight: 600;
  letter-spacing: .06em; text-transform: uppercase;
  padding: 10px 12px; text-align: right; white-space: nowrap;
}
thead th:nth-child(1) { text-align: center; width: 36px; }
thead th:nth-child(2) { text-align: left; }
tbody tr { border-top: 1px solid #f0f2f5; }
tbody tr:hover { background: #f8f9fb; }
td {
  padding: 8px 12px; text-align: right;
  font-variant-numeric: tabular-nums;
}
td.rank { text-align: center; color: #aaa; font-size: 12px; }
td.resource-type {
  text-align: left; font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px; max-width: 360px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* delta colours */
.bad     { color: #c0392b; font-weight: 700; }
.warn    { color: #d68910; font-weight: 600; }
.good    { color: #1e8449; }
.neutral { color: #bbb; }
.swatch  { font-size: 11px; }

.table-note { font-size: 11px; color: #888; margin: 6px 0 0; }
.empty      { color: #888; font-style: italic; }

/* distortions */
.distortions {
  background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px;
  padding: 16px 20px; margin-top: 36px;
}
.distortions h2 { color: #92400e; margin-top: 0; }
.distortions ul { margin: 0; padding-left: 20px; }
.distortions li { color: #78350f; margin-bottom: 6px; }
`;

export function render(result: PipelineResult): string {
  const runsCount = result.control.runs.length;
  const ts = new Date(result.timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AEM Component Perf — ${esc(result.pageId)}</title>
  <style>${CSS}</style>
</head>
<body>

<h1>AEM Component Performance Report</h1>
<p class="meta">
  Original page: <a href="${esc(result.originalUrl)}">${esc(result.originalUrl)}</a><br>
  Measured: ${esc(ts)}
  <span class="runs-badge">${runsCount} run${runsCount !== 1 ? 's' : ''} per page · median</span>
</p>

<h2>Control page baseline</h2>
${baselineCards(result.control.median)}

<h2>Component type attribution</h2>
${attributionTable(result.attribution)}

<div class="distortions">
  <h2>⚠ Known distortions — do not hide</h2>
  <ul>
    ${DISTORTIONS.map((d) => `<li>${d}</li>`).join('\n    ')}
  </ul>
</div>

</body>
</html>`;
}
