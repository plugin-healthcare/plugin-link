<script lang="ts">
  import { getContext } from 'svelte';
  import type { GroupInfo } from '$lib/types';

  // Receive list of group names actually present in the current schema's nodes.
  // Parent derives this from the rendered nodes so we only show relevant groups.
  let { activeGroupNames }: { activeGroupNames: string[] } = $props();

  // Group config injected by +page.svelte (same reactive wrapper as TableNode uses).
  const groupCtx = getContext<{ map: Map<string, GroupInfo> | null }>('groupConfig');

  // Build the ordered list: entries from the map that appear in activeGroupNames,
  // preserving map insertion order. The 'default' entry is omitted from group swatches.
  const groupEntries = $derived((() => {
    const map = groupCtx?.map;
    if (!map) return [] as GroupInfo[];
    const active = new Set(activeGroupNames);
    return Array.from(map.values()).filter(
      (d) => d.name !== 'default' && active.has(d.name)
    );
  })());
</script>

<aside class="sidebar">
  <!-- Group color legend -->
  {#if groupEntries.length > 0}
    <section class="section">
      <div class="section-title">Groups</div>
      {#each groupEntries as d}
        <div class="group-row">
          <span class="swatch" style:background={d.color}></span>
          <span class="group-label">{d.label}</span>
        </div>
      {/each}
    </section>
    <div class="divider"></div>
  {/if}

  <!-- Slot row icon key -->
  <section class="section">
    <div class="section-title">Legend</div>

    <div class="legend-row">
      <span class="badge badge-pk">PK</span>
      <span class="legend-text">Primary key</span>
    </div>
    <div class="legend-row">
      <span class="badge badge-fk">FK</span>
      <span class="legend-text">Foreign key</span>
    </div>
    <div class="legend-row">
      <span class="legend-name required">name</span>
      <span class="legend-text">Required field</span>
    </div>
    <div class="legend-row">
      <span class="legend-name">name</span>
      <span class="legend-text">Optional field</span>
    </div>
    <div class="legend-row">
      <span class="legend-mapping">Table.col</span>
      <span class="legend-text">ETL mapping</span>
    </div>
    <div class="legend-row">
      <span class="edge-etl"></span>
      <span class="legend-text">ETL edge</span>
    </div>
  </section>
</aside>

<style>
  .sidebar {
    width: 170px;
    flex-shrink: 0;
    background: #fff;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    z-index: 10;
  }

  .section {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .section-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9ca3af;
    margin-bottom: 2px;
  }

  .divider {
    height: 1px;
    background: #e5e7eb;
    margin: 0 12px;
  }

  /* Group swatches */
  .group-row {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .group-label {
    font-size: 11px;
    color: #374151;
  }

  /* Legend rows */
  .legend-row {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .legend-text {
    font-size: 10px;
    color: #6b7280;
  }

  /* Slot badges — mirrors TableNode.svelte exactly */
  .badge {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    flex-shrink: 0;
    line-height: 1.4;
  }

  .badge-pk {
    background: #fef3c7;
    color: #92400e;
  }

  .badge-fk {
    background: #e2e8f0;
    color: #475569;
  }

  /* Slot name samples */
  .legend-name {
    font-size: 10px;
    color: #1e293b;
    font-family: ui-monospace, monospace;
  }

  .legend-name.required {
    font-weight: 700;
  }

  /* ETL mapping sample — mirrors .slot-mapping in TableNode */
  .legend-mapping {
    font-size: 9px;
    color: #6366f1;
    font-style: italic;
    font-family: ui-monospace, monospace;
  }
  /* ETL edge swatch — dashed indigo line */
  .edge-etl {
    display: inline-block;
    width: 28px;
    height: 0;
    border-top: 2px dashed #6366f1;
    flex-shrink: 0;
  }
</style>
