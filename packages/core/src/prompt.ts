/**
 * Interactive prompt fallback for clily.
 *
 * When required fields are missing in a TTY environment,
 * prompts the user via @clack/prompts instead of exiting with an error.
 */
import * as p from '@clack/prompts'

import { ClilyCommandError } from './errors.ts'
import type { JsonSchema } from './types.ts'

function getPromptPlaceholder(key: string, schema: JsonSchema): string | undefined {
  const prop = schema.properties[key]
  if (!prop) {
    return undefined
  }
  if (prop.default !== undefined) {
    return `Default: ${JSON.stringify(prop.default)}`
  }
  if (prop.enum && prop.enum.length > 0) {
    return `One of: ${prop.enum.map((value) => String(value)).join(', ')}`
  }
  return undefined
}

/**
 * Prompt the user for missing required fields using @clack/prompts.
 * Uses JSON Schema property metadata for labels and types.
 */
export async function promptForMissing(
  missingKeys: string[],
  schema: JsonSchema,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}

  p.intro('Missing required config.')

  for (const key of missingKeys) {
    const prop = schema.properties[key]
    const label = prop?.description ?? `Enter ${key}`

    if (prop?.type === 'boolean') {
      const value = await p.confirm({ message: label })
      if (p.isCancel(value)) {
        p.cancel('Operation cancelled.')
        throw new ClilyCommandError({
          code: 0,
          reason: 'cancelled',
          message: 'Operation cancelled.',
          silent: true,
        })
      }
      result[key] = value
    } else {
      const value = await p.text({
        message: label,
        placeholder: getPromptPlaceholder(key, schema),
      })
      if (p.isCancel(value)) {
        p.cancel('Operation cancelled.')
        throw new ClilyCommandError({
          code: 0,
          reason: 'cancelled',
          message: 'Operation cancelled.',
          silent: true,
        })
      }
      result[key] = value
    }
  }

  p.outro('Configuration complete.')
  return result
}
