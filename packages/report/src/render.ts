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
  <table id="attribution-table">
    <thead>
      <tr>
        <th data-col="0">#</th>
        <th data-col="1">Component type</th>
        <th data-col="2">TBT&thinsp;Δ</th>
        <th data-col="3">LCP&thinsp;Δ</th>
        <th data-col="4">CLS&thinsp;Δ</th>
        <th data-col="5">TTFB&thinsp;Δ</th>
        <th data-col="6">Score&thinsp;Δ</th>
        <th data-col="7">Bytes&thinsp;Δ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="table-note">
    Δ = isolated page median − control page median. Click any column header to sort.
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
  color: #0f172a;
  background: #f0f4ff;
  margin: 0;
  padding: 0 0 64px;
}

/* page header bar */
.page-header {
  background: #1e3a5f;
  color: #fff;
  padding: 20px 32px 18px;
  margin-bottom: 28px;
  box-shadow: 0 2px 8px rgba(0,0,0,.18);
}
.page-header h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; color: #fff; }
.page-header a { color: #93c5fd; text-decoration: none; }
.page-header a:hover { text-decoration: underline; }
.page-header .meta { color: #bfdbfe; font-size: 13px; margin: 0; }

.content { padding: 0 32px; }

h2 {
  font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: #2563eb; margin: 28px 0 10px;
}
.runs-badge {
  display: inline-block; font-size: 11px; font-weight: 600;
  background: #dbeafe; color: #1d4ed8; border-radius: 10px;
  padding: 2px 8px; margin-left: 8px; vertical-align: middle;
}

/* baseline cards */
.cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
.card {
  background: #fff;
  border: 1px solid #dbeafe;
  border-left: 4px solid #2563eb;
  border-radius: 8px;
  padding: 12px 18px;
  min-width: 110px;
  box-shadow: 0 1px 4px rgba(37,99,235,.08);
}
.card-label {
  font-size: 10px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: #64748b;
}
.card-value { font-size: 24px; font-weight: 700; color: #1e3a5f; margin: 2px 0 0; }
.card-sub   { font-size: 10px; color: #94a3b8; margin-top: 1px; }

/* attribution table */
table {
  width: 100%; border-collapse: collapse; background: #fff;
  border: 1px solid #bfdbfe; border-radius: 10px; overflow: hidden;
  box-shadow: 0 2px 8px rgba(37,99,235,.08);
}
thead tr { background: #2563eb; }
thead th {
  color: #eff6ff; font-size: 11px; font-weight: 600;
  letter-spacing: .06em; text-transform: uppercase;
  padding: 11px 12px; text-align: right; white-space: nowrap;
  cursor: pointer; user-select: none;
}
thead th:nth-child(1) { text-align: center; width: 36px; }
thead th:nth-child(2) { text-align: left; }
thead th:hover { background: #1d4ed8; }
thead th.sort-asc,
thead th.sort-desc { background: #1e40af; color: #fff; }
.sort-icon { opacity: .4; margin-left: 4px; }
thead th.sort-asc .sort-icon,
thead th.sort-desc .sort-icon { opacity: 1; }

tbody tr:nth-child(odd) { background: #f0f5ff; }
tbody tr:nth-child(even) { background: #fff; }
tbody tr { border-top: 1px solid #e0e9ff; }
tbody tr:hover { background: #dbeafe; }
td {
  padding: 8px 12px; text-align: right;
  font-variant-numeric: tabular-nums;
}
td.rank { text-align: center; color: #94a3b8; font-size: 12px; }
td.resource-type {
  text-align: left; font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px; max-width: 360px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* delta colours */
.bad     { color: #dc2626; font-weight: 700; }
.warn    { color: #d97706; font-weight: 600; }
.good    { color: #16a34a; }
.neutral { color: #94a3b8; }
.swatch  { font-size: 11px; }

.table-note { font-size: 11px; color: #64748b; margin: 6px 0 0; }
.empty      { color: #64748b; font-style: italic; }

/* distortions */
.distortions {
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
  padding: 16px 20px; margin-top: 36px;
}
.distortions h2 { color: #1e3a5f; margin-top: 0; }
.distortions ul { margin: 0; padding-left: 20px; }
.distortions li { color: #1e40af; margin-bottom: 6px; }
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

<div class="page-header">
  <h1>AEM Component Performance Report</h1>
  <p class="meta">
    <a href="${esc(result.originalUrl)}">${esc(result.originalUrl)}</a> &nbsp;·&nbsp;
    ${esc(ts)}
    <span class="runs-badge">${runsCount} run${runsCount !== 1 ? 's' : ''} per page · median</span>
  </p>
</div>

<div class="content">

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

</div>

<script>
(function () {
  var table = document.getElementById('attribution-table');
  if (!table) return;
  var tbody = table.querySelector('tbody');
  var ths = table.querySelectorAll('thead th');
  var state = { col: 5, dir: -1 }; // default: TTFB Δ descending

  function parseVal(text, colIdx) {
    if (colIdx === 1) return text.trim().toLowerCase(); // string sort
    var s = text.replace(/[+−\\u00a0 ]/g, function(c) {
      return c === '+' ? '' : c === '−' ? '-' : '';
    }).replace(/[^0-9.\-]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function updateHeaders() {
    ths.forEach(function (th, i) {
      th.classList.remove('sort-asc', 'sort-desc');
      var icon = th.querySelector('.sort-icon');
      if (!icon) { icon = document.createElement('span'); icon.className = 'sort-icon'; th.appendChild(icon); }
      if (i === state.col) {
        th.classList.add(state.dir === 1 ? 'sort-asc' : 'sort-desc');
        icon.textContent = state.dir === 1 ? ' ▲' : ' ▼';
      } else {
        icon.textContent = ' ⇅';
      }
    });
  }

  function sortTable(colIdx, dir) {
    var rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort(function (a, b) {
      var av = parseVal(a.cells[colIdx] ? a.cells[colIdx].textContent || '' : '', colIdx);
      var bv = parseVal(b.cells[colIdx] ? b.cells[colIdx].textContent || '' : '', colIdx);
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
    rows.forEach(function (r) { tbody.appendChild(r); });
    updateHeaders();
  }

  ths.forEach(function (th, i) {
    th.addEventListener('click', function () {
      if (state.col === i) { state.dir *= -1; }
      else { state.col = i; state.dir = i === 1 ? 1 : -1; }
      sortTable(state.col, state.dir);
    });
  });

  // apply default sort
  sortTable(state.col, state.dir);
})();
</script>

</body>
</html>`;
}
