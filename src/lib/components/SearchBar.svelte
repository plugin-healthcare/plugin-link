<script lang="ts">
  import type { NormalizedSchema } from '$lib/types';

  interface SearchResult {
    classId: string;
    label: string;
    sublabel?: string;
  }

  interface Props {
    schema: NormalizedSchema | null;
    onselect: (classId: string) => void;
  }

  let { schema, onselect }: Props = $props();

  let query = $state('');
  let activeIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();
  let open = $derived(query.trim().length > 0);

  const MAX_RESULTS = 10;

  const results = $derived.by<SearchResult[]>(() => {
    if (!schema || query.trim() === '') return [];
    const q = query.trim().toLowerCase();
    const found: SearchResult[] = [];

    for (const [classId, cls] of Object.entries(schema.classes)) {
      if (found.length >= MAX_RESULTS) break;

      // Class name match
      if (cls.name.toLowerCase().includes(q)) {
        found.push({ classId, label: cls.name });
        continue;
      }

      // Slot name match — report first matching slot
      const matchingSlot = cls.slots.find((s) => s.name.toLowerCase().includes(q));
      if (matchingSlot) {
        found.push({ classId, label: cls.name, sublabel: matchingSlot.name });
      }
    }

    return found;
  });

  $effect(() => {
    // Reset active index when results change
    activeIndex = -1;
  });

  function select(classId: string) {
    onselect(classId);
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
        select(results[activeIndex].classId);
      } else if (results.length > 0) {
        select(results[0].classId);
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
      placeholder="Search classes or slots…"
      autocomplete="off"
      spellcheck="false"
      disabled={!schema}
      aria-label="Search classes and slots"
      aria-autocomplete="list"
    />
  </div>

  {#if open && results.length > 0}
    <ul class="results" role="listbox">
      {#each results as result, i}
        <li
          role="option"
          aria-selected={i === activeIndex}
          class:active={i === activeIndex}
          onmousedown={() => select(result.classId)}
        >
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
    padding: 0 10px;
    gap: 6px;
    height: 34px;
    transition: border-color 0.15s;
  }

  .search-input-row:focus-within {
    border-color: #475569;
    background: #fff;
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
