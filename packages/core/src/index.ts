import type { StandardSchemaV1 } from '@standard-schema/spec'

import {
  getCompletionCommandNames,
  normalizeCompletionConfig,
  renderCompletionPlaceholder,
} from './completion.ts'
import { ClilyError, toError } from './errors.ts'
import { renderHelp } from './help.ts'
import { createDefaultLogger } from './logger.ts'
import { buildCommandTree, hasCommandNameConflict, resolveCommandSubtree } from './tree.ts'
import type {
  AnyClilyRootCommand,
  ClilyArgsSchema,
  ClilyCommand,
  ClilyCommandContext,
  ClilyCommandMeta,
  ClilyLogger,
  ClilyPlugin,
  ClilyPositionalSchema,
  ClilyRootCommand,
  ClilySchema,
  CompletionConfig,
} from './types.ts'
import { executeCommandNode, resolveCommandInput } from './workflow.ts'

export type {
  ClilyCommand,
  ClilyCommandContext,
  ClilyCommandMeta,
  ClilyLogger,
  ClilyPlugin,
  ClilyRootCommand,
  CompletionConfig,
} from './types.ts'
export { ClilyError } from './errors.ts'

const isInteractive = (): boolean =>
  process.stdin.isTTY && process.stdout.isTTY ? process.env.CI !== 'true' : false

const writeOutput = (message: string): void => {
  console.log(message)
}

const formatIssuePath = (issue: StandardSchemaV1.Issue): string =>
  issue.path
    ?.map((segment) => (typeof segment === 'object' ? String(segment.key) : String(segment)))
    .join('.') ?? ''

const printError = (logger: ClilyLogger, error: Error): void => {
  if (error instanceof ClilyError && error.issues) {
    for (const issue of error.issues) {
      const path = formatIssuePath(issue)
      logger.error(`Validation error${path ? ` at "${path}"` : ''}: ${issue.message}`)
    }
    return
  }

  logger.error(error.message)
}

/** Create a clily runner from a citty-shaped command tree backed by Standard JSON Schema. */
export function clily<
  TPositionals extends ClilyPositionalSchema | undefined = undefined,
  const TSubCommands extends Record<string, unknown> = Record<never, never>,
>(
  command: Omit<ClilyRootCommand<undefined, TPositionals, TSubCommands>, 'args'> & {
    args?: undefined
  },
): () => Promise<void>
export function clily<
  TArgs extends ClilyArgsSchema,
  TPositionals extends ClilyPositionalSchema | undefined = undefined,
  const TSubCommands extends Record<string, unknown> = Record<never, never>,
>(command: ClilyRootCommand<TArgs, TPositionals, TSubCommands>): () => Promise<void>
export function clily<
  TArgs extends ClilyArgsSchema | undefined,
  TPositionals extends ClilyPositionalSchema | undefined,
  const TSubCommands extends Record<string, unknown>,
>(command: ClilyRootCommand<TArgs, TPositionals, TSubCommands>): () => Promise<void> {
  const runtimeCommand = command as unknown as AnyClilyRootCommand
  const logger = command.logger ?? createDefaultLogger(command.name)
  const tree = buildCommandTree(runtimeCommand)
  const completionConfig = normalizeCompletionConfig(command.completion)
  const completionCommandNames = completionConfig
    ? getCompletionCommandNames(command.completion)
    : []
  const completionAvailable =
    completionConfig !== null && !hasCommandNameConflict(tree.root, completionCommandNames)

  return async () => {
    try {
      const rawArgs = process.argv.slice(2)

      if (
        completionAvailable &&
        rawArgs.length > 0 &&
        completionCommandNames.includes(rawArgs[0])
      ) {
        writeOutput(renderCompletionPlaceholder(tree, rawArgs[1]))
        return
      }

      if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
        const target = resolveCommandSubtree(
          tree,
          rawArgs.filter((token) => token !== '--help' && token !== '-h'),
        )
        writeOutput(
          renderHelp(tree, target.node, { includeCompletionCommand: completionAvailable }),
        )
        return
      }

      if (rawArgs.length === 1 && (rawArgs[0] === '--version' || rawArgs[0] === '-v')) {
        if (!tree.root.meta.version)
          throw new ClilyError({ kind: 'usage', message: 'No version specified.' })
        writeOutput(tree.root.meta.version)
        return
      }

      const target = resolveCommandSubtree(tree, rawArgs)
      if (!target.node.command.run) {
        writeOutput(
          renderHelp(tree, target.node, { includeCompletionCommand: completionAvailable }),
        )
        return
      }

      const resolvedInput = await resolveCommandInput({
        node: target.node,
        rawArgs: target.remainingTokens,
        env: process.env,
        cwd: process.cwd(),
        interactive: isInteractive(),
        logger,
      })
      await executeCommandNode({
        node: target.node,
        rawArgs: target.remainingTokens,
        resolvedInput,
        logger,
      })
    } catch (error) {
      const normalized = toError(error)
      const exitCode = normalized instanceof ClilyError ? normalized.exitCode : 1
      if (!(normalized instanceof ClilyError && normalized.silent)) printError(logger, normalized)
      process.exitCode = exitCode
    }
  }
}

export namespace clily {
  /** Preserve contextual typing for nested command definitions without manual generics. */
  export function command<
    TPositionals extends ClilyPositionalSchema | undefined = undefined,
    const TSubCommands extends Record<string, unknown> = Record<never, never>,
  >(
    command: Omit<ClilyCommand<undefined, TPositionals, TSubCommands>, 'args'> & {
      args?: undefined
    },
  ): ClilyCommand<undefined, TPositionals, TSubCommands>
  export function command<
    TArgs extends ClilyArgsSchema,
    TPositionals extends ClilyPositionalSchema | undefined = undefined,
    const TSubCommands extends Record<string, unknown> = Record<never, never>,
  >(
    command: ClilyCommand<TArgs, TPositionals, TSubCommands>,
  ): ClilyCommand<TArgs, TPositionals, TSubCommands>
  export function command<
    TArgs extends ClilyArgsSchema | undefined,
    TPositionals extends ClilyPositionalSchema | undefined,
    const TSubCommands extends Record<string, unknown>,
  >(
    command: ClilyCommand<TArgs, TPositionals, TSubCommands>,
  ): ClilyCommand<TArgs, TPositionals, TSubCommands> {
    return command
  }

  export type Schema<Input = unknown, Output = Input> = ClilySchema<Input, Output>
  export type ArgsSchema = ClilyArgsSchema
  export type PositionalSchema = ClilyPositionalSchema
  export type Command<
    TArgs extends ClilyArgsSchema | undefined = undefined,
    TPositionals extends ClilyPositionalSchema | undefined = undefined,
    TSubCommands extends Record<string, unknown> = Record<never, never>,
  > = ClilyCommand<TArgs, TPositionals, TSubCommands>
  export type RootCommand<
    TArgs extends ClilyArgsSchema | undefined = undefined,
    TPositionals extends ClilyPositionalSchema | undefined = undefined,
    TSubCommands extends Record<string, unknown> = Record<never, never>,
  > = ClilyRootCommand<TArgs, TPositionals, TSubCommands>
  export type CommandContext<
    TArgs extends ClilyArgsSchema | undefined = undefined,
    TPositionals extends ClilyPositionalSchema | undefined = undefined,
  > = ClilyCommandContext<TArgs, TPositionals>
  export type CommandMeta = ClilyCommandMeta
  export type Logger = ClilyLogger
  export type Plugin<
    TArgs extends ClilyArgsSchema | undefined = undefined,
    TPositionals extends ClilyPositionalSchema | undefined = undefined,
  > = ClilyPlugin<TArgs, TPositionals>
  export type Completion = CompletionConfig
}

export default clily
