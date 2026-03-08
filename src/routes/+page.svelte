<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import {
    SvelteFlow,
    Background,
    MiniMap,
    type Node,
    type Edge,
  } from '@xyflow/svelte';

  import TableNode from '$lib/components/TableNode.svelte';
  import SchemaUploader from '$lib/components/SchemaUploader.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import FlowController from '$lib/components/FlowController.svelte';
  import DomainLegend from '$lib/components/DomainLegend.svelte';
  import CustomControls from '$lib/components/CustomControls.svelte';
  import SchemaEditor from '$lib/components/SchemaEditor.svelte';
  import DomainEditor from '$lib/components/DomainEditor.svelte';

  import { loadDefaultSchema, loadDomainConfig, parseLinkMLSchema } from '$lib/linkml';
  import { buildGraph } from '$lib/layout';
  import type { NormalizedSchema, LayoutOptions, DomainInfo } from '$lib/types';
  import { base } from '$app/paths';

  // ---------------------------------------------------------------------------
  // Domain config — set context synchronously with a reactive holder so
  // TableNode can read it reactively once the fetch resolves.
  // setContext must be called at init time (not inside onMount/async).
  // ---------------------------------------------------------------------------
  const domainCtx = $state<{ map: Map<string, DomainInfo> | null }>({ map: null });
  setContext('domainConfig', domainCtx);

  // ---------------------------------------------------------------------------
  // Node types registration
  // ---------------------------------------------------------------------------
  const nodeTypes = { table: TableNode };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let schema = $state<NormalizedSchema | null>(null);
  let loadError = $state('');
  let collapsed = $state<Set<string>>(new Set());

  // Svelte Flow reactive nodes/edges ($state.raw for performance)
  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);

  // Layout options
  let layoutOptions = $state<LayoutOptions>({ engine: 'dagre', direction: 'LR' });
  let layoutLoading = $state(false);

  // Incremented after layout completes to trigger fitView inside FlowController
  let fitViewTrigger = $state(0);

  // Pan target set by search, cleared by FlowController after use
  let panTarget = $state<string | null>(null);

  // Editor panel visibility
  let schemaEditorOpen = $state(false);
  let domainEditorOpen = $state(false);

  // Raw YAML text kept in sync with the current schema (for SchemaEditor)
  let schemaYamlText = $state('');

  // Domain list derived from domainCtx.map for DomainEditor
  const domainList = $derived<DomainInfo[]>(
    domainCtx.map ? Array.from(domainCtx.map.values()) : []
  );

  // ---------------------------------------------------------------------------
  // Rebuild graph whenever schema, collapsed, or layoutOptions change (async)
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!schema) return;

    // Capture reactive dependencies before entering async context
    const s = schema;
    const c = collapsed;
    const opts = layoutOptions;

    let cancelled = false;

    (async () => {
      layoutLoading = true;
      try {
        const result = await buildGraph(s, c, opts);
        if (!cancelled) {
          nodes = result.nodes;
          edges = result.edges;
          fitViewTrigger += 1;
        }
      } catch (e) {
        if (!cancelled) {
          loadError = `Layout failed: ${(e as Error).message}`;
        }
      } finally {
        if (!cancelled) layoutLoading = false;
      }
    })();

    return () => { cancelled = true; };
  });

  // ---------------------------------------------------------------------------
  // Schema loading
  // ---------------------------------------------------------------------------
  async function loadDefault() {
    loadError = '';
    try {
      // Fetch raw text so we can populate the schema editor
      const text = await fetch(`${base}/omop_cdm.yaml`).then((r) => r.text());
      schema = parseLinkMLSchema(text);
      schemaYamlText = text;
      collapsed = new Set();
    } catch (e) {
      loadError = `Failed to load default schema: ${(e as Error).message}`;
    }
  }

  function handleUploadedSchema(s: NormalizedSchema) {
    schema = s;
    collapsed = new Set();
  }

  function handleUploadedYaml(text: string) {
    schemaYamlText = text;
  }

  // Called by SchemaEditor when the user edits the YAML and it parses cleanly
  function handleSchemaEditorChange(text: string, parsed: NormalizedSchema) {
    schemaYamlText = text;
    schema = parsed;
    collapsed = new Set();
  }

  // Called by DomainEditor when colors/names change
  function handleDomainEditorChange(domains: DomainInfo[]) {
    domainCtx.map = new Map(domains.map((d) => [d.name, d]));
  }

  onMount(() => {
    loadDefault();
    loadDomainConfig()
      .then((map: Map<string, DomainInfo>) => { domainCtx.map = map; })
      .catch((e: unknown) => console.warn('domain-config load failed:', e));
  });

  // ---------------------------------------------------------------------------
  // Search: set pan target — FlowController handles the pan
  // ---------------------------------------------------------------------------
  function handleSearchSelect(classId: string) {
    panTarget = classId;
  }

  // Reference to SearchBar component for programmatic focus
  let searchBar: { focus: () => void } | undefined = $state();

  // Global Cmd-K / Ctrl-K shortcut to activate the search bar
  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      searchBar?.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Layout button helpers
  // ---------------------------------------------------------------------------
  function selectLayout(opts: LayoutOptions) {
    if (layoutLoading) return;
    layoutOptions = opts;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const schemaName = $derived(schema?.name ?? 'Loading…');
  const tableCount = $derived(nodes.filter((n) => n.type === 'table').length);

  // Collect unique domain names present in current nodes (for DomainLegend).
  // Cast via unknown because Node data is typed as Record<string,unknown>.
  const activeDomainNames = $derived(
    [...new Set(
      nodes
        .map((n) => (n.data as unknown as { domain?: string }).domain)
        .filter((d): d is string => typeof d === 'string')
    )]
  );

  // Only show the legend when at least one node has a domain annotation.
  const hasDomains = $derived(activeDomainNames.length > 0);

  // Edge count label: distinguish FK vs ETL
  const fkEdgeCount = $derived(
    edges.filter((e) => (e.data as unknown as { edgeKind?: string })?.edgeKind !== 'etl').length
  );
  const etlEdgeCount = $derived(
    edges.filter((e) => (e.data as unknown as { edgeKind?: string })?.edgeKind === 'etl').length
  );
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="app">
  <!-- Domain legend sidebar — only shown when schema has domain-annotated classes -->
  {#if schema && hasDomains}
    <DomainLegend {activeDomainNames} />
  {/if}

  <div class="canvas-wrap">
    <!-- Top bar -->
    <div class="topbar">
      <div class="topbar-left">
        <span class="app-title">LinkML ERD Viewer</span>
        {#if schema}
          <span class="schema-name">{schemaName}</span>
          <span class="node-count">
            {tableCount} tables
            {#if fkEdgeCount > 0} · {fkEdgeCount} FK{/if}
            {#if etlEdgeCount > 0} · {etlEdgeCount} ETL{/if}
          </span>
        {/if}
        {#if loadError}
          <span class="load-error">⚠ {loadError}</span>
        {/if}
      </div>

      <div class="topbar-center">
        <SearchBar bind:this={searchBar} {schema} onselect={handleSearchSelect} />
      </div>

      <div class="topbar-right">
        <!-- Schema editor toggle -->
        <button
          class="editor-btn"
          class:active={schemaEditorOpen}
          title="Edit schema YAML"
          onclick={() => { schemaEditorOpen = !schemaEditorOpen; }}
          aria-pressed={schemaEditorOpen}
        >
          <span class="editor-btn-icon">&lt;/&gt;</span>
          Schema
        </button>

        <!-- Domain config editor toggle -->
        <button
          class="editor-btn"
          class:active={domainEditorOpen}
          title="Edit domain colors"
          onclick={() => { domainEditorOpen = !domainEditorOpen; }}
          aria-pressed={domainEditorOpen}
        >
          <span class="editor-btn-icon">&#9678;</span>
          Domains
        </button>

        <div class="uploader-wrap">
          <SchemaUploader
            onschema={handleUploadedSchema}
            onreset={loadDefault}
            onyaml={handleUploadedYaml}
          />
        </div>
      </div>
    </div>

    <!-- Main content row: canvas + optional editor panels -->
    <div class="content-row">
      <!-- Svelte Flow canvas -->
      <div class="canvas-area">
        {#if schema && nodes.length > 0}
          <SvelteFlow
            bind:nodes
            bind:edges
            {nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: false }}
          >
            <FlowController
              {panTarget}
              {nodes}
              {fitViewTrigger}
              onpanned={() => { panTarget = null; }}
              onhighlight={(updated) => { nodes = updated; }}
            />
            <Background />
            <CustomControls
              {layoutOptions}
              {layoutLoading}
              onlayoutselect={selectLayout}
            />
            <MiniMap
              nodeColor={(n) => {
                const domain = (n.data as unknown as { domain?: string }).domain;
                const map = domainCtx.map;
                if (!domain || !map) return '#475569';
                return map.get(domain)?.color ?? map.get('default')?.color ?? '#475569';
              }}
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
          </SvelteFlow>
        {:else if schema && nodes.length === 0}
          <div class="empty-state">
            <p>No tables to show.</p>
            <p>Upload a LinkML YAML schema to get started.</p>
          </div>
        {:else}
          <div class="loading-state">
            <span class="loading-spinner">⟳</span>
            Loading schema…
          </div>
        {/if}
      </div>

      <!-- Schema YAML editor panel -->
      {#if schemaEditorOpen}
        <SchemaEditor
          yamlText={schemaYamlText}
          onchange={handleSchemaEditorChange}
          onclose={() => { schemaEditorOpen = false; }}
        />
      {/if}

      <!-- Domain color editor panel -->
      {#if domainEditorOpen}
        <DomainEditor
          domains={domainList}
          onchange={handleDomainEditorChange}
          onclose={() => { domainEditorOpen = false; }}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .app {
    display: flex;
    height: 100vh;
    width: 100vw;
    font-family: ui-sans-serif, system-ui, sans-serif;
    background: #f3f4f6;
  }

  .canvas-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    min-width: 0;
  }

  /* Top bar */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 14px;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    z-index: 20;
    gap: 12px;
    flex-shrink: 0;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .topbar-center {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .app-title {
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .schema-name {
    font-size: 12px;
    color: #475569;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .node-count {
    font-size: 11px;
    color: #6b7280;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .load-error {
    font-size: 11px;
    color: #dc2626;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* Editor toggle buttons */
  .editor-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #fff;
    border: 1.5px solid #d1d5db;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s ease;
  }

  .editor-btn:hover {
    border-color: #6b7280;
    background: #f9fafb;
  }

  .editor-btn.active {
    background: #1e293b;
    border-color: #1e293b;
    color: #fff;
  }

  .editor-btn-icon {
    font-size: 11px;
    opacity: 0.8;
  }

  .uploader-wrap {
    position: relative;
  }

  /* Main content row: canvas + panels side by side */
  .content-row {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  .canvas-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  /* Canvas */
  :global(.svelte-flow) {
    flex: 1;
  }

  .empty-state,
  .loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #6b7280;
    font-size: 14px;
    gap: 8px;
  }

  .loading-spinner {
    font-size: 28px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
</style>
