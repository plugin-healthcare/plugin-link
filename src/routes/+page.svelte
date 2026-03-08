<script lang="ts">
  import { onMount } from 'svelte';
  import {
    SvelteFlow,
    Background,
    Controls,
    ControlButton,
    MiniMap,
    type Node,
    type Edge,
  } from '@xyflow/svelte';

  import TableNode from '$lib/components/TableNode.svelte';
  import SchemaUploader from '$lib/components/SchemaUploader.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import FlowController from '$lib/components/FlowController.svelte';

  import { loadDefaultSchema } from '$lib/linkml';
  import { buildGraph } from '$lib/layout';
  import type { NormalizedSchema, LayoutOptions } from '$lib/types';

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
      schema = await loadDefaultSchema();
      collapsed = new Set();
    } catch (e) {
      loadError = `Failed to load default schema: ${(e as Error).message}`;
    }
  }

  function handleUploadedSchema(s: NormalizedSchema) {
    schema = s;
    collapsed = new Set();
  }

  onMount(loadDefault);

  // ---------------------------------------------------------------------------
  // Search: set pan target — FlowController handles the pan
  // ---------------------------------------------------------------------------
  function handleSearchSelect(classId: string) {
    panTarget = classId;
  }

  // ---------------------------------------------------------------------------
  // Layout button helpers
  // ---------------------------------------------------------------------------
  const LAYOUT_BUTTONS: Array<{ engine: LayoutOptions['engine']; direction: LayoutOptions['direction']; label: string; title: string }> = [
    { engine: 'dagre', direction: 'LR', label: 'D→', title: 'Dagre — left to right' },
    { engine: 'dagre', direction: 'TB', label: 'D↓', title: 'Dagre — top to bottom' },
    { engine: 'elk',   direction: 'LR', label: 'E→', title: 'ELK — left to right' },
    { engine: 'elk',   direction: 'TB', label: 'E↓', title: 'ELK — top to bottom' },
  ];

  function isActive(btn: typeof LAYOUT_BUTTONS[number]) {
    return layoutOptions.engine === btn.engine && layoutOptions.direction === btn.direction;
  }

  function selectLayout(btn: typeof LAYOUT_BUTTONS[number]) {
    if (layoutLoading) return;
    layoutOptions = { engine: btn.engine, direction: btn.direction };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const schemaName = $derived(schema?.name ?? 'Loading…');
  const tableCount = $derived(nodes.filter((n) => n.type === 'table').length);
</script>

<div class="app">
  <div class="canvas-wrap">
    <!-- Top bar -->
    <div class="topbar">
      <div class="topbar-left">
        <span class="app-title">LinkML ERD Viewer</span>
        {#if schema}
          <span class="schema-name">{schemaName}</span>
          <span class="node-count">{tableCount} tables · {edges.length} FK edges</span>
        {/if}
        {#if loadError}
          <span class="load-error">⚠ {loadError}</span>
        {/if}
      </div>
      <div class="topbar-right">
        <SearchBar {schema} onselect={handleSearchSelect} />
        <div class="uploader-wrap">
          <SchemaUploader onschema={handleUploadedSchema} onreset={loadDefault} />
        </div>
      </div>
    </div>

    <!-- Svelte Flow canvas -->
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
        <Controls>
          {#snippet children()}
            <!-- Separator -->
            <div class="ctrl-sep" role="separator"></div>
            {#each LAYOUT_BUTTONS as btn}
              <ControlButton
                title={btn.title}
                onclick={() => selectLayout(btn)}
                disabled={layoutLoading}
                class={isActive(btn) ? 'ctrl-btn-active' : ''}
              >
                {#if layoutLoading && isActive(btn)}
                  <span class="ctrl-spin">⟳</span>
                {:else}
                  {btn.label}
                {/if}
              </ControlButton>
            {/each}
          {/snippet}
        </Controls>
        <MiniMap nodeColor={() => '#475569'} nodeStrokeWidth={3} zoomable pannable />
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

  .uploader-wrap {
    position: relative;
  }

  /* Canvas */
  :global(.svelte-flow) {
    flex: 1;
  }

  /* Layout buttons inside Controls */
  .ctrl-sep {
    width: 100%;
    height: 1px;
    background: var(--xy-controls-button-border-color, #eee);
    margin: 2px 0;
  }

  :global(.ctrl-btn-active) {
    background: #475569 !important;
    color: #fff !important;
  }

  .ctrl-spin {
    display: inline-block;
    animation: spin 0.8s linear infinite;
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
