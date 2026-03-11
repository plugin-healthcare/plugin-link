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

// Single neutral color for all FK nodes and edges
const NODE_COLOR = '#475569'; // slate-600
// ETL mapping edge color — matches the indigo exact_mappings badge in TableNode
const ETL_COLOR = '#6366f1'; // indigo-500

function estimateNodeHeight(slotCount: number, collapsed: boolean): number {
  if (collapsed) return NODE_COLLAPSED_HEIGHT;
  const visibleRows = Math.min(slotCount, MAX_VISIBLE_ROWS);
  return NODE_HEADER_HEIGHT + visibleRows * NODE_ROW_HEIGHT + 8;
}

// ---------------------------------------------------------------------------
// Shared edge-collection helpers
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

/**
 * Collect ETL mapping edges derived from exact_mappings.
 * Each exact_mapping like "omop_cdm54:VisitOccurrence.visit_occurrence_id" produces
 * one edge from the source HiX class to the target OMOP class (if it exists in the schema).
 * One edge per slot mapping — i.e. multiple mappings on one slot produce multiple edges.
 */
function collectEtlEdges(
  schema: NormalizedSchema
): Array<{ source: string; target: string; slotName: string }> {
  const classNames = new Set(Object.keys(schema.classes));
  const result: Array<{ source: string; target: string; slotName: string }> = [];
  for (const [className, cls] of Object.entries(schema.classes)) {
    for (const slot of cls.slots) {
      for (const mapping of slot.exact_mappings) {
        // mapping = "omop_cdm54:VisitOccurrence.visit_occurrence_id"
        const colonIdx = mapping.lastIndexOf(':');
        const dotIdx = mapping.indexOf('.', colonIdx);
        if (colonIdx < 0 || dotIdx < 0) continue;
        const targetClass = mapping.slice(colonIdx + 1, dotIdx);
        if (classNames.has(targetClass) && targetClass !== className) {
          result.push({ source: className, target: targetClass, slotName: slot.name });
        }
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Shared Svelte Flow edge builder
// ---------------------------------------------------------------------------
type FkEdge = { source: string; target: string; slotName: string; required: boolean; kind: 'fk' };
type EtlEdge = { source: string; target: string; slotName: string; kind: 'etl' };
type AnyEdge = FkEdge | EtlEdge;

function buildSvelteEdges(allEdges: AnyEdge[]): Edge[] {
  const edges: Edge[] = [];
  const edgeIdCounts = new Map<string, number>();
  for (const edge of allEdges) {
    const baseId = `${edge.source}--${edge.slotName}--${edge.target}`;
    const count = (edgeIdCounts.get(baseId) ?? 0) + 1;
    edgeIdCounts.set(baseId, count);
    const edgeId = count > 1 ? `${baseId}-${count}` : baseId;

    const isEtl = edge.kind === 'etl';
    const color = isEtl ? ETL_COLOR : NODE_COLOR;
    const strokeWidth = isEtl ? 1.5 : (edge.kind === 'fk' && edge.required ? 2 : 1.5);
    const dashArray = isEtl ? '5,3' : undefined;

    edges.push({
      id: edgeId,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: false,
      style: `stroke: ${color}; stroke-width: ${strokeWidth};${dashArray ? ` stroke-dasharray: ${dashArray};` : ''}`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
        width: 16,
        height: 16,
      },
      data: {
        slotName: edge.slotName,
        required: isEtl ? false : (edge.kind === 'fk' && edge.required),
        targetClass: edge.target,
        edgeKind: edge.kind,
      } as unknown as Record<string, unknown>,
      label: edge.slotName,
      labelStyle: `font-size: 10px; fill: ${isEtl ? ETL_COLOR : '#6b7280'};`,
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
  const fkEdges: AnyEdge[] = collectEdges(schema).map(e => ({ ...e, kind: 'fk' as const }));
  const etlEdges: AnyEdge[] = collectEtlEdges(schema).map(e => ({ ...e, kind: 'etl' as const }));
  const allEdges: AnyEdge[] = [...fkEdges, ...etlEdges];

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
        group: cls.group,
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
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
  const elk = new ELK();

  const fkEdges: AnyEdge[] = collectEdges(schema).map(e => ({ ...e, kind: 'fk' as const }));
  const etlEdges: AnyEdge[] = collectEtlEdges(schema).map(e => ({ ...e, kind: 'etl' as const }));
  const allEdges: AnyEdge[] = [...fkEdges, ...etlEdges];
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
        group: cls.group,
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
