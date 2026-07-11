# slow-components

A self-contained AEM Maven project that installs 4 components designed to simulate backend processing delays. Used as test subjects by the `aem-component-perf` pipeline to produce measurable, reproducible performance cost differences between component types.

## Components

| Component | Resource type | Delay |
|-----------|--------------|-------|
| Delay 2s | `aem-component-perf/components/delay-2s` | 2 s |
| Delay 4s | `aem-component-perf/components/delay-4s` | 4 s |
| Delay 6s | `aem-component-perf/components/delay-6s` | 6 s |
| Delay 8s | `aem-component-perf/components/delay-8s` | 8 s |

All four share a single Sling Model (`DelayModel`) that reads `delaySeconds` injected via the HTL `data-sly-use` expression and blocks in `@PostConstruct` via `Thread.sleep`. The delay happens server-side on every publish-mode render, making it visible to Lighthouse as TTFB cost.

**Author mode** — each component renders a dashed placeholder showing its name; the model is not invoked.

**Publish mode** (`wcmmode=disabled`) — the model is instantiated, sleeps for the configured duration, then renders `Delay Ns (backend delay)`.

## Structure

```
slow-components/
├── core/                   # OSGi bundle — DelayModel Sling Model
│   └── src/main/java/com/aemcomponentperf/core/models/
│       └── DelayModel.java
└── ui.apps/                # Content package — HTL scripts + component nodes
    └── src/main/content/jcr_root/apps/aem-component-perf/components/
        ├── delay-2s/
        ├── delay-4s/
        ├── delay-6s/
        └── delay-8s/
```

## Build & install

Requires a local AEM 6.5 instance running on `localhost:4502` with `admin:admin`.

```bash
cd aem/slow-components

# Build and install to local AEM
mvn clean install -PautoInstallPackage
```

The `autoInstallPackage` profile:
1. Compiles `DelayModel.java` into an OSGi bundle and deploys it directly via the Felix WebConsole (synchronous, no Sling installer lag).
2. Builds the `ui.apps` content package and installs it via CRX Package Manager.

## Verification

After install:

1. **Bundle active** — `http://localhost:4502/system/console/bundles` → search `aemcomponentperf.core` → status `Active`.
2. **Components available** — open any page in AEM Sites editor, insert a component from the group **AEM Slow Perf. Components**.
3. **Delay confirmed** — render a page containing one of the components at `?wcmmode=disabled`; TTFB should reflect the configured delay.
4. **Pipeline** — run `node packages/pipeline/dist/index.js run` from the repo root; the attribution report should rank the components in delay order.
