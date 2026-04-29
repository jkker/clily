import type { StandardJSONSchemaV1 } from '@standard-schema/spec'
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema'

type SchemaKind = 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cloneValue = <T>(value: T): T => {
  if (value === undefined) return value
  if (typeof value !== 'object' || value === null) return value

  return structuredClone(value)
}

const isSchemaObject = (schema: JSONSchema7Definition | undefined): schema is JSONSchema7 =>
  typeof schema === 'object' && schema !== null

const getItemSchema = (schema: JSONSchema7): JSONSchema7 | undefined => {
  if (Array.isArray(schema.items)) return undefined
  return isSchemaObject(schema.items) ? schema.items : undefined
}

const normalizeType = (schema: JSONSchema7): SchemaKind | undefined => {
  const rawType = Array.isArray(schema.type)
    ? schema.type.find((candidate): candidate is SchemaKind => candidate !== 'null')
    : schema.type

  if (rawType) return rawType as SchemaKind
  if (!Array.isArray(schema.enum) || schema.enum.length === 0) return undefined

  const sample = schema.enum.find((candidate) => candidate !== null)
  if (typeof sample === 'boolean') return 'boolean'
  if (typeof sample === 'number') return Number.isInteger(sample) ? 'integer' : 'number'
  if (typeof sample === 'string') return 'string'
  return undefined
}

const coerceBoolean = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  if (['1', 'on', 'true', 'yes'].includes(value.toLowerCase())) return true
  if (['0', 'off', 'false', 'no'].includes(value.toLowerCase())) return false
  return value
}

const coerceNumber = (value: unknown, integerOnly: boolean): unknown => {
  if (typeof value !== 'string' && typeof value !== 'number') return value

  const nextValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(nextValue)) return value
  if (integerOnly && !Number.isInteger(nextValue)) return value
  return nextValue
}

const coerceArray = (value: unknown, schema: JSONSchema7): unknown => {
  const itemSchema = getItemSchema(schema)
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.trim().startsWith('[')
        ? (() => {
            try {
              const parsed: unknown = JSON.parse(value)
              return Array.isArray(parsed) ? (parsed as unknown[]) : [value]
            } catch {
              return value
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
            }
          })()
        : value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
      : value

  if (!Array.isArray(values) || !itemSchema) return values

  return values.map((entry) => coerceValue(entry, itemSchema))
}

const coerceObject = (value: unknown, schema: JSONSchema7): unknown => {
  if (!isRecord(value)) return value

  const nextValue: Record<string, unknown> = { ...value }
  for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
    if (!(key in nextValue) || !isSchemaObject(propertySchema)) continue
    nextValue[key] = coerceValue(nextValue[key], propertySchema)
  }

  return nextValue
}

const collectDefaults = (schema: JSONSchema7): unknown => {
  if (schema.default !== undefined) return cloneValue(schema.default)

  if (normalizeType(schema) !== 'object') return undefined

  const defaults: Record<string, unknown> = {}
  for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
    if (!isSchemaObject(propertySchema)) continue

    const propertyDefaults = collectDefaults(propertySchema)
    if (propertyDefaults !== undefined) defaults[key] = propertyDefaults
  }

  return Object.keys(defaults).length > 0 ? defaults : undefined
}

const visitMissingLeaves = (
  schema: JSONSchema7,
  value: unknown,
  path: string[],
  required: boolean,
  missing: Array<{ path: string[]; schema: JSONSchema7 }>,
): void => {
  if (normalizeType(schema) === 'object') {
    const nextValue = isRecord(value) ? value : undefined
    const requiredKeys = new Set(schema.required ?? [])

    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (!isSchemaObject(propertySchema)) continue
      const childValue = nextValue?.[key]
      const childRequired = requiredKeys.has(key)
      if (childValue === undefined && !childRequired) continue
      visitMissingLeaves(propertySchema, childValue, [...path, key], childRequired, missing)
    }
    return
  }

  if (required && (value === undefined || value === null)) missing.push({ path, schema })
}

const getSchemaAtPathInner = (
  schema: JSONSchema7,
  path: readonly string[],
  index: number,
): JSONSchema7 | undefined => {
  if (index >= path.length) return schema

  const kind = normalizeType(schema)
  const segment = path[index]

  if (kind === 'object') {
    const nextSchema = schema.properties?.[segment]
    if (!isSchemaObject(nextSchema)) return undefined
    return getSchemaAtPathInner(nextSchema, path, index + 1)
  }

  if (kind === 'array') {
    const itemSchema = getItemSchema(schema)
    if (!itemSchema) return undefined
    return /^\d+$/.test(segment)
      ? getSchemaAtPathInner(itemSchema, path, index + 1)
      : getSchemaAtPathInner(itemSchema, path, index)
  }

  return undefined
}

/** Convert a Standard JSON Schema entity into a Draft 7 JSON Schema. */
export const toJsonSchema = (schema: StandardJSONSchemaV1): JSONSchema7 =>
  schema['~standard'].jsonSchema.input({ target: 'draft-07' }) as JSONSchema7

/** Assert that a command `args` schema resolves to an object schema. */
export function asObjectSchema(schema: JSONSchema7, label: string): JSONSchema7 {
  if (normalizeType(schema) === 'object') return schema

  throw new Error(`${label} must resolve to a JSON Schema object.`)
}

/** Assert that a command `positionals` schema resolves to a supported primitive or primitive array. */
export function asPositionalSchema(schema: JSONSchema7, label: string): JSONSchema7 {
  const kind = normalizeType(schema)
  if (kind && kind !== 'object') {
    if (kind !== 'array') return schema

    const itemSchema = getItemSchema(schema)
    const itemKind = itemSchema ? normalizeType(itemSchema) : undefined
    if (itemKind && itemKind !== 'object' && itemKind !== 'array') return schema
  }

  throw new Error(`${label} must resolve to a primitive or primitive-array JSON Schema.`)
}

/** Read the effective JSON Schema kind for a schema node. */
export function getSchemaKind(schema: JSONSchema7): SchemaKind | undefined {
  return normalizeType(schema)
}

/** Resolve a nested schema node from a property path. */
export function getSchemaAtPath(
  schema: JSONSchema7,
  path: readonly string[],
): JSONSchema7 | undefined {
  return getSchemaAtPathInner(schema, path, 0)
}

/** Build recursive defaults for an object schema. */
export function getObjectDefaults(schema: JSONSchema7): Record<string, unknown> {
  const defaults = collectDefaults(schema)
  return isRecord(defaults) ? defaults : {}
}

/** Coerce stringly input into the JSON Schema types a command expects. */
export function coerceValue(value: unknown, schema: JSONSchema7): unknown {
  const kind = normalizeType(schema)
  if (!kind) return value

  if (kind === 'array') return coerceArray(value, schema)
  if (kind === 'boolean') return coerceBoolean(value)
  if (kind === 'integer') return coerceNumber(value, true)
  if (kind === 'number') return coerceNumber(value, false)
  if (kind === 'object') return coerceObject(value, schema)
  return value
}

/** Coerce an object payload using each property's JSON Schema type recursively. */
export function coerceObjectValue(
  value: Record<string, unknown>,
  schema: JSONSchema7,
): Record<string, unknown> {
  const coerced = coerceObject(value, schema)
  return isRecord(coerced) ? coerced : value
}

/** Collect missing required leaf values from an object schema. */
export function findMissingObjectLeaves(
  schema: JSONSchema7,
  value: unknown,
): Array<{ path: string[]; schema: JSONSchema7 }> {
  const missing: Array<{ path: string[]; schema: JSONSchema7 }> = []
  visitMissingLeaves(schema, value, [], true, missing)
  return missing
}
