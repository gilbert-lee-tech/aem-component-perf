# aem-component-perf

Isolate and measure the performance cost of individual AEM component types on a page, using Lighthouse and controlled page generation.

## Problem

A Lighthouse score on a full AEM page tells you the page is slow, not *which component type* makes it slow. This tool attributes performance cost per component type by generating isolated test pages and measuring the delta against a placeholder-only control page.

## Phases

- **Phase 1 (current): local dev.** Local AEM instance. Build a local MCP server that reads AEM page content (template type, components, `sling:resourceType` / `superResourceType`, JCR data) and creates pages via the Sling POST servlet.
- **Phase 2 (later): production.** Swap the local MCP server for the Adobe I/O-hosted AEM MCP. The analysis pipeline must not change — only the MCP endpoint.

## Workflow

1. User provides an AEM page URL.
2. Run Lighthouse on the original page (baseline + trace for confirmation, see Methodology).
3. Via MCP, read the page: template type, ordered component list, resource types, JCR data.
4. Capture layout: render the original page in headless Chrome (Puppeteer) and record each component instance's bounding box (width × height). Match instances to JCR paths via decoration-div class names or injected `data-path` attributes.
5. Generate test pages, all using the original page's template:
   - **Control page:** every component replaced by a Placeholder component sized to the captured dimensions.
   - **One page per component type:** all instances of the target type kept real, in their original positions and order; every other component replaced by a sized Placeholder.
6. Run Lighthouse on the control page and each isolated page.
7. Generate an HTML report ranking component types by attributed cost.

## Measurement methodology

- **Attribution formula:** `component-type cost = median(isolated page) − median(control page)`. Never compare raw scores across pages without subtracting the control.
- **Variance:** run Lighthouse **5 times per page**, use the median of each metric. Single runs swing ±10–20%.
- **Consistent conditions:** identical throttling settings, headless Chrome, cold cache, publish-mode rendering (`wcmmode=disabled`), every run.
- **Metrics to report per component type:** LCP, TBT, CLS, TTFB delta, transferred bytes (JS/CSS/img attributable to the component's requests), and overall score delta.
- **Confirmation step:** parse the original page's Lighthouse trace (network waterfall, TBT attribution by script URL) and cross-reference against the per-type ranking. The per-type report is a suspect list; the trace confirms.

## Placeholder component

An AEM component (plain HTL, no clientlib category, no JS, no Sling model) rendering a bare `div` with explicit inline `width`/`height` from the captured bounding box.

Requirements:
- Zero cost: must load no CSS/JS beyond the page baseline, or it contaminates the control.
- Exact dimensions per instance, passed as component properties at page-generation time.
- Preserves document order so fold position of real components matches the original page.

## Known distortions (document in the report, do not hide)

- Placeholders paint instantly; if a placeholder is the largest element on a page, LCP is artificially fast. Rankings remain valid; absolute numbers are not.
- Components whose height depends on their own JS (carousels, embeds) get placeholders sized to the *rendered* state.
- Cross-type interaction effects (total page weight thresholds, third-party tags fired only in combination) are invisible by design — the original-page trace covers this.
- Local dev has no dispatcher/CDN and unminified clientlibs: scores are valid for relative comparison only.

## Tech stack

- **TypeScript / Node.js** throughout.
- **Lighthouse** via programmatic API (not CLI) — in-process access to raw result JSON.
- **Puppeteer** for bounding-box capture.
- **MCP TypeScript SDK** for the local AEM MCP server.
- AEM interaction over HTTP: Sling POST servlet for page/component creation, `.infinity.json` for JCR reads.
- HTML report generated from a template; no framework required.

## Repository structure (monorepo)

```
aem-component-perf/
├── CLAUDE.md
├── package.json            # workspaces root
├── packages/
│   ├── mcp-server/         # local AEM MCP server (Phase 1; replaced by Adobe I/O in Phase 2)
│   ├── pipeline/           # orchestrator: capture → generate → measure → attribute
│   └── report/             # HTML report generation
└── aem/
    └── placeholder/        # the Placeholder AEM component (HTL) + install notes
```

Keep `pipeline` MCP-agnostic: it talks to an MCP client interface, so swapping local server → Adobe I/O is config, not code.

## Conventions

- Node 20+, TypeScript strict mode.
- Store all raw Lighthouse JSON per run under `results/<pageId>/<runN>.json`; the report reads from disk so runs are reproducible and re-rankable without re-measuring.
- Test pages created under a dedicated path (e.g. `/content/<site>/perf-test/`) and cleaned up via an explicit `teardown` command, never automatically.
