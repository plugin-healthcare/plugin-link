# plugin-link

A generic [LinkML](https://linkml.io/) ERD viewer built with [SvelteKit](https://svelte.dev/docs/kit) and [Svelte Flow](https://svelteflow.dev/).

Upload any LinkML schema YAML file and explore it as an interactive entity-relationship diagram. Nodes are collapsible table cards; edges are foreign-key relationships inferred from `range:` fields that resolve to other classes in the schema.

Defaults to the fully merged [OMOP CDM](https://ohdsi.github.io/CommonDataModel/) v5.4 schema. Also includes the **SEIN** schema — a merged HiX staging + OMOP CDM subset with slot-level ETL mappings.

## Usage

```sh
npm install
npm run dev        # or: just
```

Open http://localhost:5173

To build for production:

```sh
npm run build
npm run preview
```

## Features

- Drag-and-drop upload of any `.yaml` / `.yml` LinkML schema
- Auto-layout via [Dagre](https://github.com/dagrejs/dagre) or [ELK](https://eclipse.dev/elk/) (layered algorithm), switchable at runtime
- Left-side **domain legend** sidebar — shown automatically when the schema has domain-annotated classes; lists color swatches and slot row icon key
- **Domain-colored node headers** — each class's header is colored by its domain annotation (configured in `static/domain-config.yaml`)
- **ETL mapping badges** — slots with `exact_mappings` show the target column as an indigo italic badge, with the full mapping list on hover
- Collapsible table nodes (click the header)
- Top-bar search with keyboard navigation and canvas pan-to-node
- MiniMap with domain-aware node coloring
- Supports both LinkML slot styles:
  - `attributes:` (inline per class)
  - `slots:` list + top-level `slots:` dict + `slot_usage:` overrides

## Domains

Classes in a LinkML schema can carry a `domain` annotation. When present, the node header is colored according to the domain's entry in `static/domain-config.yaml`, and the **domain legend** sidebar appears automatically.

### Annotating a class

```yaml
classes:
  Person:
    annotations:
      domain:
        tag: domain
        value: clinical
    attributes:
      person_id:
        identifier: true
```

### Configuring domain colors

Edit `static/domain-config.yaml` to add or change domains — no TypeScript changes required:

```yaml
domains:
  - name: clinical
    label: Clinical
    color: "#2563eb"
    text_color: "#ffffff"
  - name: hix
    label: HiX Source
    color: "#f59e0b"
    text_color: "#ffffff"
  - name: default
    label: Other
    color: "#475569"
    text_color: "#ffffff"
```

The `default` entry is the fallback color for classes whose domain value does not match any named entry. It is not shown in the legend swatch list.

### Built-in domains (SEIN / OMOP)

| Domain | Color | Classes |
|---|---|---|
| `clinical` | blue `#2563eb` | Person, VisitOccurrence, ConditionOccurrence, DrugExposure, Note, … |
| `vocabulary` | violet `#7c3aed` | Concept, Vocabulary, Relationship, … |
| `infrastructure` | emerald `#059669` | Location, CdmSource |
| `era` | amber `#d97706` | DrugEra, ConditionEra, … |
| `episode` | red `#dc2626` | Episode, EpisodeEvent |
| `hix` | yellow `#f59e0b` | HiX staging tables (Patients, Admissions, …) |

## ETL mappings

Slots can declare `exact_mappings` to record cross-schema column mappings (e.g. from a HiX staging column to an OMOP CDM column):

```yaml
attributes:
  patient_number:
    exact_mappings:
      - omop_cdm54:Person.person_source_value
```

The first mapping is shown as an indigo italic badge in the slot row (prefix stripped). Hover over it to see all mappings.

## Included schemas

| File | Description |
|---|---|
| `static/omop_cdm.yaml` | OMOP CDM v5.4 — fully merged, 13 879 lines, default schema |
| `static/sein.yaml` | SEIN — 13 HiX staging + 17 OMOP classes, with `exact_mappings` and domain annotations |
| `static/hix.yaml` | HiX staging classes only (13 classes) |
| `static/sein-omop.yaml` | OMOP CDM subset used by SEIN (17 classes) |

## Project structure

```
src/
  lib/
    types.ts              # ErdSlot, ErdClass, NormalizedSchema, ErdNodeData, DomainInfo
    linkml.ts             # YAML parser, loadDefaultSchema(), loadDomainConfig()
    layout.ts             # buildGraph(schema, collapsed, layoutOptions) → nodes/edges
    components/
      DomainLegend.svelte # left sidebar: domain swatches + slot icon key
      TableNode.svelte    # custom node: domain-colored header, exact_mappings badge
      SchemaUploader.svelte
      SearchBar.svelte
      FlowController.svelte
  routes/
    +layout.ts            # prerender=true, ssr=false
    +layout.svelte
    +page.svelte
static/
  omop_cdm.yaml
  sein.yaml
  hix.yaml
  sein-omop.yaml
  domain-config.yaml      # domain → color/label mapping (edit to add domains)
```

See [AGENTS.md](./AGENTS.md) for architecture notes and design decisions.
