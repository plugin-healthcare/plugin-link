<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';
  import type { ErdNodeData, ErdSlot } from '$lib/types';

  // Accept the base unparameterised NodeProps — re-derive our data shape below.
  // (Svelte Flow v1 generics clash with TypeScript strict mode; see layout.ts.)
  let { data }: NodeProps<Node<Record<string, unknown>>> = $props();

  // Re-derive data reactively so Svelte can track changes when the parent
  // rebuilds the node. The cast is intentional — see layout.ts for rationale.
  const rawData = $derived(data as unknown as ErdNodeData);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let collapsed = $state(false);

  // Sync collapsed when the parent rebuilds the node
  $effect(() => {
    collapsed = rawData.collapsed;
  });

  // ---------------------------------------------------------------------------
  // Slot display helpers
  // ---------------------------------------------------------------------------
  const MAX_ROWS = 20;

  const visibleSlots = $derived(
    collapsed ? [] : rawData.slots.slice(0, MAX_ROWS)
  );
  const hiddenCount = $derived(
    collapsed ? 0 : Math.max(0, rawData.slots.length - MAX_ROWS)
  );

  function slotIcon(slot: ErdSlot): string {
    if (slot.identifier) return 'PK';
    if (slot.is_fk) return 'FK';
    return '';
  }

  function slotTypeLabel(slot: ErdSlot): string {
    return slot.range;
  }

  // Single neutral header color — no domain coloring
  const HEADER_COLOR = '#475569'; // slate-600
  const HEADER_TEXT = '#ffffff';
</script>

<!-- Handles on left (target) and right (source) -->
<Handle type="target" position={Position.Left} />
<Handle type="source" position={Position.Right} />

<div class="table-node" class:collapsed class:highlighted={rawData.highlighted}>
  <!-- Header -->
  <button
    class="header"
    style:background={HEADER_COLOR}
    style:color={HEADER_TEXT}
    onclick={() => (collapsed = !collapsed)}
    title={rawData.description || rawData.label}
    aria-expanded={!collapsed}
  >
    <span class="table-name">{rawData.label}</span>
    <span class="collapse-icon">{collapsed ? '▶' : '▼'}</span>
  </button>

  <!-- Slot rows -->
  {#if !collapsed}
    <div class="slots">
      {#each visibleSlots as slot (slot.slot_name)}
        <div
          class="slot-row"
          class:required={slot.required}
          class:fk={slot.is_fk}
          class:pk={slot.identifier}
          title={slot.description || slot.name}
        >
          <span class="slot-badge" class:badge-pk={slot.identifier} class:badge-fk={slot.is_fk && !slot.identifier}>
            {slotIcon(slot)}
          </span>
          <span class="slot-name">{slot.name}</span>
          <span class="slot-type">{slotTypeLabel(slot)}</span>
        </div>
      {/each}
      {#if hiddenCount > 0}
        <div class="more-rows">+{hiddenCount} more…</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .table-node {
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 12px;
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 6px;
    overflow: hidden;
    width: 260px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .table-node.collapsed {
    border-color: #94a3b8;
  }

  .table-node.highlighted {
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
    border: none;
    text-align: left;
    gap: 6px;
  }

  .table-name {
    font-weight: 700;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .collapse-icon {
    font-size: 9px;
    opacity: 0.75;
    flex-shrink: 0;
  }

  /* Slot rows */
  .slots {
    border-top: 1px solid #e2e8f0;
  }

  .slot-row {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-bottom: 1px solid #f1f5f9;
    min-height: 24px;
  }

  .slot-row:last-child {
    border-bottom: none;
  }

  .slot-row.required .slot-name {
    font-weight: 600;
  }

  .slot-badge {
    font-size: 9px;
    font-weight: 700;
    width: 22px;
    flex-shrink: 0;
    color: #94a3b8;
    letter-spacing: 0;
  }

  .badge-pk {
    color: #b45309; /* amber-700 */
  }

  .badge-fk {
    color: #475569; /* slate-600 */
  }

  .slot-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #1e293b;
    font-size: 11px;
  }

  .slot-type {
    font-size: 10px;
    color: #94a3b8;
    white-space: nowrap;
    flex-shrink: 0;
    font-style: italic;
  }

  .more-rows {
    padding: 3px 8px;
    font-size: 10px;
    color: #94a3b8;
    font-style: italic;
  }
</style>
