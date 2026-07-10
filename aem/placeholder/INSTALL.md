# Placeholder Component — Install Notes

A zero-cost AEM component that renders a single unstyled `<div>` sized to exact pixel
dimensions supplied as JCR properties.  It must load **no CSS, no JS, and no Sling
model** — any clientlib or network request it triggers contaminates the control page and
invalidates attribution results.

---

## Install path and resource type

Install the component at:

```
/apps/aem-component-perf/components/content/placeholder
```

The resulting `sling:resourceType` — used as the `--placeholder-type` flag — is:

```
aem-component-perf/components/content/placeholder
```

---

## Method 1 — Sling POST (fastest for local dev)

Run from the repository root against a running AEM Author instance.  
Replace `admin:admin` and `http://localhost:4502` if your credentials or port differ.

```bash
BASE=http://localhost:4502
CREDS=admin:admin

# 1. Create the folder hierarchy (safe to re-run; updates existing nodes).
curl -sf -u "$CREDS" -X POST "$BASE/apps/aem-component-perf" \
     -d "jcr:primaryType=sling:Folder"

curl -sf -u "$CREDS" -X POST "$BASE/apps/aem-component-perf/components" \
     -d "jcr:primaryType=sling:Folder"

curl -sf -u "$CREDS" -X POST "$BASE/apps/aem-component-perf/components/content" \
     -d "jcr:primaryType=sling:Folder"

# 2. Create the cq:Component node.
curl -sf -u "$CREDS" -X POST \
     "$BASE/apps/aem-component-perf/components/content/placeholder" \
     -d "jcr:primaryType=cq:Component" \
     -d "jcr:title=Perf Placeholder" \
     -d "jcr:description=Zero-cost sized placeholder for performance testing." \
     -d "componentGroup=.hidden"

# 3. Upload the HTL script.
curl -sf -u "$CREDS" \
     "$BASE/apps/aem-component-perf/components/content/placeholder/" \
     -F "placeholder.html=@aem/placeholder/placeholder.html;type=text/html"
```

All five commands exit silently on success (HTTP 200/201).  Pass `-v` to any curl call
to inspect the response if something goes wrong.

---

## Method 2 — FileVault (vlt)

If you have FileVault configured and checked out `/apps` already:

```bash
mkdir -p jcr_root/apps/aem-component-perf/components/content/placeholder
cp aem/placeholder/.content.xml \
   jcr_root/apps/aem-component-perf/components/content/placeholder/.content.xml
cp aem/placeholder/placeholder.html \
   jcr_root/apps/aem-component-perf/components/content/placeholder/placeholder.html

vlt commit -m "Add perf-placeholder component"
```

---

## Method 3 — Content Package (reproducible / CI)

Build a minimal content package from the two component files and install via Package
Manager (`http://localhost:4502/crx/packmgr`).

### Package structure

```
placeholder-pkg/
├── META-INF/vault/
│   ├── filter.xml
│   └── properties.xml
└── jcr_root/apps/aem-component-perf/components/content/placeholder/
    ├── .content.xml
    └── placeholder.html
```

### `META-INF/vault/filter.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
  <filter root="/apps/aem-component-perf/components/content/placeholder"/>
</workspaceFilter>
```

### `META-INF/vault/properties.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
  <entry key="name">aem-component-perf-placeholder</entry>
  <entry key="version">1.0</entry>
  <entry key="group">aem-component-perf</entry>
</properties>
```

### Build and install

```bash
cd placeholder-pkg
zip -r ../placeholder-pkg.zip .
cd ..

curl -sf -u admin:admin \
     http://localhost:4502/crx/packmgr/service.jsp \
     -F "cmd=upload" \
     -F "force=true" \
     -F "package=@placeholder-pkg.zip" | python3 -m json.tool

curl -sf -u admin:admin \
     -X POST \
     "http://localhost:4502/crx/packmgr/service/.json/etc/packages/aem-component-perf/placeholder-pkg.zip?cmd=install" \
     | python3 -m json.tool
```

---

## Verify the install

### 1. Component node exists

```bash
curl -s -u admin:admin \
     "http://localhost:4502/apps/aem-component-perf/components/content/placeholder.infinity.json" \
     | python3 -m json.tool
```

Expected output includes `"jcr:primaryType": "cq:Component"` and `"componentGroup": ".hidden"`.

### 2. HTL script is present and resolves

```bash
curl -s -u admin:admin \
     "http://localhost:4502/apps/aem-component-perf/components/content/placeholder/placeholder.html"
```

Expected output (verbatim):

```html
<div style="display:block;width:${properties.width @ context='number'}px;height:${properties.height @ context='number'}px;"></div>
```

### 3. Component renders correctly

Create a test node with explicit dimensions and request it:

```bash
# Create a test page node (assumes /content/we-retail exists; adapt path as needed)
curl -sf -u admin:admin http://localhost:4502/content/placeholder-test \
     -d "jcr:primaryType=nt:unstructured" \
     -d "sling:resourceType=aem-component-perf/components/content/placeholder" \
     -d "width=800" \
     -d "height=300"

# Render it (expect a 800×300 div, nothing else)
curl -s -u admin:admin \
     "http://localhost:4502/content/placeholder-test.html?wcmmode=disabled"
```

The response body should contain exactly:

```html
<div style="display:block;width:800px;height:300px;"></div>
```

---

## Zero-cost check (critical)

Contamination from extra CSS or JS silently inflates the control page baseline and biases
every attribution result.  Run this check before starting any measurement run.

Open a browser, log in to AEM, navigate to a page that uses only placeholder components
with `?wcmmode=disabled`, and open DevTools → Network.  Filter by JS and CSS.  **No
requests should appear beyond the page template's own clientlibs.**

Alternatively, run a quick Lighthouse check on the control page and compare its
transferred-bytes figure to a known-clean page.  The delta should be zero or only a few
bytes of HTML overhead.

To confirm there is no `cq:ClientLibraryFolder` node under the component:

```bash
curl -s -u admin:admin \
     "http://localhost:4502/apps/aem-component-perf/components/content/placeholder.infinity.json" \
     | python3 -c "import sys,json; d=json.load(sys.stdin); print([k for k in d if 'clientlib' in k.lower() or d.get(k,{}).get('jcr:primaryType')=='cq:ClientLibraryFolder'])"
```

Expected output: `[]`

---

## Pipeline configuration

Pass the resource type as the `--placeholder-type` flag when running the pipeline:

```bash
aem-pipeline run \
  --url http://localhost:4502/content/mysite/en/home \
  --placeholder-type aem-component-perf/components/content/placeholder \
  --test-root /content/mysite/perf-test
```

The `--test-root` path (`/content/mysite/perf-test` in the example) must already exist
as a `cq:Page` or `sling:Folder` node before the pipeline runs.  Create it once:

```bash
curl -sf -u admin:admin http://localhost:4502/content/mysite/perf-test \
     -d "jcr:primaryType=cq:Page" \
     -d "jcr:content/jcr:title=Perf Test Pages" \
     -d "jcr:content/jcr:primaryType=cq:PageContent"
```
