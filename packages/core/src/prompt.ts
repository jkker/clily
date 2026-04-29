import * as p from '@clack/prompts'
import type { JSONSchema7 } from 'json-schema'

import { getNestedValue, pathToCliKey, setNestedValue } from './args.ts'
import { ClilyError } from './errors.ts'
import { coerceValue, getSchemaKind } from './schema.ts'

/** Prompt descriptor for a missing or invalid named arg. */
export interface PromptEntry {
  /** Nested arg path that should be prompted. */
  path: string[]

  /** Schema used to render and parse the prompt. */
  schema: JSONSchema7

  /** Optional validation reason shown to the user. */
  reason?: string
}

const isArrayItemSchema = (schema: JSONSchema7): schema is JSONSchema7 & { items: JSONSchema7 } =>
  !!schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)

const formatChoice = (value: unknown): string => {
  if (typeof value === 'string') return value
  const serialized = JSON.stringify(value)
  return serialized ?? ''
}

const toPromptLabel = (schema: JSONSchema7, path?: string[]): string => {
  if (schema.description) return schema.description
  if (!path || path.length === 0) return 'Enter a value'
  return `Enter ${pathToCliKey(path)}`
}

const toPromptMessage = (schema: JSONSchema7, path?: string[], reason?: string): string => {
  const label = toPromptLabel(schema, path)
  return reason ? `${label} (${reason})` : label
}

const toPromptPlaceholder = (schema: JSONSchema7): string | undefined => {
  if (schema.default !== undefined) return `Default: ${JSON.stringify(schema.default)}`
  if (Array.isArray(schema.enum) && schema.enum.length > 0)
    return `One of: ${schema.enum.map(formatChoice).join(', ')}`
  if (getSchemaKind(schema) === 'array') return 'Comma-separated values'
  return undefined
}

const promptForText = async (message: string, schema: JSONSchema7): Promise<unknown> => {
  const value = await p.text({
    message,
    placeholder: toPromptPlaceholder(schema),
    defaultValue:
      typeof schema.default === 'string' || typeof schema.default === 'number'
        ? String(schema.default)
        : undefined,
  })

  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.')
    throw new ClilyError({
      kind: 'cancelled',
      message: 'Operation cancelled.',
      silent: true,
    })
  }

  return coerceValue(value, schema)
}

const promptForSchemaValue = async (
  schema: JSONSchema7,
  message: string,
  currentValue?: unknown,
): Promise<unknown> => {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const selected = await p.select({
      message,
      options: schema.enum.map((value) => ({ label: formatChoice(value), value })),
      initialValue: currentValue,
    })
    if (p.isCancel(selected)) {
      p.cancel('Operation cancelled.')
      throw new ClilyError({
        kind: 'cancelled',
        message: 'Operation cancelled.',
        silent: true,
      })
    }
    return selected
  }

  if (
    getSchemaKind(schema) === 'array' &&
    isArrayItemSchema(schema) &&
    Array.isArray(schema.items.enum)
  ) {
    const selected = await p.multiselect({
      message,
      options: schema.items.enum.map((value) => ({ label: formatChoice(value), value })),
      initialValues: Array.isArray(currentValue) ? currentValue : undefined,
    })
    if (p.isCancel(selected)) {
      p.cancel('Operation cancelled.')
      throw new ClilyError({
        kind: 'cancelled',
        message: 'Operation cancelled.',
        silent: true,
      })
    }
    return selected
  }

  if (getSchemaKind(schema) === 'boolean') {
    const selected = await p.confirm({
      message,
      initialValue: typeof currentValue === 'boolean' ? currentValue : schema.default === true,
    })
    if (p.isCancel(selected)) {
      p.cancel('Operation cancelled.')
      throw new ClilyError({
        kind: 'cancelled',
        message: 'Operation cancelled.',
        silent: true,
      })
    }
    return selected
  }

  return promptForText(message, schema)
}

/** Prompt for missing or invalid command input using JSON Schema metadata. */
export async function promptForCommandInput(options: {
  args: Record<string, unknown>
  argEntries?: PromptEntry[]
  positionalsSchema?: JSONSchema7
  positionals: unknown
  promptPositionals?: boolean
  positionalReason?: string
}): Promise<{ args: Record<string, unknown>; positionals: unknown }> {
  const nextArgs = { ...options.args }
  let nextPositionals = options.positionals
  const argEntries = options.argEntries ?? []
  const needsPositionals =
    options.promptPositionals === true && options.positionalsSchema !== undefined

  if (argEntries.length === 0 && !needsPositionals)
    return { args: nextArgs, positionals: nextPositionals }

  p.intro('Additional input required.')

  for (const entry of argEntries) {
    const currentValue = getNestedValue(nextArgs, entry.path)
    const prompted = await promptForSchemaValue(
      entry.schema,
      toPromptMessage(entry.schema, entry.path, entry.reason),
      currentValue,
    )
    setNestedValue(nextArgs, entry.path, prompted)
  }

  if (needsPositionals && options.positionalsSchema) {
    nextPositionals = await promptForSchemaValue(
      options.positionalsSchema,
      toPromptMessage(options.positionalsSchema, undefined, options.positionalReason),
      nextPositionals,
    )
  }

  p.outro('Input complete.')
  return { args: nextArgs, positionals: nextPositionals }
}
