/**
 * Interactive prompt fallback for clily.
 *
 * When required fields are missing in a TTY environment,
 * prompts the user via @clack/prompts instead of exiting with an error.
 */
import * as p from '@clack/prompts'

import type { JsonSchema } from './types.ts'

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
        process.exit(0)
      }
      result[key] = value
    } else {
      const value = await p.text({
        message: label,
        placeholder: prop?.description,
      })
      if (p.isCancel(value)) {
        p.cancel('Operation cancelled.')
        process.exit(0)
      }
      result[key] = value
    }
  }

  p.outro('Configuration complete.')
  return result
}
