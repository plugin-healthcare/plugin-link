<script lang="ts">
  import { parseLinkMLSchema } from '$lib/linkml';
  import type { NormalizedSchema } from '$lib/types';

  interface Props {
    onschema: (schema: NormalizedSchema) => void;
    onreset: () => void;
    onyaml?: (text: string) => void;
  }

  let { onschema, onreset, onyaml }: Props = $props();

  let dragging = $state(false);
  let error = $state('');
  let loading = $state(false);
  let open = $state(false);
  let fileInput: HTMLInputElement;

  async function handleFile(file: File) {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['yaml', 'yml', 'json'].includes(ext ?? '')) {
      error = 'Only .yaml, .yml, or .json files are supported';
      return;
    }
    error = '';
    loading = true;
    try {
      const text = await file.text();
      const schema = parseLinkMLSchema(text);
      const classCount = Object.keys(schema.classes).length;
      if (classCount === 0) {
        error = 'No classes found in schema. Is this a valid LinkML schema?';
        return;
      }
      onyaml?.(text);
      onschema(schema);
      open = false;
    } catch (e) {
      error = `Failed to parse schema: ${(e as Error).message}`;
    } finally {
      loading = false;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleFile(file);
  }
</script>

<!-- Upload trigger button (top bar) -->
<button class="trigger-btn" onclick={() => (open = !open)}>
  {open ? '✕ Close' : '⬆ Load schema'}
</button>

{#if open}
  <!-- Drop zone panel -->
  <div class="upload-panel">
    <div
      class="drop-zone"
      class:dragging
      ondragover={(e) => { e.preventDefault(); dragging = true; }}
      ondragleave={() => (dragging = false)}
      ondrop={onDrop}
      role="region"
      aria-label="Schema file drop zone"
    >
      {#if loading}
        <div class="drop-content">
          <span class="spin">⟳</span>
          <span>Parsing schema…</span>
        </div>
      {:else}
        <div class="drop-content">
          <span class="drop-icon">📂</span>
          <span class="drop-label">Drop a LinkML schema here</span>
          <span class="drop-sub">.yaml or .yml (preferred), .json</span>
          <button class="browse-btn" onclick={() => fileInput.click()}>
            Browse files
          </button>
        </div>
      {/if}
    </div>

    {#if error}
      <p class="error-msg">⚠ {error}</p>
    {/if}

    <div class="panel-actions">
      <button class="reset-btn" onclick={() => { onreset(); open = false; error = ''; }}>
        ↺ Load OMOP CDM example
      </button>
    </div>
  </div>
{/if}

<!-- Hidden file input -->
<input
  bind:this={fileInput}
  type="file"
  accept=".yaml,.yml,.json"
  style="display:none"
  onchange={onFileChange}
/>

<style>
  .trigger-btn {
    padding: 5px 12px;
    background: #fff;
    border: 1.5px solid #d1d5db;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    color: #374151;
    white-space: nowrap;
    transition: all 0.12s ease;
  }

  .trigger-btn:hover {
    border-color: #6b7280;
    background: #f9fafb;
  }

  .upload-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 280px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    padding: 12px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .drop-zone {
    border: 2px dashed #d1d5db;
    border-radius: 6px;
    padding: 20px 16px;
    transition: all 0.15s ease;
    cursor: default;
  }

  .drop-zone.dragging {
    border-color: #475569;
    background: #f1f5f9;
  }

  .drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  }

  .drop-icon {
    font-size: 28px;
  }

  .drop-label {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  .drop-sub {
    font-size: 11px;
    color: #9ca3af;
  }

  .browse-btn {
    margin-top: 4px;
    padding: 5px 14px;
    background: #475569;
    color: #fff;
    border: none;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .browse-btn:hover {
    background: #334155;
  }

  .spin {
    font-size: 24px;
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-msg {
    margin: 0;
    font-size: 11px;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
    padding: 6px 8px;
  }

  .panel-actions {
    display: flex;
    justify-content: flex-end;
  }

  .reset-btn {
    font-size: 11px;
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    padding: 4px 10px;
    cursor: pointer;
    color: #6b7280;
  }

  .reset-btn:hover {
    border-color: #9ca3af;
    color: #374151;
  }
</style>
