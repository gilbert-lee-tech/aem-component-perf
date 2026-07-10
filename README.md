# aem-component-perf

Isolate and measure the performance cost of individual AEM component types on a page, using Lighthouse and controlled page generation.

## Problem

A Lighthouse score on a full AEM page tells you the page is slow — not *which component type* makes it slow. This tool attributes performance cost per component type by generating isolated test pages and measuring the delta against a placeholder-only control page.

## How it works

1. Read the target page's JCR structure (template, component list, resource types) via MCP.
2. Capture each component instance's bounding box using Puppeteer.
3. Generate test pages on the same template:
   - **Control page** — every visible component replaced by a zero-cost Placeholder sized to its captured dimensions.
   - **One isolated page per component type** — all instances of the target type kept real; everything else replaced by sized Placeholders.
4. Run Lighthouse 5× on the control page and each isolated page.
5. Attribution formula: `component cost = median(isolated) − median(control)`.
6. Generate an HTML report ranking component types by attributed cost.

## Repository structure

```
aem-component-perf/
├── package.json               # npm workspaces root (Node 20+)
├── .env.example               # copy to .env and fill in credentials
├── packages/
│   ├── mcp-server/            # local AEM MCP server (Phase 1)
│   ├── pipeline/              # orchestrator: capture → generate → measure → attribute
│   └── report/                # HTML report generation
└── aem/
    └── placeholder/
        ├── placeholder-pkg/   # FileVault content package source
        └── INSTALL.md         # step-by-step install instructions
```

`pipeline` is MCP-agnostic — it talks to an MCP client interface. Swapping the local MCP server for Adobe I/O (Phase 2) is a config change, not a code change.

## Prerequisites

- Node.js 20+
- A running AEM Author instance with WKND (or your own site) installed
- The Placeholder component deployed to `/apps/aem-component-perf/components/content/placeholder` (see [Install the Placeholder component](#install-the-placeholder-component))

## Setup

### 1. Install dependencies and build

```bash
npm install
npm run build
```

### 2. Configure credentials

```bash
cp .env.example .env
# edit .env — set AEM_URL, AEM_USER, AEM_PASS
```

`.env` is gitignored. The pipeline also accepts `--aem-url`, `--aem-user`, and `--aem-pass` flags directly.

### 3. Install the Placeholder component

The Placeholder is a plain HTL component with no clientlib, no JS, and no Sling model. It must be installed in AEM before the pipeline can generate test pages.

Full instructions are in [`aem/placeholder/INSTALL.md`](aem/placeholder/INSTALL.md). Short version:

```bash
# Build the content package
cd aem/placeholder/placeholder-pkg && zip -r ../placeholder-pkg.zip . && cd ../../..

# Upload
curl -sf -u admin:admin http://localhost:4502/crx/packmgr/service.jsp \
     -F "cmd=upload" -F "force=true" \
     -F "file=@aem/placeholder/placeholder-pkg.zip"

# Install
curl -sf -u admin:admin -X POST \
     "http://localhost:4502/crx/packmgr/service/.json/etc/packages/aem-component-perf/aem-component-perf-placeholder-1.0.zip?cmd=install"
```

### 4. Create the test-page root

```bash
curl -sf -u admin:admin http://localhost:4502/content/perf-test \
     -d "jcr:primaryType=cq:Page" \
     -d "jcr:content/jcr:title=Perf Test Pages" \
     -d "jcr:content/jcr:primaryType=cq:PageContent"
```

## Usage

### Run the pipeline

```bash
npx aem-pipeline run --url http://localhost:4502/content/wknd/en/my-page
```

Common options:

| Flag | Default | Description |
|------|---------|-------------|
| `--url` | *(required)* | AEM page URL to analyse |
| `--aem-url` | `$AEM_URL` / `http://localhost:4502` | AEM Author base URL |
| `--aem-user` | `$AEM_USER` / `admin` | AEM username |
| `--aem-pass` | `$AEM_PASS` / `admin` | AEM password |
| `--test-root` | `/content/perf-test` | JCR path where test pages are created |
| `--placeholder-type` | `aem-component-perf/components/content/placeholder` | Sling resource type of the Placeholder component |
| `--runs` | `5` | Lighthouse runs per page (use `3` on low-memory AEM) |
| `--results-dir` | `./results` | Directory for raw Lighthouse JSON output |

Raw results are written to `results/<pageId>/attribution.json` (and one JSON per run). Re-running the report does not require re-measuring.

### Generate the HTML report

```bash
npx aem-report --results-dir ./results --page-id <pageId>
```

### Tear down test pages

Test pages are never cleaned up automatically. Run teardown when you're done:

```bash
npx aem-pipeline teardown --url http://localhost:4502/content/wknd/en/my-page
```

## Placeholder rules

**A component node is replaced with a sized Placeholder when ALL of the following are true:**

1. The node has a captured bounding box (it was visible when the page was rendered).
2. Its `sling:resourceType` does not contain `container` or `dam/cfm`.
3. Its `sling:resourceSuperType` (looked up from the component definition in `/apps` or `/libs`) does NOT contain `container`.

**No isolated test page is created if `sling:resourceType` contains:**

- `container` — layout containers that hold other components; placeholder-ing them breaks child layout.
- `dam/cfm` — CFM internal scaffolding nodes, not content components.

## Measurement methodology

- **Attribution formula:** `component cost = median(isolated) − median(control)`. Never compare raw scores across pages without subtracting the control.
- **Variance:** 5 Lighthouse runs per page; median of each metric is used. Single runs swing ±10–20 points.
- **Consistent conditions:** identical throttling, headless Chrome, cold cache, `wcmmode=disabled` on every run.
- **Metrics reported per component type:** LCP delta, TBT delta, CLS delta, overall score delta.
- **Confirmation step:** the original page's Lighthouse trace (network waterfall, TBT breakdown by script URL) cross-references the per-type ranking. The ranking is a suspect list; the trace confirms.

## Known distortions

Document these in the report — do not hide them:

- Placeholders paint instantly. If a placeholder is the largest painted element, LCP is artificially fast. **Rankings remain valid; absolute numbers are not.**
- Components whose height depends on their own JS (carousels, embeds) get placeholders sized to their rendered state — their isolated-page layout may differ from the original.
- Cross-type interaction effects (combined page weight thresholds, third-party tags that only fire in combination) are invisible by design. The original-page trace covers this case.
- Local dev has no dispatcher or CDN and uses unminified clientlibs. Scores are valid for **relative comparison only** — not for benchmarking against production.

## Tech stack

- **TypeScript / Node.js 20+**, strict mode, ESM, npm workspaces
- **Lighthouse** (programmatic API) — in-process access to raw result JSON
- **Puppeteer** — headless Chrome for bounding-box capture
- **MCP TypeScript SDK** — local AEM MCP server
- AEM over HTTP: Sling POST servlet for page/node creation, `.infinity.json` for JCR reads
