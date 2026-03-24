import type { StandardSchemaV1 } from '@standard-schema/spec'

/**
 * Lifecycle hooks for clily CLI.
 */
export interface ClilyHooks {
  onParse?: (rawArgs: string[]) => void | Promise<void>
  onValidate?: (resolvedConfig: Record<string, unknown>) => void | Promise<void>
  onError?: (err: Error) => void | Promise<void>
  onValidationError?: (issues: readonly StandardSchemaV1.Issue[]) => void | Promise<void>
  onPromptSelect?: (missingKeys: string[]) => void | Promise<void>
  onHelp?: (helpText: string) => string | void | Promise<string | void>
}

/**
 * Configuration for a child (sub) command.
 */
export interface ClilyChildConfig {
  description?: string
  args?: StandardSchemaV1
  positionals?: StandardSchemaV1
  hooks?: ClilyHooks
  handler?: (args: Record<string, unknown>) => void | Promise<void>
  children?: Record<string, ClilyChildConfig>
}

/**
 * Root configuration for the clily CLI framework.
 */
export interface ClilyConfig {
  name: string
  version?: string
  description?: string
  debug?: boolean
  flags?: StandardSchemaV1
  args?: StandardSchemaV1
  positionals?: StandardSchemaV1
  plugins?: unknown[]
  hooks?: ClilyHooks
  handler?: (args: Record<string, unknown>, ...positionals: unknown[]) => void | Promise<void>
  children?: Record<string, ClilyChildConfig>
}

/**
 * Schema entry metadata extracted from Standard Schema introspection.
 */
export interface SchemaEntry {
  key: string
  type: 'string' | 'boolean' | 'number' | 'unknown'
  required: boolean
  default?: unknown
  description?: string
}
