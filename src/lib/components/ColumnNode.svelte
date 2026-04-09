<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';
  import type { ErdColumnNodeData } from '$lib/types';

  // Accept the base unparameterised NodeProps — re-derive our data shape below.
  let { data }: NodeProps<Node<Record<string, unknown>>> = $props();

  const rawData = $derived(data as unknown as ErdColumnNodeData);

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  function slotIcon(): string {
    if (rawData.identifier) return 'PK';
    if (rawData.is_fk) return 'FK';
    return '';
  }

  /** Return the first exact_mapping value, shortened for display.
   *  e.g. "omop_cdm54:Person.person_source_value" → "Person.person_source_value"
   */
  function primaryMapping(): string {
    const m = rawData.exact_mappings?.[0];
    if (!m) return '';
    const colon = m.lastIndexOf(':');
    return colon >= 0 ? m.slice(colon + 1) : m;
  }
</script>

<!-- Source handle on the right — FK/ETL edges originate from this column -->
<Handle type="source" position={Position.Right} />
<!-- Target handle on the left — FK/ETL edges terminate at this column (typically PK) -->
<Handle type="target" position={Position.Left} />

<div
  class="col-row"
  class:required={rawData.required}
  class:pk={rawData.identifier}
  class:fk={rawData.is_fk && !rawData.identifier}
  title={rawData.description || rawData.slotName}
>
  <span
    class="slot-badge"
    class:badge-pk={rawData.identifier}
    class:badge-fk={rawData.is_fk && !rawData.identifier}
  >
    {slotIcon()}
  </span>
  <span class="slot-name">{rawData.slotName}</span>
  <span class="slot-type">{rawData.range}</span>
  {#if primaryMapping()}
    <span
      class="slot-mapping"
      title={rawData.exact_mappings.join('\n')}
    >{primaryMapping()}</span>
  {/if}
</div>

<style>
  .col-row {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px;
    height: 24px;
    width: 100%;
    background: #ffffff;
    border-bottom: 1px solid #f1f5f9;
    box-sizing: border-box;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 12px;
    /* Prevent Svelte Flow's default node selection ring from obscuring the row */
    pointer-events: all;
  }

  /* Subtle alternating background is handled by even/odd child via border-bottom */

  .col-row.required .slot-name {
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

  .slot-mapping {
    font-size: 9px;
    color: #6366f1; /* indigo-500 */
    white-space: nowrap;
    flex-shrink: 0;
    font-style: italic;
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
  }
</style>
