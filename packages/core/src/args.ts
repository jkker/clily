import { parseArgs, type ParseArgsOptionsConfig } from 'node:util'

import type { JSONSchema7 } from 'json-schema'

import { ClilyError } from './errors.ts'
import { getSchemaKind } from './schema.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isUnsafeKey = (value: string): boolean =>
  value === '__proto__' || value === 'constructor' || value === 'prototype'

/** Flattened option metadata derived from a command `args` schema. */
export interface ArgDefinition {
  /** Property path in schema space, using original object keys. */
  path: string[]

  /** CLI flag name derived from the property path. */
  cliKey: string

  /** Environment variable suffix derived from the property path. */
  envKey: string

  /** Effective JSON Schema node for this option. */
  schema: JSONSchema7

  /** Whether this leaf is unconditionally required. */
  required: boolean
}

/** Convert a camelCase segment to the kebab-case form used in CLI flags. */
function camelToKebab(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
}

/** Convert a command or property segment to SCREAMING_SNAKE_CASE. */
function toEnvSegment(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toUpperCase()
}

/** Join a property path into the dot-notation key accepted by clily flags. */
export function pathToCliKey(path: string[]): string {
  return path.map(camelToKebab).join('.')
}

/** Join a property path into the double-underscore env key suffix used by clily. */
function pathToEnvKey(path: string[]): string {
  return path.map(toEnvSegment).join('__')
}

/** Build an environment variable prefix for a command path. */
function toEnvPrefix(commandPath: string[]): string {
  return `${commandPath.map(toEnvSegment).join('_')}_`
}

/** Safely assign a nested value inside an object using a schema property path. */
export function setNestedValue(
  target: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  let current = target
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    if (isUnsafeKey(key)) return

    const nextValue = current[key]
    if (!isRecord(nextValue)) current[key] = {}
    current = current[key] as Record<string, unknown>
  }

  const lastKey = path.at(-1)
  if (!lastKey || isUnsafeKey(lastKey)) return
  current[lastKey] = value
}

/** Read a nested value from an object using a schema property path. */
export function getNestedValue(source: unknown, path: string[]): unknown {
  let current = source
  for (const key of path) {
    if (!isRecord(current) || !(key in current)) return undefined
    current = current[key]
  }
  return current
}

/** Flatten a JSON Schema object into leaf option definitions. */
export function flattenArgDefinitions(
  schema: JSONSchema7,
  path: string[] = [],
  parentRequired = true,
): ArgDefinition[] {
  const definitions: ArgDefinition[] = []
  const requiredKeys = new Set(schema.required ?? [])

  for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
    if (!propertySchema || typeof propertySchema !== 'object') continue

    const nextPath = [...path, key]
    const nextRequired = parentRequired && requiredKeys.has(key)
    if (getSchemaKind(propertySchema) === 'object') {
      definitions.push(...flattenArgDefinitions(propertySchema, nextPath, nextRequired))
      continue
    }

    definitions.push({
      path: nextPath,
      cliKey: pathToCliKey(nextPath),
      envKey: pathToEnvKey(nextPath),
      schema: propertySchema,
      required: nextRequired,
    })
  }

  return definitions
}

/** Parse argv tokens into named args and raw positional strings for the executed command. */
export function parseArgTokens(
  tokens: readonly string[],
  definitions: ArgDefinition[],
): { args: Record<string, unknown>; positionals: string[] } {
  const options: ParseArgsOptionsConfig = {}
  for (const definition of definitions) {
    const schemaKind = getSchemaKind(definition.schema)
    options[definition.cliKey] =
      schemaKind === 'array'
        ? {
            type: 'string',
            multiple: true,
          }
        : {
            type: schemaKind === 'boolean' ? 'boolean' : 'string',
          }
  }

  try {
    const parsed = parseArgs({
      args: [...tokens],
      options,
      allowNegative: true,
      allowPositionals: true,
      strict: true,
    })
    const args: Record<string, unknown> = {}
    const values = parsed.values as Record<string, unknown>

    for (const definition of definitions) {
      const value = values[definition.cliKey]
      if (value === undefined) continue
      setNestedValue(args, definition.path, value)
    }

    return { args, positionals: parsed.positionals }
  } catch (error) {
    throw new ClilyError({
      kind: 'usage',
      message: error instanceof Error ? error.message : String(error),
      cause: error,
    })
  }
}

/** Resolve env-backed args by looking up every known schema path explicitly. */
export function resolveEnvArgs(
  env: Record<string, string | undefined>,
  commandPath: string[],
  definitions: ArgDefinition[],
): Record<string, unknown> {
  const prefix = toEnvPrefix(commandPath)
  const resolved: Record<string, unknown> = {}

  for (const definition of definitions) {
    const value = env[`${prefix}${definition.envKey}`]
    if (value === undefined) continue
    setNestedValue(resolved, definition.path, value)
  }

  return resolved
}
