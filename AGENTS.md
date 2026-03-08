# AGENTS.md — plugin-link

Summary of the project architecture and key design decisions for AI coding agents working on this codebase.

---

## What this is

An interactive **Entity Relationship Diagram (ERD) viewer** built with SvelteKit and Svelte Flow. It parses any [LinkML](https://linkml.io) schema (YAML or JSON) and renders the classes as a pannable, zoomable canvas of table nodes connected by foreign-key edges. The default schema is the OMOP CDM v5.4 (fully merged LinkML YAML).

There is no backend. Everything runs in the browser as a static SPA.

---

## Running the project

```bash
just          # start dev server (npm run dev) at http://localhost:5173
npm run build # production build → build/
npm run check # svelte-check type checking
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 (runes syntax) |
| Canvas | `@xyflow/svelte` v1.5.x (Svelte Flow) |
| Layout engines | `@dagrejs/dagre` v2 (sync) + `elkjs` (async, ELK layered) |
| YAML parsing | `js-yaml` v4 |
| Language | TypeScript 5, strict mode |
| Build tool | Vite 7 |
| Adapter | `@sveltejs/adapter-static` (static SPA, GitHub Pages) |

---

## Directory layout

```
plugin-link/
├── .github/workflows/deploy.yml  # deploy to GitHub Pages on push to main
├── justfile                      # default recipe: npm run dev
├── svelte.config.js              # adapter-static, base: /plugin-link in prod
├── vite.config.ts                # sveltekit() plugin + elkjs web-worker externals
├── static/
│   ├── omop_cdm.yaml             # default schema (OMOP CDM v5.4, fully merged, 13 879 lines)
│   ├── sein.yaml                 # SEIN merged schema (13 HiX staging + 17 OMOP classes, 30 total)
│   ├── hix.yaml                  # HiX staging classes only (13 classes, raw LinkML)
│   ├── sein-omop.yaml            # OMOP CDM subset used by SEIN (17 classes, raw LinkML)
│   ├── domain-config.yaml        # domain name → color/label config (loaded at runtime)
│   └── logo.png                  # favicon
└── src/
    ├── routes/
    │   ├── +layout.ts            # prerender=true, ssr=false (pure client-side SPA)
    │   ├── +layout.svelte        # Svelte Flow CSS import, favicon, global box-sizing/overflow
    │   └── +page.svelte          # main app: state, canvas wiring, top bar, layout toolbar
    └── lib/
        ├── types.ts              # all shared TypeScript interfaces
        ├── linkml.ts             # schema parser (YAML + JSON), loadDefaultSchema(), loadDomainConfig()
        ├── layout.ts             # async buildGraph(schema, collapsed, LayoutOptions) — dagre + elk
        └── components/
            ├── DomainLegend.svelte    # left sidebar: domain color swatches + slot icon key
            ├── FlowController.svelte  # useSvelteFlow() context — pan/highlight/fitView
            ├── SearchBar.svelte       # top-bar search with keyboard nav and canvas pan
            ├── TableNode.svelte       # custom node: collapsible table card with domain header color
            └── SchemaUploader.svelte  # top-bar button + drag-and-drop file picker
```

---

## Data flow

```
static/omop_cdm.yaml  ──fetch──▶  parseLinkMLSchema()  ──▶  NormalizedSchema
uploaded file         ──upload──▶  parseLinkMLSchema()  ──▶  NormalizedSchema
                                                               │
                                                        buildGraph(schema, collapsed)
                                                               │
                                                        Node[] + Edge[]  ──▶  SvelteFlow

static/domain-config.yaml  ──fetch──▶  loadDomainConfig()  ──▶  Map<string, DomainInfo>
                                                                        │
                                              setContext('domainConfig', domainCtx)  ──▶  TableNode + DomainLegend
```

1. On mount, `+page.svelte` fetches `omop_cdm.yaml` and calls `parseLinkMLSchema()`.
2. The `NormalizedSchema` is stored in `$state`.
3. A `$effect` calls `buildGraph()` whenever `schema` or `collapsed` changes, writing new `Node[]` / `Edge[]` into `$state.raw`.
4. Svelte Flow re-renders reactively.
5. In parallel on mount, `loadDomainConfig()` fetches `domain-config.yaml` and populates `domainCtx.map`.
6. `TableNode` and `DomainLegend` read `domainCtx` from Svelte context reactively.

---

## Schema parsing (`src/lib/linkml.ts`)

`parseLinkMLSchema(input)` accepts a string (YAML or JSON) or a pre-parsed object and returns a `NormalizedSchema`.

Two raw LinkML input styles are supported:

### Path A — `attributes:` (inline, per class)

Used by schemas like `omop_cdm.yaml` (the non-merged source):

```yaml
classes:
  Person:
    attributes:
      person_id:
        identifier: true
        required: true
      gender_concept_id:
        range: Concept
```

Each key under `attributes:` becomes an `ErdSlot`. Display name is `alias` → `name` → key.

### Path B — `slots:` list + top-level `slots:` dict + `slot_usage:` overrides

Used by the default `omop_cdm.yaml` (the fully merged `_omop_cdm.yaml`):

```yaml
slots:
  person_id:
    range: integer
    identifier: true
classes:
  person:
    slots:
      - person_id
    slot_usage:
      person_id:
        required: true
```

Merge order: `slot_usage` overrides top-level `slots`. Display name strips the `className_` prefix if present (e.g. `person_person_id` → `person_id`).

Both paths are checked per class; a class may only use one style (both cannot coexist on the same class).

### FK detection

A slot is classified as a foreign key (`is_fk: true`) when all three hold:
- `range` names a class that exists in the schema
- `identifier` is not `true`
- `range` is not in the built-in `PRIMITIVE_RANGES` set

Cross-schema FK targets (range names a class not present in the file) are silently skipped — no ghost nodes.

### Domain annotations

Classes may carry a `domain` annotation:

```yaml
classes:
  person:
    annotations:
      domain:
        tag: domain
        value: clinical
```

`parseRawLinkML()` reads `classDef.annotations?.domain?.value` and stores it as `ErdClass.domain`. The value must match a `name` key in `domain-config.yaml` to receive a color; unknown domain values fall back to the `default` entry.

### exact_mappings (ETL mappings)

Slots may carry `exact_mappings` listing cross-schema column references:

```yaml
attributes:
  gender:
    exact_mappings:
      - omop_cdm54:Person.gender_source_value
```

The parser reads this into `ErdSlot.exact_mappings: string[]` for both Path A and Path B. `TableNode` renders the first entry as an indigo italic badge (prefix stripped), with the full list on hover.

### Normalized JSON (legacy)

If the parsed object is already in the normalized `NormalizedSchema` shape (produced by the Python `SchemaView` export script in `omop-link`), it is passed through as-is without re-parsing.

**Important**: raw LinkML YAML also has a top-level `classes` object, so a simple presence check is not sufficient to distinguish the two formats. `isNormalizedJson()` scans all class entries looking for a discriminating signal:

- If any class has a `slot_usage` key → raw LinkML, route to `parseRawLinkML()`
- If any class has `slots` as a non-empty string array → raw LinkML (slot reference names), route to `parseRawLinkML()`
- If any class has `slots` as a non-empty object array → normalized JSON, pass through
- Classes with empty/absent `slots` carry no signal and are skipped
- If no signal is found across all classes (all slot-less) → conservatively treat as raw LinkML

Scanning all classes (not just the first) avoids misidentification when the first class happens to have no slots.

---

## Domain configuration (`static/domain-config.yaml`)

Domain colors and labels are defined in `static/domain-config.yaml`, **not hardcoded in TypeScript**. This means new domains can be added by editing YAML only.

```yaml
domains:
  - name: clinical
    label: Clinical
    color: "#2563eb"
    text_color: "#ffffff"
  - name: default
    label: Other
    color: "#475569"
    text_color: "#ffffff"
```

Each entry maps to the `DomainInfo` interface (`name`, `label`, `color`, `text_color`). The `default` entry is used as a fallback for classes whose domain value does not match any named entry; it is excluded from the `DomainLegend` swatch list.

`loadDomainConfig()` in `linkml.ts` fetches the file at runtime and returns a `Map<string, DomainInfo>` keyed by `name`.

### Context pattern

`+page.svelte` sets a reactive `$state` wrapper as Svelte context **synchronously at init time** so that child components (`TableNode`, `DomainLegend`) can call `getContext` during their own synchronous initialization:

```typescript
// +page.svelte — at module script top level (NOT inside onMount)
const domainCtx = $state<{ map: Map<string, DomainInfo> | null }>({ map: null });
setContext('domainConfig', domainCtx);

// Then in onMount, populate the map after the async fetch:
onMount(() => {
  loadDomainConfig().then((map) => { domainCtx.map = map; });
});
```

Child components read the context and derive colors reactively:

```typescript
// TableNode.svelte / DomainLegend.svelte
const domainCtx = getContext<{ map: Map<string, DomainInfo> | null }>('domainConfig');
const headerColor = $derived(domainCtx?.map?.get(rawData.domain)?.color ?? '#475569');
```

Because `domainCtx` is a `$state` object (not a plain value), mutations to `domainCtx.map` are visible reactively in all child `$derived` expressions without requiring a new `setContext` call.

---

## Auto-layout (`src/lib/layout.ts`)

`buildGraph(schema, collapsed, layoutOptions)` produces `Node[]` and `Edge[]` for Svelte Flow. It is **async** to support the ELK engine.

### Layout engines

Two engines are supported, selected via `LayoutOptions`:

- **dagre** (`engine: 'dagre'`): synchronous, uses `@dagrejs/dagre` v2. Direction is `LR` or `TB` via `rankdir`.
- **ELK** (`engine: 'elk'`): async, uses `elkjs` with the `org.eclipse.elk.layered` algorithm. Direction controlled via `elk.direction` (`RIGHT` or `DOWN`).

### Node sizing

Node heights are estimated from slot count: `header (36px) + rows × 24px + 8px padding`, capped at 20 visible rows. Collapsed nodes use only the header height (36px).

### Edges

All nodes and edges use a single neutral color: `#475569` (slate-600). Required FK edges get `stroke-width: 2`; optional get `1.5`. Edge IDs are `source--slotName--target`, with a counter suffix for duplicates. Isolated nodes (no layout position) are skipped silently.

The `domain` field from `ErdClass` is propagated into `ErdNodeData` by both the Dagre and ELK build paths so that `TableNode` and `DomainLegend` can access it without querying the schema separately.

---

## Custom node (`src/lib/components/TableNode.svelte`)

- Renders as a 260px-wide card with a **domain-colored header** (falls back to slate-600 for undomain-annotated classes).
- Header color and text color are `$derived` from `domainCtx.map` read via `getContext('domainConfig')`. Updates reactively once the domain config fetch resolves.
- Click the header to toggle collapse.
- Each slot row shows:
  - A badge: `PK` (amber) for identifiers, `FK` (slate) for foreign keys, blank for plain slots
  - The display name (bold if required)
  - The range type in italic gray
  - An **indigo italic ETL mapping badge** showing `exact_mappings[0]` with the prefix stripped (e.g. `omop_cdm54:Person.person_source_value` → `Person.person_source_value`). The full list of mappings appears as a tooltip on hover.
- Rows beyond 20 are hidden with a "+N more…" overflow indicator.
- Highlighted nodes (panned-to from search) show a brief amber glow for 1.5s via the `highlighted` flag on `ErdNodeData`.
- Svelte Flow v1 requires `Node<Data>` where `Data extends Record<string, unknown>`. Since `ErdNodeData` contains `slots: ErdSlot[]` (not assignable to `Record<string, unknown>` under strict mode), `data` is cast via `as unknown as ErdNodeData` in `layout.ts`. In `TableNode.svelte`, the prop is re-derived reactively with `$derived(data as unknown as ErdNodeData)` to avoid the `state_referenced_locally` Svelte 5 lint warning.

---

## Domain legend (`src/lib/components/DomainLegend.svelte`)

A left-side sidebar (`170px` wide, `border-right: 1px solid #e5e7eb`) rendered only when the loaded schema has at least one domain-annotated class (`hasDomains` derived in `+page.svelte`).

Props:
- `activeDomainNames: string[]` — the unique domain names found in the current `nodes` array, derived in `+page.svelte`.

Two sections:
1. **Domains** — one row per active domain (colored `14×14` swatch + label). The `default` entry is excluded from this list.
2. **Legend** — slot row icon key: PK badge (amber), FK badge (slate), bold name = required, plain name = optional, indigo italic = ETL mapping.

The component reads `domainCtx` from Svelte context (same reactive wrapper set by `+page.svelte`), so it updates reactively once `loadDomainConfig()` resolves.

---

## State management (`src/routes/+page.svelte`)

Uses Svelte 5 runes throughout:

| Rune | Variable | Purpose |
|---|---|---|
| `$state` | `schema` | Current `NormalizedSchema` (null while loading) |
| `$state` | `loadError` | Error message string |
| `$state` | `collapsed` | `Set<string>` of collapsed node IDs |
| `$state` | `layoutOptions` | Active `LayoutOptions` (engine + direction) |
| `$state` | `fitViewTrigger` | Counter incremented after layout to trigger `fitView` |
| `$state` | `domainCtx` | `{ map: Map<string, DomainInfo> \| null }` — reactive wrapper set as context |
| `$state.raw` | `nodes` | `Node[]` — raw avoids deep reactivity overhead |
| `$state.raw` | `edges` | `Edge[]` — raw avoids deep reactivity overhead |
| `$effect` | — | Rebuilds `nodes`/`edges` (async IIFE with cancellation flag) when `schema`, `collapsed`, or `layoutOptions` changes |
| `$derived` | `classCount`, `schemaName`, `tableCount` | Computed display values |
| `$derived` | `activeDomainNames` | Unique domain strings present in current `nodes` |
| `$derived` | `hasDomains` | `true` when `activeDomainNames.length > 0` — gates `DomainLegend` visibility |

`$state.raw` is used for `nodes` and `edges` per the [Svelte Flow performance recommendation](https://github.com/sveltejs/svelte/issues/11851) — deep reactivity on large node arrays causes noticeable lag.

---

## Build configuration

- **`svelte.config.js`**: uses `adapter-static` with `fallback: '404.html'` for client-side routing on GitHub Pages. The `base` path is `/plugin-link` in production (`NODE_ENV=production`) and empty in development.
- **`src/routes/+layout.ts`**: sets `prerender = true` and `ssr = false`, making the entire app a client-side SPA with statically prerendered HTML shells.
- **`vite.config.ts`**: `sveltekit()` plugin plus two `elkjs`/`web-worker` workarounds:
  - `optimizeDeps.esbuildOptions` — esbuild plugin that marks `web-worker` as external, suppressing the `Could not resolve "web-worker"` error during `npm run dev` pre-bundling.
  - `build.rollupOptions.external: ['web-worker']` — suppresses the same warning during the production Rollup build.
  - `build.chunkSizeWarningLimit: 1600` — silences the bundle-size warning from the ~1.4 MB elkjs chunk.

---

## Known pitfalls

- **`useSvelteFlow()` must be called inside a child of `<SvelteFlow>`** — calling it at page-level script scope crashes the app to a blank page. It lives in `FlowController.svelte`.
- **`setContext` must be called synchronously at component init** — calling it inside `onMount` or inside a `.then()` callback means child components have already called `getContext` and received `undefined`. Always declare the `$state` holder and call `setContext` at the top level of the `<script>` block.
- **elkjs `web-worker`**: elkjs conditionally `require('web-worker')` in Node environments; in the browser it falls back gracefully but causes build-time errors without the two `vite.config.ts` workarounds above.
- **`labelBgStyle`** is not a valid property on the `@xyflow/svelte` `Edge` type — do not use it.
- **LSP stale errors**: LSP may show stale type errors in `.svelte` files (e.g. `LayoutOptions` not found, `buildGraph` wrong arg count, `DomainInfo` not exported). These are false positives — `npm run build` is the ground truth.

---

## Svelte 5 + SvelteKit coding conventions

> Source: https://cursor.directory/svelte5-sveltekit-development-guide

### Key principles

- Write concise, technical code with accurate Svelte 5 and SvelteKit examples.
- Leverage SvelteKit's SSR and SSG capabilities (this project uses SSG/static).
- Prioritize performance and minimal client-side JavaScript.
- Use descriptive variable names and follow Svelte/SvelteKit conventions.
- Organize files using SvelteKit's file-based routing system.

### Code style

- Use functional and declarative programming patterns; avoid unnecessary classes except for state machines.
- Prefer iteration and modularization over code duplication.
- Structure files: component logic, markup, styles, helpers, types.

### Naming conventions

- Lowercase with hyphens for component files (e.g. `auth-form.svelte`).
- PascalCase for component names in imports and usage.
- camelCase for variables, functions, and props.

### TypeScript

- Use TypeScript for all code; prefer `interface` over `type`.
- Avoid enums; use `const` objects instead.
- Enable strict mode (already configured in `tsconfig.json`).

### Svelte 5 runes

```typescript
// Reactive state
let count = $state(0);

// Derived values
let doubled = $derived(count * 2);

// Side effects
$effect(() => {
  console.log(`Count is now ${count}`);
});

// Component props
let { optionalProp = 42, requiredProp } = $props();

// Two-way bindable props
let { bindableProp = $bindable() } = $props();

// Debug (development only)
$inspect(count);
```

Use `$state.raw` for large arrays (e.g. `nodes`, `edges`) to avoid deep-reactivity overhead.

### State machines (complex state)

Use `.svelte.ts` files and classes for complex state:

```typescript
// counter.svelte.ts
class Counter {
  count = $state(0);
  increment() { this.count += 1; }
}
export const counter = new Counter();
```

### Performance

- Use `$state.raw` for large arrays where deep reactivity isn't needed.
- Use `{#key}` blocks to force re-rendering when required.
- Use dynamic imports for code splitting in large apps.
- Use `$effect.tracking()` to optimise effect dependencies.
- Minimise client-side JS; prefer SSR/SSG where possible.

### Project structure

```
src/
  lib/          # shared utilities, components, types
  routes/       # file-based routing (+page.svelte, +layout.svelte, etc.)
  app.html
static/
svelte.config.js
vite.config.ts
```

### Component guidelines

- Create `.svelte` files for components; `.svelte.ts` for logic/state machines.
- Use Svelte's `$props` rune for data passing.
- Use reactive declarations for local state management.

### Routing and data loading

- Use `[slug]` syntax for dynamic routes.
- Use `load` functions for server-side or prerendered data fetching.
- Handle errors with `+error.svelte` pages.

### Accessibility

- Use proper semantic HTML structure.
- Add ARIA attributes where necessary.
- Ensure keyboard navigation for all interactive elements.
- Use `bind:this` to manage focus programmatically.

### Key conventions

1. Embrace Svelte's simplicity — avoid over-engineering.
2. Prioritize Web Vitals (LCP, FID, CLS).
3. Use environment variables for configuration.
4. Keep Svelte and SvelteKit versions up to date.

### Reference documentation

- Svelte 5 runes: https://svelte.dev/docs/svelte/what-are-runes
- Svelte docs: https://svelte.dev/docs
- SvelteKit docs: https://svelte.dev/docs/kit
