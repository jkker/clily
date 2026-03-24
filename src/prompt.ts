/**
 * Interactive prompt fallback for clily.
 *
 * When required schema fields are missing and the terminal is interactive (TTY),
 * prompts the user via @clack/prompts instead of exiting with an error.
 */
import * as p from '@clack/prompts'

import type { SchemaEntry } from './types.ts'

/**
 * Prompt the user for missing required fields using @clack/prompts.
 * Returns an object with the user-provided values.
 */
export async function promptForMissing(
  missingKeys: string[],
  entries: SchemaEntry[],
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}
  const entryMap = new Map(entries.map((e) => [e.key, e]))

  p.intro('Missing required config.')

  for (const key of missingKeys) {
    const entry = entryMap.get(key)
    const label = entry?.description ?? `Enter ${key}`

    if (entry?.type === 'boolean') {
      const value = await p.confirm({ message: label })
      if (p.isCancel(value)) {
        p.cancel('Operation cancelled.')
        process.exit(0)
      }
      result[key] = value
    } else {
      const value = await p.text({
        message: label,
        placeholder: entry?.description,
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
