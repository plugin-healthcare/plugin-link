/**
 * Auto-layout for ERD nodes and edges.
 *
 * Supports two engines (dagre, elkjs) and two directions (LR, TB).
 * Always returns a Promise so callers have a uniform async interface.
 */

import dagre from '@dagrejs/dagre';
import { Position, type Node, type Edge, MarkerType } from '@xyflow/svelte';
import type { NormalizedSchema, ErdNodeData, LayoutOptions } from './types';

// Estimated node dimensions
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
  return NODE_HEADER_HEIGHT + visibleRows * NODE_ROW_HEIGHT + 8;
}

// ---------------------------------------------------------------------------
// Shared edge-collection helper
// ---------------------------------------------------------------------------
function collectEdges(
  schema: NormalizedSchema
): Array<{ source: string; target: string; slotName: string; required: boolean }> {
  const classNames = new Set(Object.keys(schema.classes));
  const result: Array<{ source: string; target: string; slotName: string; required: boolean }> = [];
  for (const [className, cls] of Object.entries(schema.classes)) {
    for (const slot of cls.slots) {
      if (slot.is_fk && classNames.has(slot.range) && slot.range !== className) {
        result.push({ source: className, target: slot.range, slotName: slot.name, required: slot.required });
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Shared Svelte Flow edge builder
// ---------------------------------------------------------------------------
function buildSvelteEdges(
  allEdges: Array<{ source: string; target: string; slotName: string; required: boolean }>
): Edge[] {
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
    });
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Dagre layout
// ---------------------------------------------------------------------------
function buildGraphDagre(
  schema: NormalizedSchema,
  collapsed: Set<string>,
  direction: 'LR' | 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const allEdges = collectEdges(schema);

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 80,
    edgesep: 20,
    marginx: 20,
    marginy: 20,
  });

  for (const [className, cls] of Object.entries(schema.classes)) {
    const height = estimateNodeHeight(cls.slots.length, collapsed.has(className));
    g.setNode(className, { width: NODE_WIDTH, height });
  }
  for (const edge of allEdges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  const isLR = direction === 'LR';
  const nodes: Node[] = [];
  for (const [className, cls] of Object.entries(schema.classes)) {
    const dagreNode = g.node(className);
    if (!dagreNode) continue;
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
        collapsed: collapsed.has(className),
        domain: cls.domain,
      } as unknown as Record<string, unknown>,
      sourcePosition: isLR ? Position.Right : Position.Bottom,
      targetPosition: isLR ? Position.Left : Position.Top,
    });
  }

  return { nodes, edges: buildSvelteEdges(allEdges) };
}

// ---------------------------------------------------------------------------
// ELK layout (async, code-split)
// ---------------------------------------------------------------------------
async function buildGraphElk(
  schema: NormalizedSchema,
  collapsed: Set<string>,
  direction: 'LR' | 'TB'
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const ELK = (await import('elkjs')).default;
  const elk = new ELK();

  const allEdges = collectEdges(schema);
  const isLR = direction === 'LR';

  const elkNodes = Object.entries(schema.classes).map(([className, cls]) => ({
    id: className,
    width: NODE_WIDTH,
    height: estimateNodeHeight(cls.slots.length, collapsed.has(className)),
  }));

  const elkEdges = allEdges.map((e, i) => ({
    id: `e${i}`,
    sources: [e.source],
    targets: [e.target],
  }));

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': isLR ? 'RIGHT' : 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '40',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const laid = await elk.layout(graph);

  const posMap = new Map<string, { x: number; y: number }>();
  for (const n of laid.children ?? []) {
    posMap.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  }

  const nodes: Node[] = [];
  for (const [className, cls] of Object.entries(schema.classes)) {
    const pos = posMap.get(className);
    if (!pos) continue;
    nodes.push({
      id: className,
      type: 'table',
      position: pos,
      data: {
        label: className,
        description: cls.description,
        slots: cls.slots,
        collapsed: collapsed.has(className),
        domain: cls.domain,
      } as unknown as Record<string, unknown>,
      sourcePosition: isLR ? Position.Right : Position.Bottom,
      targetPosition: isLR ? Position.Left : Position.Top,
    });
  }

  return { nodes, edges: buildSvelteEdges(allEdges) };
}

// ---------------------------------------------------------------------------
// Public API — always async
// ---------------------------------------------------------------------------
export async function buildGraph(
  schema: NormalizedSchema,
  collapsed: Set<string>,
  options: LayoutOptions = { engine: 'dagre', direction: 'LR' }
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (options.engine === 'elk') {
    return buildGraphElk(schema, collapsed, options.direction);
  }
  return Promise.resolve(buildGraphDagre(schema, collapsed, options.direction));
}
