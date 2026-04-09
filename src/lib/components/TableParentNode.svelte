<script lang="ts">
  import { getContext } from 'svelte';
  import type { NodeProps, Node } from '@xyflow/svelte';
  import type { ErdTableNodeData, GroupInfo } from '$lib/types';

  // Accept the base unparameterised NodeProps — re-derive our data shape below.
  let { data, id }: NodeProps<Node<Record<string, unknown>>> = $props();

  // Re-derive data reactively so Svelte can track changes when parent rebuilds the node.
  const rawData = $derived(data as unknown as ErdTableNodeData);

  // Group config injected by +page.svelte via setContext.
  const groupCtx = getContext<{ map: Map<string, GroupInfo> | null }>('groupConfig');

  // File config injected by +page.svelte via setContext.
  const fileCtx = getContext<{ map: Map<string, string> }>('fileConfig');

  // Collapse toggle callback — injected via context by +page.svelte
  // so that the parent can update the collapsed Set and trigger a graph rebuild.
  const collapseCtx = getContext<{ toggle: (id: string) => void } | null>('collapseToggle');

  const DEFAULT_COLOR = '#475569';
  const DEFAULT_TEXT = '#ffffff';

  const headerColor = $derived((() => {
    const group = rawData.group;
    const map = groupCtx?.map;
    if (!group || !map) return DEFAULT_COLOR;
    return map.get(group)?.color ?? map.get('default')?.color ?? DEFAULT_COLOR;
  })());

  const headerText = $derived((() => {
    const group = rawData.group;
    const map = groupCtx?.map;
    if (!group || !map) return DEFAULT_TEXT;
    return map.get(group)?.text_color ?? map.get('default')?.text_color ?? DEFAULT_TEXT;
  })());

  // Left stripe color — only shown when multiple files are loaded.
  const stripeColor = $derived((() => {
    const fileId = rawData.fileId;
    const map = fileCtx?.map;
    if (!fileId || !map || map.size <= 1) return null;
    return map.get(fileId) ?? null;
  })());

  // ---------------------------------------------------------------------------
  // Collapse state — derived directly from data prop so it stays in sync
  // without the round-trip latency of a $state/$effect pair.
  // ---------------------------------------------------------------------------
  const collapsed = $derived(rawData.collapsed);

  function toggleCollapse() {
    collapseCtx?.toggle(id);
  }
</script>

<!-- The node itself is the container rendered by Svelte Flow.
     Column child nodes have the Handles — not the parent.
     We only render the colored header with the table name and collapse toggle. -->

<div
  class="table-parent"
  class:collapsed
  class:highlighted={rawData.highlighted}
>
  <button
    class="header"
    style:background={headerColor}
    style:color={headerText}
    style:padding-left={stripeColor ? '16px' : '10px'}
    onclick={toggleCollapse}
    title={rawData.description || rawData.label}
    aria-expanded={!collapsed}
  >
    {#if stripeColor}
      <span class="file-stripe" style:background={stripeColor}></span>
    {/if}
    <span class="table-name">{rawData.label}</span>
    <span class="slot-count" style:color={headerText}>
      {rawData.slotCount} col{rawData.slotCount !== 1 ? 's' : ''}
    </span>
    <span class="collapse-icon">{collapsed ? '▶' : '▼'}</span>
  </button>
</div>

<style>
  .table-parent {
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 12px;
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 6px;
    overflow: visible; /* allow column handle dots to be visible at the edges */
    width: 100%;
    height: 100%;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    box-sizing: border-box;
  }

  .table-parent.collapsed {
    border-color: #94a3b8;
    overflow: hidden;
  }

  .table-parent.highlighted {
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.35), 0 1px 4px rgba(0, 0, 0, 0.08);
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    cursor: pointer;
    width: 100%;
    height: 36px;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    text-align: left;
    gap: 6px;
    position: relative;
    box-sizing: border-box;
  }

  /* File source stripe — 6px left edge, absolutely positioned */
  .file-stripe {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    border-radius: 4px 0 0 4px;
    pointer-events: none;
  }

  .table-name {
    font-weight: 700;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .slot-count {
    font-size: 9px;
    opacity: 0.7;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .collapse-icon {
    font-size: 9px;
    opacity: 0.75;
    flex-shrink: 0;
  }
</style>
