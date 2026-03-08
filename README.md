# plugin-link

A generic [LinkML](https://linkml.io/) ERD viewer built with [SvelteKit](https://svelte.dev/docs/kit) and [Svelte Flow](https://svelteflow.dev/).

Upload any LinkML schema YAML file and explore it as an interactive entity-relationship diagram. Nodes are collapsible table cards; edges are foreign-key relationships inferred from `range:` fields that resolve to other classes in the schema.

Defaults to the fully merged [OMOP CDM](https://ohdsi.github.io/CommonDataModel/) schema.

## Usage

```sh
npm install
npm run dev        # or: just
```

Open http://localhost:5173/plugin-link

To build for production:

```sh
npm run build
npm run preview
```

## Features

- Drag-and-drop upload of any `.yaml` / `.yml` LinkML schema
- Auto-layout via [Dagre](https://github.com/dagrejs/dagre)
- Collapsible table nodes
- Supports both LinkML slot styles:
  - `attributes:` (inline per class)
  - `slots:` list + top-level `slots:` dict + `slot_usage:` overrides

## Project structure

```
src/
  lib/
    types.ts          # ErdSlot, ErdClass, NormalizedSchema, ErdNodeData
    linkml.ts         # YAML parser + loadDefaultSchema()
    layout.ts         # buildGraph(schema, collapsed) → Svelte Flow nodes/edges
    components/
      TableNode.svelte
      SchemaUploader.svelte
  routes/
    +layout.ts        # prerender=true, ssr=false
    +layout.svelte
    +page.svelte
static/
  omop_cdm.yaml       # default schema (OMOP CDM v5.4, fully merged)
```

See [AGENTS.md](./AGENTS.md) for architecture notes and design decisions.
