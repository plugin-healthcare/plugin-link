/**
 * Dagre-based auto-layout for ERD nodes and edges.
 *
 * Given a set of ERD classes and their FK relationships, produces
 * Svelte Flow Node and Edge arrays with computed x/y positions.
 * All classes are rendered — no domain filtering.
 */

import dagre from '@dagrejs/dagre';
import { Position, type Node, type Edge, MarkerType } from '@xyflow/svelte';
import type { NormalizedSchema, ErdNodeData } from './types';

// Estimated node dimensions — used for dagre sizing
const NODE_WIDTH = 260;
const NODE_HEADER_HEIGHT = 36;
const NODE_ROW_HEIGHT = 24;
const NODE_COLLAPSED_HEIGHT = NODE_HEADER_HEIGHT;
const MAX_VISIBLE_ROWS = 20;

// Single neutral color for all nodes and edges
const NODE_COLOR = '#475569'; // slate-600

function estimateNodeHeight(slotCount: number, collapsed: boolean): number {
  if (collapsed) return NODE_COLLAPSED_HEIGHT;
  const visibleRows = Math.min(slotCount, MAX_VISIBLE_ROWS);
  return NODE_HEADER_HEIGHT + visibleRows * NODE_ROW_HEIGHT + 8; // 8px padding
}

/**
 * Build Svelte Flow nodes and edges from a normalized schema.
 * All non-abstract classes in the schema are rendered.
 * FK edges are drawn for any slot whose range matches another class name.
 * FK targets that don't exist in the schema are silently skipped.
 */
export function buildGraph(
  schema: NormalizedSchema,
  collapsed: Set<string>
): { nodes: Node[]; edges: Edge[] } {
  const allClasses = schema.classes;
  const classNames = new Set(Object.keys(allClasses));

  // Collect all FK edges between classes present in the schema
  const allEdges: Array<{ source: string; target: string; slotName: string; required: boolean }> =
    [];
  for (const [className, cls] of Object.entries(allClasses)) {
    for (const slot of cls.slots) {
      if (slot.is_fk && classNames.has(slot.range) && slot.range !== className) {
        allEdges.push({
          source: className,
          target: slot.range,
          slotName: slot.name,
          required: slot.required,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Dagre layout
  // ---------------------------------------------------------------------------
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: 40,
    ranksep: 80,
    edgesep: 20,
    marginx: 20,
    marginy: 20,
  });

  for (const [className, cls] of Object.entries(allClasses)) {
    const isCollapsed = collapsed.has(className);
    const height = estimateNodeHeight(cls.slots.length, isCollapsed);
    g.setNode(className, { width: NODE_WIDTH, height });
  }

  for (const edge of allEdges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // ---------------------------------------------------------------------------
  // Build Svelte Flow nodes
  // ---------------------------------------------------------------------------
  const nodes: Node[] = [];

  for (const [className, cls] of Object.entries(allClasses)) {
    const dagreNode = g.node(className);
    if (!dagreNode) continue; // safety: dagre may not have a position if disconnected
    const isCollapsed = collapsed.has(className);

    nodes.push({
      id: className,
      type: 'table',
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - dagreNode.height / 2,
      },
      data: {
        label: className,
        description: cls.description,
        slots: cls.slots,
        collapsed: isCollapsed,
      } as unknown as Record<string, unknown>,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  }

  // ---------------------------------------------------------------------------
  // Build Svelte Flow edges
  // ---------------------------------------------------------------------------
  const edges: Edge[] = [];
  const edgeIdCounts = new Map<string, number>();

  for (const edge of allEdges) {
    const baseId = `${edge.source}--${edge.slotName}--${edge.target}`;
    const count = (edgeIdCounts.get(baseId) ?? 0) + 1;
    edgeIdCounts.set(baseId, count);
    const edgeId = count > 1 ? `${baseId}-${count}` : baseId;

    edges.push({
      id: edgeId,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: false,
      style: `stroke: ${NODE_COLOR}; stroke-width: ${edge.required ? 2 : 1.5};`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: NODE_COLOR,
        width: 16,
        height: 16,
      },
      data: {
        slotName: edge.slotName,
        required: edge.required,
        targetClass: edge.target,
      } as unknown as Record<string, unknown>,
      label: edge.slotName,
      labelStyle: 'font-size: 10px; fill: #6b7280;',
      labelBgStyle: 'fill: rgba(255,255,255,0.85);',
    });
  }

  return { nodes, edges };
}
