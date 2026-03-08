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
}

/** A single class/table in the ERD */
export interface ErdClass {
  name: string;
  description: string;
  slots: ErdSlot[];
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
}

export interface RawLinkMLSchema {
  name?: string;
  description?: string;
  id?: string;
  classes?: Record<string, RawLinkMLClass>;
  slots?: Record<string, RawLinkMLSlot>;
}

// ---------------------------------------------------------------------------
// ERD graph model — output of the parser, input to Svelte Flow
// ---------------------------------------------------------------------------

export interface ErdNodeData {
  label: string;
  description: string;
  slots: ErdSlot[];
  collapsed: boolean;
}

export interface ErdEdgeData {
  slotName: string;
  required: boolean;
  targetClass: string;
}
