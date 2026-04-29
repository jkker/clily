import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { JSONSchema7 } from 'json-schema'

import type { PromptEntry } from './prompt.ts'
import { findMissingObjectLeaves, getSchemaAtPath } from './schema.ts'
import type { ClilySchema } from './types.ts'

export type ValidationResult<T> =
  | { success: true; value: T; issues?: undefined }
  | { success: false; issues: readonly StandardSchemaV1.Issue[]; value?: undefined }

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  if (typeof value !== 'object' || value === null) return false
  return 'then' in value && typeof value.then === 'function'
}

const trimArrayIndexes = (path: string[]): string[] => {
  const normalizedPath = [...path]
  while (normalizedPath.length > 0 && /^\d+$/.test(normalizedPath.at(-1) ?? ''))
    normalizedPath.pop()
  return normalizedPath
}

const toIssuePath = (issue: StandardSchemaV1.Issue): string[] => {
  const path =
    issue.path?.map((segment) =>
      typeof segment === 'object' && segment !== null ? String(segment.key) : String(segment),
    ) ?? []

  return trimArrayIndexes(path)
}

const toPromptEntries = (
  schema: JSONSchema7 | undefined,
  issues: readonly StandardSchemaV1.Issue[] | undefined,
): PromptEntry[] => {
  if (!schema || !issues) return []

  const entries: PromptEntry[] = []
  const seen = new Set<string>()

  for (const issue of issues) {
    const path = toIssuePath(issue)
    if (path.length === 0) continue

    const key = path.join('\0')
    if (seen.has(key)) continue

    const issueSchema = getSchemaAtPath(schema, path)
    if (!issueSchema) continue

    seen.add(key)
    entries.push({
      path,
      schema: issueSchema,
      reason: issue.message,
    })
  }

  return entries
}

const mergePromptEntries = (
  missingEntries: PromptEntry[],
  invalidEntries: PromptEntry[],
): PromptEntry[] => {
  const entries = new Map<string, PromptEntry>()

  for (const entry of missingEntries) entries.set(entry.path.join('\0'), entry)
  for (const entry of invalidEntries) entries.set(entry.path.join('\0'), entry)

  return [...entries.values()]
}

export function validateInput<T>(
  schema: ClilySchema<unknown, T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema['~standard'].validate(data)
  if (isPromiseLike(result)) throw new TypeError('Schema validation must be synchronous')
  if (result.issues) return { success: false, issues: result.issues }

  return { success: true, value: result.value }
}

export function getArgPromptEntries(options: {
  schema: JSONSchema7 | undefined
  value: Record<string, unknown>
  validation: ValidationResult<Record<string, unknown>>
}): PromptEntry[] {
  if (!options.schema) return []

  const missingEntries = findMissingObjectLeaves(options.schema, options.value).map((entry) => ({
    path: entry.path,
    schema: entry.schema,
  }))
  const invalidEntries = options.validation.success
    ? []
    : toPromptEntries(options.schema, options.validation.issues)

  return mergePromptEntries(missingEntries, invalidEntries)
}
