/**
 * CLI argument parsing utilities for clily.
 *
 * Converts JSON Schema metadata to citty arg definitions and normalizes argv.
 */
import type { ArgsDef } from 'citty'

import type { JsonSchema } from './types.ts'

/**
 * Convert a camelCase key to a kebab-case CLI flag.
 * e.g., 'apiKey' → 'api-key', 'dryRun' → 'dry-run'
 */
export function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/**
 * Convert a kebab-case CLI flag to camelCase.
 * e.g., 'api-key' → 'apiKey', 'dry-run' → 'dryRun'
 */
export function kebabToCamel(key: string): string {
  return key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Convert a dot-separated key to a nested object path.
 * e.g., 'config.server' with value 'localhost' → { config: { server: 'localhost' } }
 */
export function setNestedValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

/**
 * Convert a JSON Schema to citty ArgsDef format.
 * Handles nested properties via dot-notation keys.
 */
export function jsonSchemaToCittyArgs(schema: JsonSchema, prefix = ''): ArgsDef {
  const argsDef: ArgsDef = {}

  for (const [key, prop] of Object.entries(schema.properties)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const cliKey = camelToKebab(fullKey)

    // Recurse for nested object properties
    if (prop.type === 'object' && prop.properties && Object.keys(prop.properties).length > 0) {
      const nested = jsonSchemaToCittyArgs(
        {
          type: 'object',
          properties: prop.properties,
          required: prop.required ?? [],
        },
        fullKey,
      )
      Object.assign(argsDef, nested)
      continue
    }

    if (prop.type === 'boolean') {
      argsDef[cliKey] = {
        type: 'boolean',
        description: prop.description ?? '',
        required: false,
        default: prop.default as boolean | undefined,
      }
    } else {
      argsDef[cliKey] = {
        type: 'string',
        description: prop.description ?? '',
        required: false,
        default: prop.default as string | undefined,
      }
    }
  }

  return argsDef
}

/**
 * Parse raw argv into a flat object, converting kebab-case keys to camelCase.
 * Supports dot-notation for nested values.
 */
export function normalizeArgs(parsed: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined || key === '_') continue
    const camelKey = kebabToCamel(key)
    if (camelKey.includes('.')) {
      setNestedValue(result, camelKey, value)
    } else {
      result[camelKey] = value
    }
  }

  return result
}
