import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { SchemaEntry } from './types.ts'

/**
 * Detect the type of a schema entry by inspecting common library internals.
 */
function detectEntryType(entry: Record<string, unknown>): SchemaEntry['type'] {
  // Valibot type strings
  const vType = entry.type as string | undefined
  if (vType === 'string' || vType === 'literal') return 'string'
  if (vType === 'boolean') return 'boolean'
  if (vType === 'number') return 'number'
  if (vType === 'picklist' || vType === 'enum') return 'string'
  // Zod: _def.typeName
  const zDef = entry._def as Record<string, unknown> | undefined
  if (zDef?.typeName === 'ZodString') return 'string'
  if (zDef?.typeName === 'ZodBoolean') return 'boolean'
  if (zDef?.typeName === 'ZodNumber') return 'number'
  return 'unknown'
}

/**
 * Extract the default value from a schema entry, if present.
 */
function extractDefault(entry: Record<string, unknown>): unknown {
  // Valibot optional with default
  if (entry.type === 'optional' || entry.type === 'nullish') {
    const def = entry.default
    if (def !== undefined) {
      return typeof def === 'function' ? (def as () => unknown)() : def
    }
  }
  // Zod defaults
  const zDef = entry._def as Record<string, unknown> | undefined
  if (zDef?.defaultValue !== undefined) {
    return typeof zDef.defaultValue === 'function'
      ? (zDef.defaultValue as () => unknown)()
      : zDef.defaultValue
  }
  return undefined
}

/**
 * Unwrap optional/nullish wrapper to get the inner schema entry.
 */
function unwrapEntry(entry: Record<string, unknown>): Record<string, unknown> {
  // Valibot: optional wraps .wrapped
  if ((entry.type === 'optional' || entry.type === 'nullish') && entry.wrapped) {
    return entry.wrapped as Record<string, unknown>
  }
  // Zod: ZodOptional wraps ._def.innerType, ZodDefault wraps ._def.innerType
  const zDef = entry._def as Record<string, unknown> | undefined
  if (
    zDef &&
    (zDef.typeName === 'ZodOptional' || zDef.typeName === 'ZodDefault') &&
    zDef.innerType
  ) {
    return zDef.innerType as Record<string, unknown>
  }
  return entry
}

/**
 * Extract metadata entries from a Standard Schema object schema.
 * Attempts introspection on known libraries (valibot, zod).
 * Returns an empty array if introspection is not possible.
 */
export function getSchemaEntries(schema: StandardSchemaV1): SchemaEntry[] {
  const s = schema as unknown as Record<string, unknown>
  const entries: SchemaEntry[] = []

  // Valibot: object schema has .entries record
  if (s.entries && typeof s.entries === 'object') {
    for (const [key, rawEntry] of Object.entries(
      s.entries as Record<string, Record<string, unknown>>,
    )) {
      const isOptional =
        (rawEntry as Record<string, unknown>).type === 'optional' ||
        (rawEntry as Record<string, unknown>).type === 'nullish'
      const inner = unwrapEntry(rawEntry as Record<string, unknown>)
      const defaultVal = extractDefault(rawEntry as Record<string, unknown>)
      entries.push({
        key,
        type: detectEntryType(inner),
        required: !isOptional,
        default: defaultVal,
        description:
          (inner.message as string) ||
          ((rawEntry as Record<string, unknown>).message as string) ||
          undefined,
      })
    }
    return entries
  }

  // Zod: object schema has .shape record
  if (s.shape && typeof s.shape === 'object') {
    for (const [key, rawEntry] of Object.entries(
      s.shape as Record<string, Record<string, unknown>>,
    )) {
      const zDef = (rawEntry as Record<string, unknown>)._def as Record<string, unknown>
      const isOptional = zDef?.typeName === 'ZodOptional' || zDef?.typeName === 'ZodDefault'
      const inner = unwrapEntry(rawEntry as Record<string, unknown>)
      const defaultVal = extractDefault(rawEntry as Record<string, unknown>)
      entries.push({
        key,
        type: detectEntryType(inner),
        required: !isOptional && defaultVal === undefined,
        default: defaultVal,
        description: undefined,
      })
    }
    return entries
  }

  return entries
}

/**
 * Validate data against a Standard Schema.
 * Returns the validated output or throws with issues.
 */
export async function validateSchema<T>(
  schema: StandardSchemaV1<unknown, T>,
  data: unknown,
): Promise<
  | { success: true; value: T; issues?: undefined }
  | { success: false; issues: readonly StandardSchemaV1.Issue[]; value?: undefined }
> {
  const result = await schema['~standard'].validate(data)
  if (result.issues) {
    return { success: false, issues: result.issues }
  }
  return { success: true, value: result.value as T }
}

/**
 * Extract default values from schema entries as a flat object.
 */
export function getSchemaDefaults(schema: StandardSchemaV1): Record<string, unknown> {
  const entries = getSchemaEntries(schema)
  const defaults: Record<string, unknown> = {}
  for (const entry of entries) {
    if (entry.default !== undefined) {
      defaults[entry.key] = entry.default
    }
  }
  return defaults
}

/**
 * Get the keys that are required but missing from the given data.
 */
export function getMissingRequiredKeys(
  schema: StandardSchemaV1,
  data: Record<string, unknown>,
): string[] {
  const entries = getSchemaEntries(schema)
  return entries
    .filter((e) => e.required && (data[e.key] === undefined || data[e.key] === null))
    .map((e) => e.key)
}
