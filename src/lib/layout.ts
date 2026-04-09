/**
 * Auto-layout for ERD nodes and edges.
 *
 * Visualization model:
 *   - Each table → one "tableParent" node (subflow container)
 *   - Each column → one "column" child node inside its table parent
 *   - FK/ETL edges connect column-to-column (source col → target PK col)
 *
 * Layout strategy:
 *   1. Run dagre/ELK on table-level positions only (83 tables for OMOP CDM).
 *   2. Columns are stacked top-to-bottom inside each parent at fixed y offsets.
 *   3. Parent nodes must appear before their children in the nodes array.
 *
 * Supports two engines (dagre, elkjs) and two directions (LR, TB).
 * Always returns a Promise so callers have a uniform async interface.
 */

import dagre from '@dagrejs/dagre';
import { Position, type Node, type Edge, MarkerType } from '@xyflow/svelte';
import type { NormalizedSchema, ErdTableNodeData, ErdColumnNodeData, LayoutOptions } from './types';

// ---------------------------------------------------------------------------
// Node dimension constants
// ---------------------------------------------------------------------------
const NODE_WIDTH = 260;
const HEADER_HEIGHT = 36;   // table parent header
const ROW_HEIGHT = 24;      // column row height
const PARENT_PADDING_BOTTOM = 4; // extra padding below last column inside parent
const PARENT_BORDER = 2;    // border on each side counted in height

// Single neutral color for FK edges/nodes
const NODE_COLOR = '#475569'; // slate-600
// ETL mapping edge color
const ETL_COLOR = '#6366f1'; // indigo-500

/**
 * Estimate the total height of a table parent node.
 * Collapsed → header only. Expanded → header + all column rows + padding.
 */
function estimateParentHeight(slotCount: number, collapsed: boolean): number {
  if (collapsed) return HEADER_HEIGHT;
  return HEADER_HEIGHT + slotCount * ROW_HEIGHT + PARENT_PADDING_BOTTOM + PARENT_BORDER * 2;
}

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

/**
 * Separator used between class name and slot name in column node IDs.
 * A null byte (\x00) is chosen because it cannot appear in LinkML identifiers
 * (which follow XML NCName rules: alphanumeric + underscore + hyphen + dot).
 * This avoids ambiguity when class or slot names contain "__".
 */
const COL_ID_SEP = '\x00';

/** Column node ID: "ClassName\x00slotName" */
function colId(className: string, slotName: string): string {
  return `${className}${COL_ID_SEP}${slotName}`;
}

/**
 * Find the identifier (PK) slot of a class, returning its column node ID.
 * Falls back to the first slot's column node ID when no PK slot exists.
 * When the table is collapsed, returns the parent table node ID instead so
 * edges connect to the visible table header rather than a missing column node.
 */
function resolvePkNodeId(
  className: string,
  schema: NormalizedSchema,
  collapsed: Set<string>
): string {
  if (collapsed.has(className)) return className;
  const cls = schema.classes[className];
  if (!cls) return className;
  const pk = cls.slots.find((s) => s.identifier);
  if (pk) return colId(className, pk.name);
  // Fall back to the first slot instead of the bare table ID so the edge
  // always connects to a column-level node when the table is expanded.
  return cls.slots.length > 0 ? colId(className, cls.slots[0].name) : className;
}

// ---------------------------------------------------------------------------
// Shared edge-collection helpers
// ---------------------------------------------------------------------------

type FkEdge = {
  kind: 'fk';
  source: string;  // column node ID
  target: string;  // column node ID (PK of target table, or table ID as fallback)
  slotName: string;
  required: boolean;
  /** Table-level source/target for layout engine */
  layoutSource: string;
  layoutTarget: string;
};

type EtlEdge = {
  kind: 'etl';
  source: string;  // column node ID
  target: string;  // column node ID (PK of target table, or table ID as fallback)
  slotName: string;
  /** Table-level source/target for layout engine */
  layoutSource: string;
  layoutTarget: string;
};

type AnyEdge = FkEdge | EtlEdge;

function collectEdges(schema: NormalizedSchema, collapsed: Set<string>): FkEdge[] {
  const classNames = new Set(Object.keys(schema.classes));
  const result: FkEdge[] = [];
  for (const [className, cls] of Object.entries(schema.classes)) {
    for (const slot of cls.slots) {
      if (slot.is_fk && classNames.has(slot.range) && slot.range !== className) {
        // Source: if this table is collapsed, use table ID; otherwise use column ID
        const source = collapsed.has(className)
          ? className
          : colId(className, slot.name);
        result.push({
          kind: 'fk',
          source,
          target: resolvePkNodeId(slot.range, schema, collapsed),
          slotName: slot.name,
          required: slot.required,
          layoutSource: className,
          layoutTarget: slot.range,
        });
      }
    }
  }
  return result;
}

function collectEtlEdges(schema: NormalizedSchema, collapsed: Set<string>): EtlEdge[] {
  const classNames = new Set(Object.keys(schema.classes));
  const result: EtlEdge[] = [];
  for (const [className, cls] of Object.entries(schema.classes)) {
    for (const slot of cls.slots) {
      for (const mapping of slot.exact_mappings) {
        const colonIdx = mapping.lastIndexOf(':');
        const dotIdx = mapping.indexOf('.', colonIdx);
        if (colonIdx < 0 || dotIdx < 0) continue;
        const targetClass = mapping.slice(colonIdx + 1, dotIdx);
        if (classNames.has(targetClass) && targetClass !== className) {
          // Source: if this table is collapsed, use table ID; otherwise use column ID
          const source = collapsed.has(className)
            ? className
            : colId(className, slot.name);
          result.push({
            kind: 'etl',
            source,
            target: resolvePkNodeId(targetClass, schema, collapsed),
            slotName: slot.name,
            layoutSource: className,
            layoutTarget: targetClass,
          });
        }
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Svelte Flow edge builder
// ---------------------------------------------------------------------------

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
      zIndex: 1, // render above parent nodes (required for cross-subflow edges)
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
// Node builders (shared between dagre and ELK paths)
// ---------------------------------------------------------------------------

/**
 * Build the tableParent node at the given position (top-left corner).
 */
function buildTableParentNode(
  className: string,
  schema: NormalizedSchema,
  collapsed: Set<string>,
  position: { x: number; y: number },
  isLR: boolean
): Node {
  const cls = schema.classes[className];
  const isCollapsed = collapsed.has(className);
  const height = estimateParentHeight(cls.slots.length, isCollapsed);

  return {
    id: className,
    type: 'tableParent',
    position,
    style: `width: ${NODE_WIDTH}px; height: ${height}px;`,
    class: 'parent',
    data: {
      label: className,
      description: cls.description,
      collapsed: isCollapsed,
      group: cls.group,
      fileId: cls.fileId,
      slotCount: cls.slots.length,
    } as unknown as Record<string, unknown>,
    sourcePosition: isLR ? Position.Right : Position.Bottom,
    targetPosition: isLR ? Position.Left : Position.Top,
  };
}

/**
 * Build column child nodes for a table.
 * Returns an empty array when the table is collapsed.
 * Column nodes use relative positions inside the parent.
 */
function buildColumnNodes(
  className: string,
  schema: NormalizedSchema,
  collapsed: Set<string>,
  isLR: boolean
): Node[] {
  // Guard: never produce child nodes for collapsed tables — their column IDs
  // would be absent from the nodes array, causing dangling edge references.
  if (collapsed.has(className)) return [];
  const cls = schema.classes[className];
  return cls.slots.map((slot, index) => ({
    id: colId(className, slot.name),
    type: 'column',
    parentId: className,
    extent: 'parent' as const,
    draggable: true,
    position: {
      x: 0,
      y: HEADER_HEIGHT + index * ROW_HEIGHT,
    },
    style: `width: ${NODE_WIDTH}px; height: ${ROW_HEIGHT}px;`,
    data: {
      slotName: slot.name,
      slot_name: slot.slot_name,
      range: slot.range,
      required: slot.required,
      identifier: slot.identifier,
      is_fk: slot.is_fk,
      description: slot.description,
      exact_mappings: slot.exact_mappings,
      tableId: className,
    } as unknown as Record<string, unknown>,
    sourcePosition: isLR ? Position.Right : Position.Bottom,
    targetPosition: isLR ? Position.Left : Position.Top,
  }));
}

// ---------------------------------------------------------------------------
// Dagre layout
// ---------------------------------------------------------------------------

function buildGraphDagre(
  schema: NormalizedSchema,
  collapsed: Set<string>,
  direction: 'LR' | 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const fkEdges = collectEdges(schema, collapsed);
  const etlEdges = collectEtlEdges(schema, collapsed);
  const allEdges: AnyEdge[] = [...fkEdges, ...etlEdges];

  // --- Run dagre on tables only ---
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 120,
    edgesep: 20,
    marginx: 40,
    marginy: 40,
  });

  for (const [className, cls] of Object.entries(schema.classes)) {
    const height = estimateParentHeight(cls.slots.length, collapsed.has(className));
    g.setNode(className, { width: NODE_WIDTH, height });
  }
  // Feed layout-level edges (table-to-table) so dagre can rank properly
  for (const edge of allEdges) {
    g.setEdge(edge.layoutSource, edge.layoutTarget);
  }
  dagre.layout(g);

  const isLR = direction === 'LR';
  const tableNodes: Node[] = [];
  const columnNodes: Node[] = [];

  for (const [className] of Object.entries(schema.classes)) {
    const dagreNode = g.node(className);
    if (!dagreNode) continue;

    const position = {
      x: dagreNode.x - NODE_WIDTH / 2,
      y: dagreNode.y - dagreNode.height / 2,
    };

    tableNodes.push(buildTableParentNode(className, schema, collapsed, position, isLR));

    if (!collapsed.has(className)) {
      columnNodes.push(...buildColumnNodes(className, schema, collapsed, isLR));
    }
  }

  // Parents must appear before children in the nodes array
  return { nodes: [...tableNodes, ...columnNodes], edges: buildSvelteEdges(allEdges) };
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

  const fkEdges = collectEdges(schema, collapsed);
  const etlEdges = collectEtlEdges(schema, collapsed);
  const allEdges: AnyEdge[] = [...fkEdges, ...etlEdges];
  const isLR = direction === 'LR';

  const elkNodes = Object.entries(schema.classes).map(([className, cls]) => ({
    id: className,
    width: NODE_WIDTH,
    height: estimateParentHeight(cls.slots.length, collapsed.has(className)),
  }));

  const elkEdges = allEdges.map((e, i) => ({
    id: `e${i}`,
    sources: [e.layoutSource],
    targets: [e.layoutTarget],
  }));

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': isLR ? 'RIGHT' : 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '60',
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

  const tableNodes: Node[] = [];
  const columnNodes: Node[] = [];

  for (const [className] of Object.entries(schema.classes)) {
    const pos = posMap.get(className);
    if (!pos) continue;

    tableNodes.push(buildTableParentNode(className, schema, collapsed, pos, isLR));

    if (!collapsed.has(className)) {
      columnNodes.push(...buildColumnNodes(className, schema, collapsed, isLR));
    }
  }

  return { nodes: [...tableNodes, ...columnNodes], edges: buildSvelteEdges(allEdges) };
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
