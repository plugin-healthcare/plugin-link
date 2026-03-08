<script lang="ts">
  import '@xyflow/svelte/dist/style.css';
  import { base } from '$app/paths';

  let { children } = $props();
</script>

<svelte:head>
  <title>LinkML ERD Viewer</title>
  <link rel="icon" type="image/png" href="{base}/logo.png" />
</svelte:head>

{@render children()}

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
