import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { JsonSchema, JsonSchemaProperty } from './types.ts'

// ─── Valibot Introspection ──────────────────────────────

function valibotTypeToJsonType(vType: string | undefined): string | undefined {
  if (vType === 'string' || vType === 'literal') return 'string'
  if (vType === 'boolean') return 'boolean'
  if (vType === 'number') return 'number'
  if (vType === 'picklist' || vType === 'enum') return 'string'
  return undefined
}

function valibotEntryToProperty(raw: Record<string, unknown>): {
  prop: JsonSchemaProperty
  optional: boolean
} {
  const isOptional = raw.type === 'optional' || raw.type === 'nullish'
  const inner = isOptional ? ((raw.wrapped as Record<string, unknown>) ?? raw) : raw
  const prop: JsonSchemaProperty = {}
  const jsonType = valibotTypeToJsonType(inner.type as string | undefined)
  if (jsonType) prop.type = jsonType
  if (inner.message && typeof inner.message === 'string') prop.description = inner.message
  if (isOptional && raw.default !== undefined) {
    prop.default =
      typeof raw.default === 'function' ? (raw.default as () => unknown)() : raw.default
  }
  if (inner.type === 'picklist' && Array.isArray((inner as Record<string, unknown>).options)) {
    prop.enum = (inner as Record<string, unknown>).options as unknown[]
  }
  return { prop, optional: isOptional }
}

// ─── Zod v4 Introspection ───────────────────────────────

function zodTypeToJsonType(zType: string | undefined): string | undefined {
  if (zType === 'string') return 'string'
  if (zType === 'boolean') return 'boolean'
  if (zType === 'number') return 'number'
  if (zType === 'enum') return 'string'
  return undefined
}

function zodEntryToProperty(raw: Record<string, unknown>): {
  prop: JsonSchemaProperty
  optional: boolean
} {
  // Zod v4: raw._zod.def.type, raw._zod.def.innerType, etc.
  const zod = raw._zod as Record<string, unknown> | undefined
  const def = zod?.def as Record<string, unknown> | undefined
  const defType = def?.type as string | undefined
  const isOptional = defType === 'optional' || defType === 'default'
  const innerDef = isOptional
    ? (((def?.innerType as Record<string, unknown>)?._zod as Record<string, unknown> | undefined)
        ?.def as Record<string, unknown> | undefined)
    : def
  const innerType = innerDef?.type as string | undefined
  const prop: JsonSchemaProperty = {}
  const jsonType = zodTypeToJsonType(innerType)
  if (jsonType) prop.type = jsonType
  if (defType === 'default' && def?.defaultValue !== undefined) {
    prop.default =
      typeof def.defaultValue === 'function'
        ? (def.defaultValue as () => unknown)()
        : def.defaultValue
  }
  if (innerType === 'enum' && Array.isArray(innerDef?.values)) {
    prop.enum = innerDef.values as unknown[]
  }
  return { prop, optional: isOptional }
}

// ─── ArkType Introspection ──────────────────────────────

function arkValueToJsonType(value: unknown): string | undefined {
  if (value === 'string') return 'string'
  if (value === 'number') return 'number'
  if (Array.isArray(value)) {
    // Boolean in arktype is [{ unit: false }, { unit: true }]
    if (
      value.length === 2 &&
      value.some(
        (v: unknown) =>
          typeof v === 'object' && v !== null && (v as Record<string, unknown>).unit === false,
      ) &&
      value.some(
        (v: unknown) =>
          typeof v === 'object' && v !== null && (v as Record<string, unknown>).unit === true,
      )
    ) {
      return 'boolean'
    }
  }
  return undefined
}

function arkEntryToProperty(entry: { key: string; value: unknown }): JsonSchemaProperty {
  const prop: JsonSchemaProperty = {}
  const jsonType = arkValueToJsonType(entry.value)
  if (jsonType) prop.type = jsonType
  return prop
}

// ─── Convert Standard Schema → JSON Schema ──────────────

/**
 * Introspect a Standard Schema and extract a JSON Schema representation.
 * Works with Valibot, Zod v4, and ArkType schemas.
 */
export function toJsonSchema(schema: StandardSchemaV1): JsonSchema {
  const s = schema as unknown as Record<string, unknown>
  const properties: Record<string, JsonSchemaProperty> = {}
  const required: string[] = []

  // Valibot: object schema has .entries record
  if (s.entries && typeof s.entries === 'object') {
    for (const [key, rawEntry] of Object.entries(
      s.entries as Record<string, Record<string, unknown>>,
    )) {
      const { prop, optional } = valibotEntryToProperty(rawEntry)
      properties[key] = prop
      if (!optional) required.push(key)
    }
    return { type: 'object', properties, required }
  }

  // Zod v4: shape is accessible via _zod.def.shape
  const zodDef = (s._zod as Record<string, unknown> | undefined)?.def as
    | Record<string, unknown>
    | undefined
  if (zodDef?.shape && typeof zodDef.shape === 'object') {
    for (const [key, rawEntry] of Object.entries(
      zodDef.shape as Record<string, Record<string, unknown>>,
    )) {
      const { prop, optional } = zodEntryToProperty(rawEntry)
      properties[key] = prop
      if (!optional) required.push(key)
    }
    return { type: 'object', properties, required }
  }

  // Zod v3 compat: .shape on the schema directly
  if (s.shape && typeof s.shape === 'object' && !s.entries) {
    for (const [key, rawEntry] of Object.entries(
      s.shape as Record<string, Record<string, unknown>>,
    )) {
      const { prop, optional } = zodEntryToProperty(rawEntry)
      properties[key] = prop
      if (!optional) required.push(key)
    }
    return { type: 'object', properties, required }
  }

  // ArkType: .json with domain 'object', required/optional arrays
  const json = s.json as Record<string, unknown> | undefined
  if (json?.domain === 'object') {
    const reqEntries = json.required as Array<{ key: string; value: unknown }> | undefined
    const optEntries = json.optional as Array<{ key: string; value: unknown }> | undefined
    if (reqEntries) {
      for (const entry of reqEntries) {
        properties[entry.key] = arkEntryToProperty(entry)
        required.push(entry.key)
      }
    }
    if (optEntries) {
      for (const entry of optEntries) {
        properties[entry.key] = arkEntryToProperty(entry)
      }
    }
    return { type: 'object', properties, required }
  }

  return { type: 'object', properties, required }
}

// ─── JSON Schema Utilities ──────────────────────────────

/** Extract default values from a JSON Schema as a flat object. */
export function getDefaults(schema: JsonSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.default !== undefined) defaults[key] = prop.default
  }
  return defaults
}

/** Get required keys that are missing or null/undefined in the data. */
export function getMissingRequired(schema: JsonSchema, data: Record<string, unknown>): string[] {
  return schema.required.filter((key) => data[key] === undefined || data[key] === null)
}

/** Coerce string values to their JSON Schema types. */
export function coerceTypes(
  data: Record<string, unknown>,
  schema: JsonSchema,
): Record<string, unknown> {
  const result = { ...data }
  for (const [key, prop] of Object.entries(schema.properties)) {
    const val = result[key]
    if (val === undefined) continue
    if (prop.type === 'boolean' && typeof val === 'string') {
      if (val === 'true' || val === '1') result[key] = true
      else if (val === 'false' || val === '0') result[key] = false
    } else if (prop.type === 'number' && typeof val === 'string') {
      const num = Number(val)
      if (!Number.isNaN(num)) result[key] = num
    }
  }
  return result
}

// ─── Standard Schema Validation ─────────────────────────

/** Validate data against a Standard Schema. */
export async function validateSchema<T>(
  schema: StandardSchemaV1<unknown, T>,
  data: unknown,
): Promise<
  | { success: true; value: T; issues?: undefined }
  | {
      success: false
      issues: readonly StandardSchemaV1.Issue[]
      value?: undefined
    }
> {
  const result = await schema['~standard'].validate(data)
  if (result.issues) {
    return { success: false, issues: result.issues }
  }
  return { success: true, value: result.value as T }
}
