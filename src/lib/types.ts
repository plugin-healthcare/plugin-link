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
  domain?: string; // e.g. "clinical", "vocabulary", "hix" — from annotations.domain
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
  annotations?: Record<string, { tag: string; value: unknown }>;
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
  // annotations: arbitrary key → {tag, value} pairs (e.g. domain, source_table)
  annotations?: Record<string, { tag: string; value: unknown }>;
}

export interface RawLinkMLSchema {
  name?: string;
  description?: string;
  id?: string;
  classes?: Record<string, RawLinkMLClass>;
  slots?: Record<string, RawLinkMLSlot>;
}

// ---------------------------------------------------------------------------
// Layout options — controls which engine and direction to use
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  engine: 'dagre' | 'elk';
  direction: 'LR' | 'TB';
}

// ---------------------------------------------------------------------------
// Domain configuration — loaded from static/domain-config.yaml
// ---------------------------------------------------------------------------

/** One entry from domain-config.yaml */
export interface DomainInfo {
  name: string;       // e.g. "clinical"
  label: string;      // e.g. "Clinical"
  color: string;      // hex header background, e.g. "#2563eb"
  text_color: string; // hex header text, e.g. "#ffffff"
}

/** Top-level shape of domain-config.yaml */
export interface DomainConfig {
  domains: DomainInfo[];
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
  domain?: string; // propagated from ErdClass.domain
}

export interface ErdEdgeData {
  slotName: string;
  required: boolean;
  targetClass: string;
  edgeKind: 'fk' | 'etl'; // 'fk' = structural FK via range:; 'etl' = exact_mappings ETL
}
