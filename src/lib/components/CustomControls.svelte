<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { useStore } from '@xyflow/svelte';
  import type { LayoutOptions } from '$lib/types';

  interface Props {
    layoutOptions: LayoutOptions;
    layoutLoading: boolean;
    onlayoutselect: (opts: LayoutOptions) => void;
  }

  let { layoutOptions, layoutLoading, onlayoutselect }: Props = $props();

  const { zoomIn, zoomOut, fitView } = useSvelteFlow();
  const store = $derived(useStore());

  const isInteractive = $derived(
    store.nodesDraggable || store.nodesConnectable || store.elementsSelectable
  );
  const minZoomReached = $derived(store.viewport.zoom <= store.minZoom);
  const maxZoomReached = $derived(store.viewport.zoom >= store.maxZoom);

  function toggleInteractivity() {
    const next = !isInteractive;
    store.nodesDraggable = next;
    store.nodesConnectable = next;
    store.elementsSelectable = next;
  }

  const LAYOUT_BUTTONS: Array<{
    engine: LayoutOptions['engine'];
    direction: LayoutOptions['direction'];
    label: string;
    title: string;
  }> = [
    { engine: 'dagre', direction: 'LR', label: 'D→', title: 'Dagre — left to right' },
    { engine: 'dagre', direction: 'TB', label: 'D↓', title: 'Dagre — top to bottom' },
    { engine: 'elk',   direction: 'LR', label: 'E→', title: 'ELK — left to right' },
    { engine: 'elk',   direction: 'TB', label: 'E↓', title: 'ELK — top to bottom' },
  ];

  function isLayoutActive(btn: typeof LAYOUT_BUTTONS[number]) {
    return layoutOptions.engine === btn.engine && layoutOptions.direction === btn.direction;
  }
</script>

<div class="controls-panel" role="toolbar" aria-label="Canvas controls">
  <!-- Row 1: zoom in | zoom out -->
  <button
    class="ctrl-btn"
    title="Zoom in"
    aria-label="Zoom in"
    disabled={maxZoomReached}
    onclick={() => zoomIn()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="icon">
      <path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" />
    </svg>
  </button>
  <button
    class="ctrl-btn"
    title="Zoom out"
    aria-label="Zoom out"
    disabled={minZoomReached}
    onclick={() => zoomOut()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 5" class="icon">
      <path d="M0 0h32v4.2H0z" />
    </svg>
  </button>

  <!-- Row 2: fit view | lock -->
  <button
    class="ctrl-btn"
    title="Fit view"
    aria-label="Fit view"
    onclick={() => fitView({ padding: 0.15, duration: 400 })}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30" class="icon">
      <path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" />
    </svg>
  </button>
  <button
    class="ctrl-btn"
    title={isInteractive ? 'Lock interactions' : 'Unlock interactions'}
    aria-label={isInteractive ? 'Lock interactions' : 'Unlock interactions'}
    onclick={toggleInteractivity}
  >
    {#if isInteractive}
      <!-- Unlock icon -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32" class="icon">
        <path d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z" />
      </svg>
    {:else}
      <!-- Lock icon -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32" class="icon">
        <path d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z" />
      </svg>
    {/if}
  </button>

  <!-- Rows 3–4: layout buttons -->
  {#each LAYOUT_BUTTONS as btn}
    <button
      class="ctrl-btn ctrl-btn-layout"
      class:active={isLayoutActive(btn)}
      title={btn.title}
      disabled={layoutLoading}
      onclick={() => onlayoutselect({ engine: btn.engine, direction: btn.direction })}
    >
      {#if layoutLoading && isLayoutActive(btn)}
        <span class="ctrl-spin">⟳</span>
      {:else}
        {btn.label}
      {/if}
    </button>
  {/each}
</div>

<style>
  .controls-panel {
    position: absolute;
    bottom: 24px;
    left: 12px;
    z-index: 5;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--xy-controls-button-border-color, #eee);
    border: 1px solid var(--xy-controls-button-border-color, #eee);
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: var(--xy-controls-button-background-color, #fefefe);
    color: var(--xy-controls-button-color, #222);
    border: none;
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    font-family: ui-monospace, monospace;
    padding: 0;
    transition: background 0.1s;
  }

  .ctrl-btn:hover:not(:disabled) {
    background: var(--xy-controls-button-background-color-hover, #f4f4f4);
  }

  .ctrl-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ctrl-btn.active {
    background: #475569;
    color: #fff;
  }

  .icon {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }

  .ctrl-spin {
    display: inline-block;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
</style>
