/**
 * clily — A modern, ergonomic TypeScript CLI framework.
 *
 * Merges CLI arguments, environment variables, and config files into a
 * Single Source of Truth (SSOT) validated by Standard Schema.
 */
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ArgsDef, CommandDef, SubCommandsDef } from 'citty'
import { defineCommand, runCommand } from 'citty'
import { defu } from 'defu'
import { hasTTY, isCI } from 'std-env'

import { jsonSchemaToCittyArgs, normalizeArgs } from './args.ts'
import {
  buildCompletionTree,
  extractCompletionShellArg,
  generateCompletionScript,
  getCompletionCommandNames,
  isCompletionCommand,
  normalizeCompletionConfig,
  resolveCompletionShell,
} from './completion.ts'
import { loadClilyConfig } from './config.ts'
import { getExecutionEnvironment, resolveEnvVars } from './env.ts'
import { ClilyCommandError, toError } from './errors.ts'
import { generateChildHelp, generateHelp } from './help.ts'
import { promptForMissing } from './prompt.ts'
import { createRuntime } from './runtime.ts'
import {
  coerceTypes,
  getDefaults,
  getMissingRequired,
  toJsonSchema,
  validateSchema,
} from './schema.ts'
import type {
  ClilyChildSimple,
  ClilyHooks,
  ClilyOptions,
  ClilyRuntime,
  JsonSchema,
} from './types.ts'

export type {
  ClilyExitRequest,
  ClilyHooks,
  ClilyOptions,
  ClilyRuntime,
  CompletionConfig,
  CompletionShell,
  ExecutionEnvironment,
} from './types.ts'
export { ClilyCommandError } from './errors.ts'
export { getExecutionEnvironment } from './env.ts'
export { createRuntime } from './runtime.ts'

// ─── Internal Helpers ────────────────────────────────────

interface PreparedCommandSchemas {
  argSchema: JsonSchema | null
  cittyArgs: ArgsDef
  mergedJsonSchema: JsonSchema
  schemaDefaults: Record<string, unknown>
  schemas: StandardSchemaV1[]
}

/** Build citty ArgsDef from flags + args JSON Schemas. */
function buildArgsDef(flagSchema: JsonSchema | null, argSchema: JsonSchema | null): ArgsDef {
  return {
    ...(flagSchema ? jsonSchemaToCittyArgs(flagSchema) : {}),
    ...(argSchema ? jsonSchemaToCittyArgs(argSchema) : {}),
  }
}

/** Merge config layers in priority order: CLI > env > file config > defaults */
function mergeConfigLayers(
  cliArgs: Record<string, unknown>,
  envVars: Record<string, unknown>,
  fileConfig: Record<string, unknown>,
  schemaDefaults: Record<string, unknown>,
): Record<string, unknown> {
  return defu(cliArgs, envVars, fileConfig, schemaDefaults)
}

function prepareCommandSchemas(
  flagSchema: JsonSchema | null,
  flagSchemaSource: StandardSchemaV1 | undefined,
  argSchemaSource: StandardSchemaV1 | undefined,
): PreparedCommandSchemas {
  const argSchema = argSchemaSource ? toJsonSchema(argSchemaSource) : null

  return {
    argSchema,
    cittyArgs: buildArgsDef(flagSchema, argSchema),
    mergedJsonSchema: {
      type: 'object',
      properties: {
        ...flagSchema?.properties,
        ...argSchema?.properties,
      },
      required: [...(flagSchema?.required ?? []), ...(argSchema?.required ?? [])],
    },
    schemaDefaults: {
      ...(flagSchema ? getDefaults(flagSchema) : {}),
      ...(argSchema ? getDefaults(argSchema) : {}),
    },
    schemas: [flagSchemaSource, argSchemaSource].filter(
      (schema): schema is StandardSchemaV1 => schema !== undefined,
    ),
  }
}

function assertNoPositionalsSupport(
  commandName: string,
  config: { positionals?: unknown; children?: Record<string, unknown> },
  commandPath: string[] = [commandName],
): void {
  if (config.positionals) {
    throw new Error(
      `Positionals are not supported yet for command "${commandPath.join(' ')}". Remove the positionals schema until positional parsing is implemented.`,
    )
  }

  for (const [childName, childConfig] of Object.entries(config.children ?? {})) {
    if (typeof childConfig !== 'object' || childConfig === null) {
      continue
    }

    assertNoPositionalsSupport(commandName, childConfig as Record<string, unknown>, [
      ...commandPath,
      childName,
    ])
  }
}

function formatValidationIssue(issue: StandardSchemaV1.Issue): string {
  const path =
    issue.path?.map((seg) => (typeof seg === 'object' ? String(seg.key) : String(seg))).join('.') ??
    ''

  return `Validation error${path ? ` at "${path}"` : ''}: ${issue.message}`
}

async function emitCommandError(runtime: ClilyRuntime, error: Error): Promise<void> {
  if (error instanceof ClilyCommandError && error.issues) {
    for (const issue of error.issues) {
      await runtime.error(formatValidationIssue(issue))
    }
    return
  }

  await runtime.error(error)
}

async function handleCommandExit(
  error: Error,
  hooks: ClilyHooks | undefined,
  runtime: ClilyRuntime,
): Promise<void> {
  const request =
    error instanceof ClilyCommandError
      ? {
          code: error.code,
          error,
          reason: error.reason,
        }
      : {
          code: 1,
          error,
          reason: 'runtime-error' as const,
        }

  if (hooks?.onExit) {
    await hooks.onExit(request)
  }

  if (request.code > 0 && hooks?.onError) {
    await hooks.onError(error)
    return
  }

  if (!(error instanceof ClilyCommandError && error.silent)) {
    await emitCommandError(runtime, error)
  }

  await runtime.exit(request)
}

function resolveHelpTarget(
  rawArgs: readonly string[],
  rootName: string,
  children: Record<string, ClilyChildSimple> | undefined,
): { childConfig?: ClilyChildSimple; commandPath: string[] } {
  const commandPath = [rootName]
  let currentChildren = children
  let currentChild: ClilyChildSimple | undefined

  for (const token of rawArgs.filter((arg) => !arg.startsWith('-'))) {
    const nextChild = currentChildren?.[token]
    if (!nextChild) {
      break
    }

    currentChild = nextChild
    commandPath.push(token)
    currentChildren = nextChild.children
  }

  return { childConfig: currentChild, commandPath }
}

function resolveExecutionTarget(
  rawArgs: readonly string[],
  rootCommand: CommandDef,
): { command: CommandDef; rawArgs: string[] } {
  let currentCommand = rootCommand
  let remainingArgs = [...rawArgs]
  let currentSubCommands = rootCommand.subCommands as SubCommandsDef | undefined

  while (currentSubCommands && Object.keys(currentSubCommands).length > 0) {
    const subCommandArgIndex = remainingArgs.findIndex((arg) => !arg.startsWith('-'))
    if (subCommandArgIndex === -1) {
      break
    }

    const subCommandName = remainingArgs[subCommandArgIndex]
    const nextCommand = currentSubCommands[subCommandName]
    if (!nextCommand || typeof nextCommand !== 'object') {
      break
    }

    currentCommand = nextCommand as CommandDef
    remainingArgs = remainingArgs.filter((_, index) => index !== subCommandArgIndex)
    currentSubCommands = currentCommand.subCommands as SubCommandsDef | undefined
  }

  return { command: currentCommand, rawArgs: remainingArgs }
}

function getRawArgs(argv: readonly string[], commandName: string): string[] {
  if (argv.length <= 1) {
    return []
  }

  const entrypoint = argv[1]
  const hasScriptEntrypoint =
    entrypoint === commandName ||
    entrypoint.startsWith('file:') ||
    entrypoint.includes('/') ||
    entrypoint.includes('\\') ||
    /\.(?:[cm]?[jt]s|[jt]sx)$/.test(entrypoint)

  return argv.slice(hasScriptEntrypoint ? 2 : 1)
}

/** Handle validation failure: prompt in TTY, error in CI. */
async function handleValidationFailure(
  issues: readonly StandardSchemaV1.Issue[],
  mergedConfig: Record<string, unknown>,
  mergedSchema: JsonSchema,
  hooks?: ClilyHooks,
): Promise<Record<string, unknown> | null> {
  if (hooks?.onValidationError) {
    await hooks.onValidationError(issues)
  }

  if (hasTTY && !isCI) {
    const missingKeys = getMissingRequired(mergedSchema, mergedConfig)
    if (missingKeys.length > 0) {
      if (hooks?.onPromptSelect) {
        await hooks.onPromptSelect(missingKeys)
      }
      const prompted = await promptForMissing(missingKeys, mergedSchema)
      return { ...mergedConfig, ...prompted }
    }
    return null
  } else {
    return null
  }
}

/** Resolve, validate, and execute a command handler. */
async function resolveAndRun(
  name: string,
  parsedArgs: Record<string, unknown>,
  schemas: StandardSchemaV1[],
  mergedJsonSchema: JsonSchema,
  schemaDefaults: Record<string, unknown>,
  hooks: ClilyHooks | undefined,
  runtime: ClilyRuntime,
  debug: boolean,
  handler?: (args: Record<string, unknown>) => void | Promise<void>,
): Promise<void> {
  const cliArgs = normalizeArgs(parsedArgs)
  const envVars = resolveEnvVars(name, runtime.env)
  const fileConfig = await loadClilyConfig({ name, cwd: runtime.cwd() })

  let mergedConfig = mergeConfigLayers(cliArgs, envVars, fileConfig, schemaDefaults)
  mergedConfig = coerceTypes(mergedConfig, mergedJsonSchema)

  if (hooks?.onValidate) {
    await hooks.onValidate(mergedConfig)
  }

  // Validate against each schema
  for (const schema of schemas) {
    const result = await validateSchema(schema, mergedConfig)
    if (!result.success) {
      const fixed = await handleValidationFailure(
        result.issues,
        mergedConfig,
        mergedJsonSchema,
        hooks,
      )
      if (!fixed) {
        throw new ClilyCommandError({
          code: 1,
          reason: 'validation',
          message: 'Validation failed.',
          issues: result.issues,
        })
      }
      mergedConfig = coerceTypes(fixed, mergedJsonSchema)

      // Re-validate
      const reResult = await validateSchema(schema, mergedConfig)
      if (!reResult.success) {
        throw new ClilyCommandError({
          code: 1,
          reason: 'validation',
          message: 'Validation failed after prompting for missing values.',
          issues: reResult.issues,
        })
      }
    }
  }

  if (debug) {
    await runtime.debug('Resolved config:', mergedConfig)
  }

  if (handler) {
    await handler(mergedConfig)
  }
}

// ─── Subcommand Builder ──────────────────────────────────

function buildSubCommand(
  cmdName: string,
  childConfig: ClilyChildSimple,
  rootName: string,
  rootFlagsSchema: JsonSchema | null,
  rootFlags: StandardSchemaV1 | undefined,
  rootHooks: ClilyHooks | undefined,
  runtime: ClilyRuntime,
  debug: boolean,
): CommandDef {
  const { cittyArgs, mergedJsonSchema, schemaDefaults, schemas } = prepareCommandSchemas(
    rootFlagsSchema,
    rootFlags,
    childConfig.args,
  )

  // Build nested subcommands
  const subCommands: SubCommandsDef | undefined = childConfig.children
    ? Object.fromEntries(
        Object.entries(childConfig.children as Record<string, ClilyChildSimple>).map(
          ([subName, subConfig]) => [
            subName,
            buildSubCommand(
              subName,
              subConfig,
              rootName,
              rootFlagsSchema,
              rootFlags,
              rootHooks,
              runtime,
              debug,
            ),
          ],
        ),
      )
    : undefined

  return defineCommand({
    meta: { name: cmdName, description: childConfig.description },
    args: cittyArgs,
    subCommands,
    run: async ({ args: parsedArgs }) => {
      if ((parsedArgs as Record<string, unknown>)['help']) {
        const helpText = generateChildHelp(childConfig, rootFlagsSchema, [rootName, cmdName])
        const mutated = childConfig.hooks?.onHelp
          ? await childConfig.hooks.onHelp(helpText)
          : rootHooks?.onHelp
            ? await rootHooks.onHelp(helpText)
            : undefined
        await runtime.stdout(typeof mutated === 'string' ? mutated : helpText)
        return
      }

      await resolveAndRun(
        rootName,
        parsedArgs as unknown as Record<string, unknown>,
        schemas,
        mergedJsonSchema,
        schemaDefaults,
        childConfig.hooks ?? rootHooks,
        runtime,
        debug,
        childConfig.handler as
          | ((args: Record<string, unknown>) => void | Promise<void>)
          | undefined,
      )
    },
  })
}

// ─── Main API ────────────────────────────────────────────

/**
 * Create a clily CLI instance.
 *
 * The function signature uses advanced generics to ensure end-to-end type safety:
 * - Root handler receives the merged output of `flags` & `args` schemas.
 * - Each child handler receives merged parent `flags` & child `args` schemas.
 *
 * @example
 * ```ts
 * import { clily } from '@clily/core'
 * import * as v from 'valibot'
 *
 * const cli = clily({
 *   name: 'mycli',
 *   flags: v.object({ verbose: v.optional(v.boolean(), false) }),
 *   children: {
 *     deploy: {
 *       args: v.object({ apiKey: v.string() }),
 *       handler: async (args) => {
 *         // args.verbose: boolean  (from flags)
 *         // args.apiKey: string    (from child args)
 *       },
 *     },
 *   },
 * })
 * await cli()
 * ```
 */
export function clily<
  TFlags extends StandardSchemaV1 | undefined = undefined,
  TArgs extends StandardSchemaV1 | undefined = undefined,
  const TChildren extends Record<string, { args?: StandardSchemaV1 }> = Record<never, never>,
>(config: ClilyOptions<TFlags, TArgs, TChildren>): () => Promise<void> {
  assertNoPositionalsSupport(config.name, config)

  const runtime = createRuntime(config.runtime)
  const environment = getExecutionEnvironment(runtime.env)
  const debug = config.debug ?? environment.isDebug
  const completionConfig = normalizeCompletionConfig(config.completion)
  const completionCommandNames = getCompletionCommandNames(config.completion).filter(
    (name) => !(config.children && name in config.children),
  )
  const flagSchema = config.flags ? toJsonSchema(config.flags) : null
  const { cittyArgs, mergedJsonSchema, schemaDefaults, schemas } = prepareCommandSchemas(
    flagSchema,
    config.flags,
    config.args,
  )

  // Build subcommands from children
  const subCommands: SubCommandsDef | undefined = config.children
    ? Object.fromEntries(
        Object.entries(config.children as Record<string, ClilyChildSimple>).map(
          ([name, childConfig]) => [
            name,
            buildSubCommand(
              name,
              childConfig,
              config.name,
              flagSchema,
              config.flags,
              config.hooks,
              runtime,
              debug,
            ),
          ],
        ),
      )
    : undefined

  const helpChildren: Record<string, { description?: string }> = {
    ...(config.children as Record<string, { description?: string }> | undefined),
  }
  if (completionConfig) {
    for (const name of completionCommandNames) {
      helpChildren[name] = {
        description: 'Generate shell completion for bash, zsh, fish, or pwsh',
      }
    }
  }

  const rootCommand = defineCommand({
    meta: {
      name: config.name,
      version: config.version,
      description: config.description,
    },
    args: cittyArgs,
    subCommands,
    run: async ({ rawArgs, args: parsedArgs }) => {
      if (config.hooks?.onParse) {
        await config.hooks.onParse(rawArgs)
      }

      if ((parsedArgs as Record<string, unknown>)['help'] || !config.handler) {
        const helpText = generateHelp({
          ...config,
          children: helpChildren,
        } as Parameters<typeof generateHelp>[0])
        const mutated = config.hooks?.onHelp ? await config.hooks.onHelp(helpText) : undefined
        await runtime.stdout(typeof mutated === 'string' ? mutated : helpText)
        return
      }

      await resolveAndRun(
        config.name,
        parsedArgs as unknown as Record<string, unknown>,
        schemas,
        mergedJsonSchema,
        schemaDefaults,
        config.hooks,
        runtime,
        debug,
        config.handler as ((args: Record<string, unknown>) => void | Promise<void>) | undefined,
      )
    },
  })

  return async () => {
    try {
      const rawArgs = getRawArgs(runtime.argv, config.name)

      if (completionConfig && isCompletionCommand(rawArgs, completionCommandNames)) {
        const shell = resolveCompletionShell(
          extractCompletionShellArg(rawArgs, completionCommandNames),
          completionConfig,
          environment,
        )
        const script = generateCompletionScript(
          config.name,
          buildCompletionTree({
            flags: config.flags,
            args: config.args,
            children: config.children as
              | Record<
                  string,
                  {
                    description?: string
                    args?: StandardSchemaV1
                    children?: Record<string, unknown>
                    handler?: (...args: unknown[]) => unknown
                  }
                >
              | undefined,
            completion: config.completion,
          }),
          shell,
        )
        await runtime.stdout(script)
        return
      }

      if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
        const { childConfig, commandPath } = resolveHelpTarget(
          rawArgs,
          config.name,
          config.children as Record<string, ClilyChildSimple> | undefined,
        )
        const helpText = childConfig
          ? generateChildHelp(childConfig, flagSchema, commandPath)
          : generateHelp({
              ...config,
              children: helpChildren,
            } as Parameters<typeof generateHelp>[0])

        const mutated = childConfig?.hooks?.onHelp
          ? await childConfig.hooks.onHelp(helpText)
          : config.hooks?.onHelp
            ? await config.hooks.onHelp(helpText)
            : undefined

        await runtime.stdout(typeof mutated === 'string' ? mutated : helpText)
        return
      }

      if (rawArgs.length === 1 && rawArgs[0] === '--version') {
        if (!config.version) {
          throw new Error('No version specified')
        }

        await runtime.stdout(config.version)
        return
      }

      const executionTarget = resolveExecutionTarget(rawArgs, rootCommand)

      await runCommand(executionTarget.command, { rawArgs: executionTarget.rawArgs })
    } catch (err) {
      await handleCommandExit(toError(err), config.hooks, runtime)
    }
  }
}
