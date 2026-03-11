// ---------------------------------------------------------------------------
// LinkML schema types — matches the raw YAML structure for uploaded files
// and the normalized internal representation consumed by the ERD layout.
// ---------------------------------------------------------------------------

/** A single slot/column */
export interface ErdSlot {
  name: string;         // display name (alias-resolved or attribute key)
  slot_name: string;    // internal LinkML slot name
  range: string;        // e.g. "integer", "string", "person", "concept"
  required: boolean;
  identifier: boolean;  // true = primary key
  multivalued: boolean;
  is_fk: boolean;       // true when range points to another class in the schema
  description: string;
  exact_mappings: string[]; // e.g. ["omop_cdm54:Person.person_source_value"]
}

/** A single class/table in the ERD */
export interface ErdClass {
  name: string;
  description: string;
  slots: ErdSlot[];
  group?: string;   // e.g. "clinical", "vocabulary", "hix" — from annotations.group
  fileId?: string;  // WorkspaceFile.id of the file this class was parsed from
}

/** The top-level normalized schema structure */
export interface NormalizedSchema {
  name: string;
  description: string;
  id: string;
  classes: Record<string, ErdClass>;
}

// ---------------------------------------------------------------------------
// Raw LinkML YAML types — used when parsing an uploaded .yaml file directly
// ---------------------------------------------------------------------------

export interface RawLinkMLSlot {
  name?: string;
  range?: string;
  required?: boolean;
  identifier?: boolean;
  multivalued?: boolean;
  description?: string;
  alias?: string;
  domain_of?: string[];
  is_a?: string;
  slot_uri?: string;
  exact_mappings?: string[];
  annotations?: Record<string, { tag: string; value: unknown } | string | number | boolean | null>;
}

export interface RawLinkMLClass {
  name?: string;
  description?: string;
  // slots: list style — references into top-level slots: dict
  slots?: string[];
  slot_usage?: Record<string, Partial<RawLinkMLSlot>>;
  // attributes: inline style — slot definitions directly on the class
  attributes?: Record<string, RawLinkMLSlot>;
  is_a?: string;
  abstract?: boolean;
  // annotations: arbitrary key → {tag, value} pairs or compact scalar (e.g. group: clinical)
  annotations?: Record<string, { tag: string; value: unknown } | string | number | boolean | null>;
}

export interface RawLinkMLSchema {
  name?: string;
  description?: string;
  id?: string;
  classes?: Record<string, RawLinkMLClass>;
  slots?: Record<string, RawLinkMLSlot>;
  /** Raw import list from the YAML (e.g. ["linkml:types", "hix", "sein-omop"]) */
  imports?: string[];
}

// ---------------------------------------------------------------------------
// Workspace — multi-file upload and import resolution
// ---------------------------------------------------------------------------

/**
 * A single file loaded into the workspace.
 * Pre-parsed so import resolution is synchronous.
 */
export interface WorkspaceFile {
  /** Stable unique identifier (crypto.randomUUID) */
  id: string;
  /** Original filename, e.g. "hix.yaml" */
  name: string;
  /** Filename without extension, used for import matching, e.g. "hix" */
  stem: string;
  /** Raw YAML/JSON text */
  text: string;
  /** Pre-parsed schema */
  schema: NormalizedSchema;
  /**
   * User-defined import names from the raw YAML `imports:` list,
   * with built-in linkml:* entries stripped.
   * e.g. ["hix", "sein-omop"]
   */
  imports: string[];
}

// ---------------------------------------------------------------------------
// Layout options — controls which engine and direction to use
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  engine: 'dagre' | 'elk';
  direction: 'LR' | 'TB';
}

// ---------------------------------------------------------------------------
// Group configuration — loaded from static/group-config.yaml
// ---------------------------------------------------------------------------

/** One entry from group-config.yaml */
export interface GroupInfo {
  name: string;       // e.g. "clinical"
  label: string;      // e.g. "Clinical"
  color: string;      // hex header background, e.g. "#2563eb"
  text_color: string; // hex header text, e.g. "#ffffff"
}

/** Top-level shape of group-config.yaml */
export interface GroupConfig {
  groups: GroupInfo[];
}

// ---------------------------------------------------------------------------
// File configuration — auto-assigned per-file colors for multi-file workspaces
// ---------------------------------------------------------------------------

/** Per-file color entry, keyed by WorkspaceFile.id */
export interface FileInfo {
  id: string;     // WorkspaceFile.id
  label: string;  // display name: schema.name or filename stem
  color: string;  // hex stripe color, auto-assigned from FILE_PALETTE
}

// ---------------------------------------------------------------------------
// ERD graph model — output of the parser, input to Svelte Flow
// ---------------------------------------------------------------------------

export interface ErdNodeData {
  label: string;
  description: string;
  slots: ErdSlot[];
  collapsed: boolean;
  highlighted?: boolean;
  group?: string;   // propagated from ErdClass.group
  fileId?: string;  // propagated from ErdClass.fileId — drives the left stripe color
}

export interface ErdEdgeData {
  slotName: string;
  required: boolean;
  targetClass: string;
  edgeKind: 'fk' | 'etl'; // 'fk' = structural FK via range:; 'etl' = exact_mappings ETL
}
