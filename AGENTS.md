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
| Layout engine | `@dagrejs/dagre` v2 (LR directed graph) |
| YAML parsing | `js-yaml` v4 |
| Language | TypeScript 5, strict mode |
| Build tool | Vite 7 |
| Adapter | `@sveltejs/adapter-static` (static SPA, GitHub Pages) |

---

## Directory layout

```
plugin-link/
├── justfile                      # default recipe: npm run dev
├── svelte.config.js              # adapter-static, base: /plugin-link in prod
├── static/
│   └── omop_cdm.yaml             # default schema (OMOP CDM v5.4, fully merged, 13 879 lines)
└── src/
    ├── routes/
    │   ├── +layout.ts            # prerender=true, ssr=false (pure client-side SPA)
    │   ├── +layout.svelte        # Svelte Flow CSS import, global box-sizing/overflow
    │   └── +page.svelte          # main app: state, canvas wiring, top bar
    └── lib/
        ├── types.ts              # all shared TypeScript interfaces
        ├── linkml.ts             # schema parser (YAML + JSON) and loadDefaultSchema()
        ├── layout.ts             # dagre auto-layout → Svelte Flow nodes/edges
        └── components/
            ├── TableNode.svelte  # custom node: collapsible table card with slot rows
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
```

1. On mount, `+page.svelte` fetches `omop_cdm.yaml` and calls `parseLinkMLSchema()`.
2. The `NormalizedSchema` is stored in `$state`.
3. A `$effect` calls `buildGraph()` whenever `schema` or `collapsed` changes, writing new `Node[]` / `Edge[]` into `$state.raw`.
4. Svelte Flow re-renders reactively.

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

### Normalized JSON (legacy)

If the parsed object already has a top-level `classes` object (the shape produced by the Python `SchemaView` export script in `omop-link`), it is passed through as-is without re-parsing.

---

## Auto-layout (`src/lib/layout.ts`)

`buildGraph(schema, collapsed)` produces `Node[]` and `Edge[]` for Svelte Flow.

- **dagre** is run in `LR` (left-to-right) rank direction.
- Node heights are estimated from slot count: `header (36px) + rows × 24px + 8px padding`, capped at 20 visible rows. Collapsed nodes use only the header height (36px).
- All nodes and edges use a single neutral color: `#475569` (slate-600). Required FK edges get `stroke-width: 2`; optional get `1.5`.
- Edge IDs are `source--slotName--target`, with a counter suffix for duplicates.
- Isolated nodes (no dagre position) are skipped silently.

---

## Custom node (`src/lib/components/TableNode.svelte`)

- Renders as a 260px-wide card with a slate-colored header and collapsible slot rows.
- Click the header to toggle collapse.
- Each slot row shows a badge (`PK` in amber, `FK` in slate, blank for plain slots), the display name (bold if required), and the range type in italic gray.
- Rows beyond 20 are hidden with a "+N more…" overflow indicator.
- Svelte Flow v1 requires `Node<Data>` where `Data extends Record<string, unknown>`. Since `ErdNodeData` contains `slots: ErdSlot[]` (not assignable to `Record<string, unknown>` under strict mode), `data` is cast via `as unknown as ErdNodeData` in `layout.ts`. In `TableNode.svelte`, the prop is re-derived reactively with `$derived(data as unknown as ErdNodeData)` to avoid the `state_referenced_locally` Svelte 5 lint warning.

---

## State management (`src/routes/+page.svelte`)

Uses Svelte 5 runes throughout:

| Rune | Variable | Purpose |
|---|---|---|
| `$state` | `schema` | Current `NormalizedSchema` (null while loading) |
| `$state` | `loadError` | Error message string |
| `$state` | `collapsed` | `Set<string>` of collapsed node IDs |
| `$state.raw` | `nodes` | `Node[]` — raw avoids deep reactivity overhead |
| `$state.raw` | `edges` | `Edge[]` — raw avoids deep reactivity overhead |
| `$effect` | — | Rebuilds `nodes`/`edges` when `schema` or `collapsed` changes |
| `$derived` | `classCount`, `schemaName`, `tableCount` | Computed display values |

`$state.raw` is used for `nodes` and `edges` per the [Svelte Flow performance recommendation](https://github.com/sveltejs/svelte/issues/11851) — deep reactivity on large node arrays causes noticeable lag.

---

## Build configuration

- **`svelte.config.js`**: uses `adapter-static` with `fallback: '404.html'` for client-side routing on GitHub Pages. The `base` path is `/plugin-link` in production (`NODE_ENV=production`) and empty in development.
- **`src/routes/+layout.ts`**: sets `prerender = true` and `ssr = false`, making the entire app a client-side SPA with statically prerendered HTML shells.
- **`vite.config.ts`**: minimal — just the `sveltekit()` plugin.

---

## Known noise (not bugs)

- `"handleConnectionChange" is imported … but never used` — originates inside `@xyflow/svelte`; not our code.
- LSP may show stale type errors in `.svelte` files. **`npm run build` is the ground truth** — the build is clean.
