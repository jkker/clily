/**
 * CLI argument parsing utilities for clily.
 *
 * Converts Standard Schema metadata to citty arg definitions and parses argv.
 */
import type { ArgsDef } from 'citty'

import type { SchemaEntry } from './types.ts'

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
 * Convert schema entries to citty ArgsDef format.
 */
export function schemaToCittyArgs(entries: SchemaEntry[]): ArgsDef {
  const argsDef: ArgsDef = {}

  for (const entry of entries) {
    const kebabKey = camelToKebab(entry.key)
    if (entry.type === 'boolean') {
      argsDef[kebabKey] = {
        type: 'boolean',
        description: entry.description ?? '',
        required: false,
        default: entry.default as boolean | undefined,
      }
    } else {
      argsDef[kebabKey] = {
        type: 'string',
        description: entry.description ?? '',
        required: false,
        default: entry.default as string | undefined,
      }
    }
  }

  return argsDef
}

/**
 * Parse raw argv into a flat object, converting kebab-case keys to camelCase.
 * Strips undefined values.
 */
export function normalizeArgs(parsed: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined || key === '_') continue
    const camelKey = kebabToCamel(key)
    result[camelKey] = value
  }

  return result
}
