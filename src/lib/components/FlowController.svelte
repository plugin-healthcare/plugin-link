<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import type { ErdTableNodeData } from '$lib/types';
  import type { Node } from '@xyflow/svelte';

  interface Props {
    panTarget: string | null;         // nodeId to pan to (table or column), or null
    nodes: Node[];
    onpanned: () => void;             // called after pan so parent can clear panTarget
    onhighlight: (update: Node[]) => void;  // returns updated nodes array
    fitViewTrigger: number;           // increment to trigger fitView
  }

  let { panTarget, nodes, onpanned, onhighlight, fitViewTrigger }: Props = $props();

  const { setCenter, getNode, fitView } = useSvelteFlow();

  // Pan + highlight on search select
  $effect(() => {
    if (!panTarget) return;

    const node = getNode(panTarget);
    if (!node) { onpanned(); return; }

    // For child (column) nodes, position is relative to the parent.
    // Svelte Flow stores the absolute position in node.internals.positionAbsolute
    // but the public API only gives us node.position (relative).
    // We resolve the absolute position by walking up to the parent if needed.
    let absX = node.position.x ?? 0;
    let absY = node.position.y ?? 0;

    if (node.parentId) {
      const parent = getNode(node.parentId);
      if (parent) {
        absX += parent.position.x ?? 0;
        absY += parent.position.y ?? 0;
      }
    }

    const w = node.measured?.width ?? 260;
    const h = node.measured?.height ?? 24;

    setCenter(absX + w / 2, absY + h / 2, { zoom: 1.2, duration: 500 });

    // Highlight the tableParent node (even when a column was searched).
    // For column nodes, highlight their parent table for visual clarity.
    const highlightId = node.parentId ?? panTarget;

    onhighlight(
      nodes.map((n) =>
        n.id === highlightId
          ? { ...n, data: { ...(n.data as unknown as ErdTableNodeData), highlighted: true } as unknown as Record<string, unknown> }
          : n
      )
    );

    // Highlight off after 1.5 s
    const id = highlightId;
    setTimeout(() => {
      onhighlight(
        nodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...(n.data as unknown as ErdTableNodeData), highlighted: false } as unknown as Record<string, unknown> }
            : n
        )
      );
    }, 1500);

    onpanned();
  });

  // Fit view after layout engine change
  $effect(() => {
    if (fitViewTrigger === 0) return;
    // Small delay to let Svelte Flow settle the new node positions
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  });
</script>
