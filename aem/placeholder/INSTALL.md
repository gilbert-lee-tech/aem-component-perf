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

## Build and install (Content Package)

The package source lives in `aem/placeholder/placeholder-pkg/`.  Run from the repository
root against a running AEM Author instance.  Replace `admin:admin` and
`http://localhost:4502` if your credentials or port differ.

### 1. Build the zip

```bash
cd aem/placeholder/placeholder-pkg && zip -r ../placeholder-pkg.zip . && cd ../../..
```

### 2. Upload

```bash
curl -sf -u admin:admin \
     http://localhost:4502/crx/packmgr/service.jsp \
     -F "cmd=upload" \
     -F "force=true" \
     -F "package=@aem/placeholder/placeholder-pkg.zip" | python3 -m json.tool
```

### 3. Install

```bash
curl -sf -u admin:admin \
     -X POST \
     "http://localhost:4502/crx/packmgr/service/.json/etc/packages/aem-component-perf/placeholder-pkg.zip?cmd=install" \
     | python3 -m json.tool
```

Both curl responses should include `"success": true`.

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
curl -sf -u admin:admin http://localhost:4502/content/placeholder-test \
     -d "jcr:primaryType=nt:unstructured" \
     -d "sling:resourceType=aem-component-perf/components/content/placeholder" \
     -d "width=800" \
     -d "height=300"

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
