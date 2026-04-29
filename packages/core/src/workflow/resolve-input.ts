import type { StandardSchemaV1 } from '@standard-schema/spec'
import { defu } from 'defu'

import { ClilyError } from '../errors.ts'
import { promptForCommandInput } from '../prompt.ts'
import { coerceObjectValue, coerceValue } from '../schema.ts'
import type { ClilyCommandNode } from '../tree.ts'
import type { ClilyLogger } from '../types.ts'
import { getArgPromptEntries, type ValidationResult, validateInput } from '../validate.ts'
import { parseCommandInput } from './parse.ts'
import type { CommandInputLayer, ResolvedCommandInput } from './types.ts'

const shouldPromptPositionals = (
  positionalsSchema: unknown,
  positionals: unknown,
  validation: ValidationResult<unknown>,
): boolean =>
  positionalsSchema !== undefined &&
  (positionals === undefined ||
    positionals === null ||
    (Array.isArray(positionals) && positionals.length === 0) ||
    !validation.success)

const validateResolvedArgs = (
  node: ClilyCommandNode,
  value: Record<string, unknown>,
): ValidationResult<Record<string, unknown>> =>
  node.command.args ? validateInput(node.command.args, value) : { success: true, value }

const validateResolvedPositionals = (
  node: ClilyCommandNode,
  value: unknown,
): ValidationResult<unknown> =>
  node.command.positionals
    ? validateInput(node.command.positionals, value)
    : { success: true, value }

const getFirstIssueMessage = (
  issues: readonly StandardSchemaV1.Issue[] | undefined,
): string | undefined => issues?.[0]?.message

/** Resolve and validate command input before executing the command. */
export async function resolveCommandInput(options: {
  node: ClilyCommandNode
  rawArgs: string[]
  env?: Record<string, string | undefined>
  cwd?: string
  config?: Record<string, unknown>
  interactive?: boolean
  logger: ClilyLogger
}): Promise<ResolvedCommandInput> {
  const parsed = await parseCommandInput(options)

  let args = parsed.args
  let positionals = parsed.positionals
  let promptLayer: CommandInputLayer | undefined
  let argsValidation = validateResolvedArgs(options.node, args)
  let positionalValidation = validateResolvedPositionals(options.node, positionals)

  while (options.interactive) {
    const promptEntries = getArgPromptEntries({
      schema: parsed.argsSchema,
      value: args,
      validation: argsValidation,
    })
    const promptPositionals = shouldPromptPositionals(
      parsed.positionalsSchema,
      positionals,
      positionalValidation,
    )

    if (promptEntries.length === 0 && !promptPositionals) break

    const prompted = await promptForCommandInput({
      args,
      argEntries: promptEntries,
      positionals,
      positionalsSchema: parsed.positionalsSchema,
      promptPositionals,
      positionalReason: positionalValidation.success
        ? undefined
        : getFirstIssueMessage(positionalValidation.issues),
    })

    promptLayer = {
      name: 'prompt',
      value: defu(prompted.args, promptLayer?.value ?? {}),
    }
    args = parsed.argsSchema ? coerceObjectValue(defu(prompted.args, args), parsed.argsSchema) : {}
    positionals = parsed.positionalsSchema
      ? coerceValue(prompted.positionals, parsed.positionalsSchema)
      : undefined
    argsValidation = validateResolvedArgs(options.node, args)
    positionalValidation = validateResolvedPositionals(options.node, positionals)
  }

  if (!argsValidation.success) {
    throw new ClilyError({
      kind: 'validation',
      message: `Validation failed for ${options.node.path.join(' ')}.`,
      issues: argsValidation.issues,
    })
  }

  if (!positionalValidation.success) {
    throw new ClilyError({
      kind: 'validation',
      message: `Validation failed for positional input of ${options.node.path.join(' ')}.`,
      issues: positionalValidation.issues,
    })
  }

  return {
    args: argsValidation.value,
    positionals: positionalValidation.value,
    positionalTokens: parsed.positionalTokens,
    layers: {
      ...parsed.layers,
      prompt: promptLayer,
    },
  }
}
