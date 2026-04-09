<script lang="ts">
  import type { NormalizedSchema } from '$lib/types';

  /**
   * Separator used between class name and slot name in column node IDs.
   * Must stay in sync with COL_ID_SEP in src/lib/layout.ts.
   * A null byte cannot appear in LinkML identifiers, so it is unambiguous.
   */
  const COL_ID_SEP = '\x00';

  interface SearchResult {
    /** The Svelte Flow node ID to pan to.
     *  - Table match  → classId (e.g. "Person")
     *  - Column match → "ClassName\x00slotName" (e.g. "Person\x00gender_concept_id")
     */
    nodeId: string;
    /** Display label — always the class name */
    label: string;
    /** Sub-label shown for column matches — the column name */
    sublabel?: string;
    /** Badge shown next to the result */
    kind: 'table' | 'column';
  }

  interface Props {
    schema: NormalizedSchema | null;
    onselect: (nodeId: string) => void;
  }

  let { schema, onselect }: Props = $props();

  let query = $state('');
  let activeIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();
  let open = $derived(query.trim().length > 0);

  const MAX_RESULTS = 12;

  const results = $derived.by<SearchResult[]>(() => {
    if (!schema || query.trim() === '') return [];
    const q = query.trim().toLowerCase();
    const found: SearchResult[] = [];

    for (const [classId, cls] of Object.entries(schema.classes)) {
      if (found.length >= MAX_RESULTS) break;

      // Class name match (table) — highest priority
      if (cls.name.toLowerCase().includes(q)) {
        found.push({ nodeId: classId, label: cls.name, kind: 'table' });
        continue;
      }

      // Column name matches — find all matching slots, up to 3 per table
      const matchingSlots = cls.slots.filter((s) => s.name.toLowerCase().includes(q));
      for (const slot of matchingSlots.slice(0, 3)) {
        if (found.length >= MAX_RESULTS) break;
        found.push({
          nodeId: `${classId}${COL_ID_SEP}${slot.name}`,
          label: cls.name,
          sublabel: slot.name,
          kind: 'column',
        });
      }
    }

    return found;
  });

  $effect(() => {
    // Reset active index when results change
    activeIndex = -1;
  });

  function select(nodeId: string) {
    onselect(nodeId);
    query = '';
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        select(results[activeIndex].nodeId);
      } else if (results.length > 0) {
        select(results[0].nodeId);
      }
    } else if (e.key === 'Escape') {
      query = '';
      inputEl?.blur();
    }
  }

  function onBlur() {
    // Delay so click on result fires before dropdown closes
    setTimeout(() => { query = ''; }, 150);
  }

  // Exposed so the parent can focus the input (e.g. via Cmd-K shortcut)
  export function focus() {
    inputEl?.focus();
    inputEl?.select();
  }
</script>

<div class="search-wrap">
  <div class="search-input-row">
    <span class="search-icon">⌕</span>
    <input
      bind:this={inputEl}
      bind:value={query}
      onkeydown={onKeydown}
      onblur={onBlur}
      type="search"
      placeholder="Search tables or columns…"
      autocomplete="off"
      spellcheck="false"
      disabled={!schema}
      aria-label="Search tables and columns"
      aria-autocomplete="list"
    />
    <kbd class="kbd-hint">⌘K</kbd>
  </div>

  {#if open && results.length > 0}
    <ul class="results" role="listbox">
      {#each results as result, i}
        <li
          role="option"
          aria-selected={i === activeIndex}
          class:active={i === activeIndex}
          onmousedown={() => select(result.nodeId)}
        >
          <span class="kind-badge" class:kind-column={result.kind === 'column'}>
            {result.kind === 'table' ? 'T' : 'C'}
          </span>
          <span class="result-label">{result.label}</span>
          {#if result.sublabel}
            <span class="result-sublabel">› {result.sublabel}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if open && query.trim().length > 0}
    <div class="no-results">No matches</div>
  {/if}
</div>

<style>
  .search-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .search-input-row {
    display: flex;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 0 8px 0 10px;
    gap: 6px;
    height: 34px;
    transition: border-color 0.15s;
  }

  .search-input-row:focus-within {
    border-color: #475569;
    background: #fff;
  }

  .search-input-row:focus-within .kbd-hint {
    display: none;
  }

  .search-icon {
    color: #94a3b8;
    font-size: 16px;
    line-height: 1;
    user-select: none;
  }

  input {
    border: none;
    background: transparent;
    outline: none;
    font-size: 13px;
    color: #1e293b;
    width: 220px;
    min-width: 0;
  }

  input::placeholder {
    color: #94a3b8;
  }

  input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* Remove browser default search cancel button */
  input[type='search']::-webkit-search-cancel-button {
    -webkit-appearance: none;
  }

  .kbd-hint {
    display: inline-flex;
    align-items: center;
    padding: 1px 5px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    color: #94a3b8;
    background: #f1f5f9;
    white-space: nowrap;
    flex-shrink: 0;
    user-select: none;
    pointer-events: none;
  }

  .results {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    list-style: none;
    margin: 0;
    padding: 4px 0;
    z-index: 100;
    max-height: 320px;
    overflow-y: auto;
  }

  .results li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 7px 12px;
    cursor: pointer;
    font-size: 13px;
    color: #1e293b;
    user-select: none;
  }

  .results li:hover,
  .results li.active {
    background: #f1f5f9;
  }

  /* T / C kind badge */
  .kind-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
    background: #e2e8f0;
    color: #475569;
    letter-spacing: 0;
  }

  .kind-badge.kind-column {
    background: #ede9fe;
    color: #6366f1;
  }

  .result-label {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-sublabel {
    color: #64748b;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
  }

  .no-results {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    padding: 10px 12px;
    font-size: 13px;
    color: #94a3b8;
    z-index: 100;
  }
</style>
