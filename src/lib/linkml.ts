/**
 * LinkML schema parser
 *
 * Accepts two input formats:
 *  1. Raw LinkML YAML (the primary format) — supports both:
 *     a. slots: list + top-level slots: dict + slot_usage: overrides
 *     b. attributes: inline slot definitions on each class
 *  2. Pre-normalized JSON export (legacy, for compatibility with uploaded JSON files)
 *
 * Outputs a NormalizedSchema that the ERD layout and Svelte Flow components consume.
 */

import yaml from 'js-yaml';
import { base } from '$app/paths';
import type {
  NormalizedSchema,
  ErdClass,
  ErdSlot,
  RawLinkMLSchema,
  RawLinkMLSlot,
} from './types';

// ---------------------------------------------------------------------------
// Primitive type set (ranges that are NOT foreign keys)
// ---------------------------------------------------------------------------

const PRIMITIVE_RANGES = new Set([
  'string',
  'integer',
  'float',
  'double',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'time',
  'date_or_datetime',
  'uri',
  'uriorcurie',
  'curie',
  'ncname',
  'objectidentifier',
  'nodeidentifier',
  'jsonpointer',
  'jsonpath',
  'sparqlpath',
]);

// ---------------------------------------------------------------------------
// Parser: normalized JSON (legacy — pre-generated export format)
// ---------------------------------------------------------------------------

/**
 * Check whether the input looks like our normalized JSON export.
 *
 * Raw LinkML YAML also has a top-level `classes` object, so we must be more
 * specific. We scan every class entry looking for a discriminating signal:
 *
 * - A class with `slot_usage` → definitely raw LinkML
 * - A class whose `slots` is a non-empty string array → definitely raw LinkML
 * - A class whose `slots` is a non-empty object array → definitely normalized JSON
 *
 * Classes with empty/absent slots carry no signal and are skipped. If every
 * class is slot-less (no signal found) we conservatively return false so the
 * raw parser handles it — this is safe because the raw parser tolerates
 * slot-less classes gracefully.
 */
function isNormalizedJson(raw: unknown): raw is NormalizedSchema {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  if (typeof r.classes !== 'object' || r.classes === null) return false;

  const classes = r.classes as Record<string, unknown>;

  for (const classEntry of Object.values(classes)) {
    if (typeof classEntry !== 'object' || classEntry === null) continue;
    const fc = classEntry as Record<string, unknown>;

    // Definitive raw-LinkML signal: presence of slot_usage
    if ('slot_usage' in fc) return false;

    const slots = fc.slots;
    if (!Array.isArray(slots) || slots.length === 0) continue; // no signal, keep scanning

    // Definitive raw-LinkML signal: slots is a string array
    if (typeof slots[0] === 'string') return false;

    // Definitive normalized signal: slots is an object array
    if (typeof slots[0] === 'object') return true;
  }

  // No discriminating signal found (all classes are slot-less) — treat as raw
  return false;
}

function parseNormalizedJson(raw: NormalizedSchema): NormalizedSchema {
  return raw; // already in correct shape
}

// ---------------------------------------------------------------------------
// Parser: raw LinkML YAML
// ---------------------------------------------------------------------------

function parseRawLinkML(raw: RawLinkMLSchema): NormalizedSchema {
  const rawClasses = raw.classes ?? {};
  const rawSlots = raw.slots ?? {};
  const classNames = new Set(Object.keys(rawClasses));

  const classes: Record<string, ErdClass> = {};

  for (const [className, classDef] of Object.entries(rawClasses)) {
    if (classDef.abstract) continue; // skip abstract classes

    const slots: ErdSlot[] = [];

    // -----------------------------------------------------------------------
    // Path A: attributes: — inline slot definitions directly on the class
    // -----------------------------------------------------------------------
    if (classDef.attributes && Object.keys(classDef.attributes).length > 0) {
      for (const [attrName, attrDef] of Object.entries(classDef.attributes)) {
        const range = String(attrDef.range ?? 'string');
        const isIdentifier = Boolean(attrDef.identifier);
        const isFk = classNames.has(range) && !isIdentifier && !PRIMITIVE_RANGES.has(range);
        const displayName = String(attrDef.alias ?? attrDef.name ?? attrName);

        slots.push({
          name: displayName,
          slot_name: attrName,
          range,
          required: Boolean(attrDef.required),
          identifier: isIdentifier,
          multivalued: Boolean(attrDef.multivalued),
          is_fk: isFk,
          description: String(attrDef.description ?? ''),
        });
      }
    }

    // -----------------------------------------------------------------------
    // Path B: slots: list + top-level slots: dict + slot_usage: overrides
    // -----------------------------------------------------------------------
    if (classDef.slots && classDef.slots.length > 0) {
      const slotUsage = classDef.slot_usage ?? {};

      for (const slotRefName of classDef.slots) {
        const topSlot: RawLinkMLSlot = rawSlots[slotRefName] ?? {};
        const usageSlot: Partial<RawLinkMLSlot> = slotUsage[slotRefName] ?? {};

        // Merge: slot_usage overrides top-level
        const merged: RawLinkMLSlot = { ...topSlot, ...usageSlot };

        // Display name: prefer alias, then strip class prefix from slot name
        const displayName =
          merged.alias ??
          (slotRefName.startsWith(className + '_')
            ? slotRefName.slice(className.length + 1)
            : slotRefName);

        const range = String(merged.range ?? 'string');
        const isIdentifier = Boolean(merged.identifier);
        const isFk = classNames.has(range) && !isIdentifier && !PRIMITIVE_RANGES.has(range);

        slots.push({
          name: displayName,
          slot_name: slotRefName,
          range,
          required: Boolean(merged.required),
          identifier: isIdentifier,
          multivalued: Boolean(merged.multivalued),
          is_fk: isFk,
          description: String(merged.description ?? ''),
        });
      }
    }

    classes[className] = {
      name: className,
      description: String(classDef.description ?? ''),
      slots,
    };
  }

  return {
    name: String(raw.name ?? 'Unknown schema'),
    description: String(raw.description ?? ''),
    id: String(raw.id ?? ''),
    classes,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a LinkML schema from either:
 *  - A raw YAML/JSON string
 *  - A pre-parsed object (normalized JSON export or raw YAML parsed by js-yaml)
 */
export function parseLinkMLSchema(input: unknown): NormalizedSchema {
  let raw: unknown = input;

  // If given a string, parse it first
  if (typeof input === 'string') {
    const trimmed = input.trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      raw = JSON.parse(input);
    } else {
      raw = yaml.load(input);
    }
  }

  if (isNormalizedJson(raw)) {
    return parseNormalizedJson(raw);
  }

  // Treat as raw LinkML YAML
  return parseRawLinkML(raw as RawLinkMLSchema);
}

/**
 * Load the default OMOP CDM schema from the static YAML asset.
 */
export async function loadDefaultSchema(): Promise<NormalizedSchema> {
  const res = await fetch(`${base}/omop_cdm.yaml`);
  if (!res.ok) throw new Error(`Failed to load default schema: ${res.statusText}`);
  const text = await res.text();
  return parseLinkMLSchema(text);
}
