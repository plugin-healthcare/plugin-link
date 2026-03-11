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
  import GroupLegend from '$lib/components/GroupLegend.svelte';
  import CustomControls from '$lib/components/CustomControls.svelte';
  import SchemaEditor from '$lib/components/SchemaEditor.svelte';
  import GroupEditor from '$lib/components/GroupEditor.svelte';
  import FileList from '$lib/components/FileList.svelte';

  import { loadGroupConfig, parseWorkspaceFile } from '$lib/linkml';
  import { buildGraph } from '$lib/layout';
  import type {
    NormalizedSchema,
    LayoutOptions,
    GroupInfo,
    WorkspaceFile,
    ErdClass,
  } from '$lib/types';
  import { base } from '$app/paths';

  // ---------------------------------------------------------------------------
  // Group config — set context synchronously with a reactive holder so
  // TableNode can read it reactively once the fetch resolves.
  // setContext must be called at init time (not inside onMount/async).
  // ---------------------------------------------------------------------------
  const groupCtx = $state<{ map: Map<string, GroupInfo> | null }>({ map: null });
  setContext('groupConfig', groupCtx);

  // ---------------------------------------------------------------------------
  // Node types registration
  // ---------------------------------------------------------------------------
  const nodeTypes = { table: TableNode };

  // ---------------------------------------------------------------------------
  // Workspace state — list of loaded files + which is active
  // ---------------------------------------------------------------------------
  let workspaceFiles = $state<WorkspaceFile[]>([]);
  let activeFileId = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // Import resolution
  // ---------------------------------------------------------------------------

  /**
   * Recursively resolve imports for a given file against the workspace.
   * Returns the merged NormalizedSchema and a list of unresolvable import names.
   */
  function resolveImports(
    file: WorkspaceFile,
    allFiles: WorkspaceFile[],
    visited = new Set<string>(),
    depth = 0
  ): { merged: NormalizedSchema; unresolved: string[] } {
    const MAX_DEPTH = 6;
    const stemMap = new Map(allFiles.map((f) => [f.stem.toLowerCase(), f]));
    const mergedClasses: Record<string, ErdClass> = {};
    const unresolved: string[] = [];

    // Process imports first (so the active file's classes can override)
    if (depth < MAX_DEPTH) {
      for (const imp of file.imports) {
        const key = imp.toLowerCase();
        if (visited.has(key)) continue;
        visited.add(key);

        const imported = stemMap.get(key);
        if (!imported) {
          unresolved.push(imp);
          continue;
        }
        const sub = resolveImports(imported, allFiles, visited, depth + 1);
        Object.assign(mergedClasses, sub.merged.classes);
        unresolved.push(...sub.unresolved);
      }
    }

    // Active file's own classes override imports
    Object.assign(mergedClasses, file.schema.classes);

    return {
      merged: {
        name: file.schema.name,
        description: file.schema.description,
        id: file.schema.id,
        classes: mergedClasses,
      },
      unresolved: [...new Set(unresolved)],
    };
  }

  // Derived: the schema rendered on the canvas (active file + resolved imports)
  const resolvedResult = $derived((() => {
    if (!activeFileId || workspaceFiles.length === 0) return null;
    const active = workspaceFiles.find((f) => f.id === activeFileId);
    if (!active) return null;
    return resolveImports(active, workspaceFiles);
  })());

  const schema = $derived(resolvedResult?.merged ?? null);
  const unresolvedImports = $derived(resolvedResult?.unresolved ?? []);

  // ---------------------------------------------------------------------------
  // Other derived values
  // ---------------------------------------------------------------------------
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
  let groupEditorOpen = $state(false);

  // Raw YAML text for SchemaEditor — tracks the active file's text
  const schemaYamlText = $derived(
    workspaceFiles.find((f) => f.id === activeFileId)?.text ?? ''
  );

  // Group list derived from groupCtx.map for GroupEditor
  const groupList = $derived<GroupInfo[]>(
    groupCtx.map ? Array.from(groupCtx.map.values()) : []
  );

  // ---------------------------------------------------------------------------
  // Rebuild graph whenever schema, collapsed, or layoutOptions change (async)
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!schema) {
      nodes = [];
      edges = [];
      return;
    }

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

  /** Replace workspace with a single default file (OMOP CDM). */
  async function loadDefault() {
    loadError = '';
    try {
      const text = await fetch(`${base}/omop_cdm.yaml`).then((r) => r.text());
      const wf = parseWorkspaceFile('omop_cdm.yaml', text);
      workspaceFiles = [wf];
      activeFileId = wf.id;
      collapsed = new Set();
    } catch (e) {
      loadError = `Failed to load default schema: ${(e as Error).message}`;
    }
  }

  /**
   * Add newly uploaded files to the workspace.
   * Deduplicates by stem (case-insensitive); existing files with the same stem
   * are replaced so that re-uploading a revised file works naturally.
   */
  function handleUploadedFiles(incoming: WorkspaceFile[]) {
    const map = new Map(workspaceFiles.map((f) => [f.stem.toLowerCase(), f]));
    for (const f of incoming) {
      map.set(f.stem.toLowerCase(), f);
    }
    workspaceFiles = Array.from(map.values());
    // Activate the first incoming file (or keep current if it's still present)
    const currentStillPresent = workspaceFiles.some((f) => f.id === activeFileId);
    if (!currentStillPresent || !activeFileId) {
      activeFileId = incoming[0]?.id ?? workspaceFiles[0]?.id ?? null;
    }
    collapsed = new Set();
  }

  /** Switch the active (rendered) file. */
  function handleFileClick(id: string) {
    if (id === activeFileId) return;
    activeFileId = id;
    collapsed = new Set();
  }

  /** Remove a file from the workspace. */
  function handleFileRemove(id: string) {
    workspaceFiles = workspaceFiles.filter((f) => f.id !== id);
    if (activeFileId === id) {
      activeFileId = workspaceFiles[0]?.id ?? null;
      collapsed = new Set();
    }
  }

  // Called by SchemaEditor when the user edits the YAML and it parses cleanly.
  // Updates the active WorkspaceFile in-place.
  function handleSchemaEditorChange(text: string, parsed: NormalizedSchema) {
    if (!activeFileId) return;
    workspaceFiles = workspaceFiles.map((f) =>
      f.id === activeFileId
        ? { ...f, text, schema: parsed }
        : f
    );
    collapsed = new Set();
  }

  // Called by GroupEditor when colors/names change
  function handleGroupEditorChange(groups: GroupInfo[]) {
    groupCtx.map = new Map(groups.map((d) => [d.name, d]));
  }

  onMount(() => {
    loadDefault();
    loadGroupConfig()
      .then((map: Map<string, GroupInfo>) => { groupCtx.map = map; })
      .catch((e: unknown) => console.warn('group-config load failed:', e));
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

  // Collect unique group names present in current nodes (for GroupLegend).
  const activeGroupNames = $derived(
    [...new Set(
      nodes
        .map((n) => (n.data as unknown as { group?: string }).group)
        .filter((d): d is string => typeof d === 'string')
    )]
  );

  // Only show the legend when at least one node has a group annotation.
  const hasGroups = $derived(activeGroupNames.length > 0);

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
  <!-- Left sidebar: file list + optional domain legend -->
  <div class="sidebar-col">
    {#if workspaceFiles.length > 0}
      <FileList
        files={workspaceFiles}
        {activeFileId}
        onfileclick={handleFileClick}
        onfileremove={handleFileRemove}
      />
    {/if}

    {#if schema && hasGroups}
      <GroupLegend {activeGroupNames} />
    {/if}
  </div>

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
        {#if unresolvedImports.length > 0}
          <span class="load-error" title="Add the missing files to resolve: {unresolvedImports.join(', ')}">
            ⚠ unresolved: {unresolvedImports.join(', ')}
          </span>
        {:else if loadError}
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

        <!-- Group config editor toggle -->
        <button
          class="editor-btn"
          class:active={groupEditorOpen}
          title="Edit group colors"
          onclick={() => { groupEditorOpen = !groupEditorOpen; }}
          aria-pressed={groupEditorOpen}
        >
          <span class="editor-btn-icon">&#9678;</span>
          Groups
        </button>

        <div class="uploader-wrap">
          <SchemaUploader
            onfiles={handleUploadedFiles}
            onreset={loadDefault}
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
                const group = (n.data as unknown as { group?: string }).group;
                const map = groupCtx.map;
                if (!group || !map) return '#475569';
                return map.get(group)?.color ?? map.get('default')?.color ?? '#475569';
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

      <!-- Group color editor panel -->
      {#if groupEditorOpen}
        <GroupEditor
          groups={groupList}
          onchange={handleGroupEditorChange}
          onclose={() => { groupEditorOpen = false; }}
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

  /* Left sidebar column: stacks FileList above DomainLegend */
  .sidebar-col {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 180px;
    background: #fff;
    border-right: 1px solid #e5e7eb;
    overflow-y: auto;
    z-index: 10;
  }

  /* Hide the sidebar column entirely when it has no children to show */
  .sidebar-col:empty {
    display: none;
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
    cursor: default;
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
