<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import type { ErdNodeData } from '$lib/types';
  import type { Node } from '@xyflow/svelte';

  interface Props {
    panTarget: string | null;         // classId to pan to, or null
    nodes: Node[];
    onpanned: () => void;             // called after pan so parent can clear panTarget
    onhighlight: (update: Node[]) => void;  // returns updated nodes array
  }

  let { panTarget, nodes, onpanned, onhighlight }: Props = $props();

  const { setCenter, getNode } = useSvelteFlow();

  $effect(() => {
    if (!panTarget) return;

    const node = getNode(panTarget);
    if (!node) { onpanned(); return; }

    const x = (node.position.x ?? 0) + ((node.measured?.width ?? 260) / 2);
    const y = (node.position.y ?? 0) + ((node.measured?.height ?? 36) / 2);

    setCenter(x, y, { zoom: 1.2, duration: 500 });

    // Highlight on
    onhighlight(
      nodes.map((n) =>
        n.id === panTarget
          ? { ...n, data: { ...(n.data as unknown as ErdNodeData), highlighted: true } as unknown as Record<string, unknown> }
          : n
      )
    );

    // Highlight off after 1.5 s
    const id = panTarget;
    setTimeout(() => {
      onhighlight(
        nodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...(n.data as unknown as ErdNodeData), highlighted: false } as unknown as Record<string, unknown> }
            : n
        )
      );
    }, 1500);

    onpanned();
  });
</script>
