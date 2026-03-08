<script lang="ts">
  import '@xyflow/svelte/dist/style.css';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
</script>

<svelte:head>
  <title>LinkML ERD Viewer</title>
  <link rel="icon" href={favicon} />
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
