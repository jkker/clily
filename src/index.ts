/**
 * clily — A modern, ergonomic TypeScript CLI framework.
 *
 * Merges CLI arguments, environment variables, and config files into a
 * Single Source of Truth (SSOT) validated by Standard Schema.
 */
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ArgsDef, CommandDef, SubCommandsDef } from 'citty'
import { defineCommand, runMain } from 'citty'
import consola from 'consola'
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
import { generateChildHelp, generateHelp } from './help.ts'
import { promptForMissing } from './prompt.ts'
import {
  coerceTypes,
  getDefaults,
  getMissingRequired,
  toJsonSchema,
  validateSchema,
} from './schema.ts'
import type { ClilyChildSimple, ClilyHooks, ClilyOptions, JsonSchema } from './types.ts'

export type {
  ClilyChildSimple,
  ClilyHooks,
  ClilyOptions,
  CompletionConfig,
  CompletionShell,
  ExecutionEnvironment,
  InferOutput,
  JsonSchema,
  JsonSchemaProperty,
  MergedOutput,
  Prettify,
  TypedChildren,
} from './types.ts'
export {
  coerceTypes,
  getDefaults,
  getMissingRequired,
  toJsonSchema,
  validateSchema,
} from './schema.ts'
export { generateChildHelp, generateHelp } from './help.ts'
export { resolveEnvVars, toEnvPrefix, getExecutionEnvironment, inferShell } from './env.ts'
export { camelToKebab, kebabToCamel, normalizeArgs } from './args.ts'
export {
  buildCompletionTree,
  extractCompletionShellArg,
  generateCompletionScript,
  getCompletionCommandNames,
  normalizeCompletionConfig,
  resolveCompletionShell,
} from './completion.ts'

// ─── Internal Helpers ────────────────────────────────────

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

/** Format and log validation issues. */
function logValidationIssues(issues: readonly StandardSchemaV1.Issue[]): void {
  for (const issue of issues) {
    const path =
      issue.path
        ?.map((seg) => (typeof seg === 'object' ? String(seg.key) : String(seg)))
        .join('.') ?? ''
    consola.error(`Validation error${path ? ` at "${path}"` : ''}: ${issue.message}`)
  }
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
    logValidationIssues(issues)
    return null
  } else {
    logValidationIssues(issues)
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
  debug: boolean,
  handler?: (args: Record<string, unknown>) => void | Promise<void>,
): Promise<void> {
  const cliArgs = normalizeArgs(parsedArgs)
  const envVars = resolveEnvVars(name)
  let fileConfig: Record<string, unknown> = {}
  try {
    fileConfig = await loadClilyConfig({ name })
  } catch {
    // Config file loading is optional
  }

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
        process.exit(1)
      }
      mergedConfig = coerceTypes(fixed, mergedJsonSchema)

      // Re-validate
      const reResult = await validateSchema(schema, mergedConfig)
      if (!reResult.success) {
        logValidationIssues(reResult.issues)
        process.exit(1)
      }
    }
  }

  if (debug) {
    consola.debug('Resolved config:', mergedConfig)
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
  debug: boolean,
): CommandDef {
  const argSchema = childConfig.args ? toJsonSchema(childConfig.args) : null
  const cittyArgs = buildArgsDef(rootFlagsSchema, argSchema)

  const flagDefaults = rootFlagsSchema ? getDefaults(rootFlagsSchema) : {}
  const argDefaults = argSchema ? getDefaults(argSchema) : {}
  const schemaDefaults = { ...flagDefaults, ...argDefaults }

  const mergedJsonSchema: JsonSchema = {
    type: 'object',
    properties: {
      ...rootFlagsSchema?.properties,
      ...argSchema?.properties,
    },
    required: [...(rootFlagsSchema?.required ?? []), ...(argSchema?.required ?? [])],
  }

  const schemas: StandardSchemaV1[] = []
  if (rootFlags) schemas.push(rootFlags)
  if (childConfig.args) schemas.push(childConfig.args)

  // Build nested subcommands
  const subCommands: SubCommandsDef | undefined = childConfig.children
    ? Object.fromEntries(
        Object.entries(childConfig.children).map(([subName, subConfig]) => [
          subName,
          buildSubCommand(
            subName,
            subConfig,
            rootName,
            rootFlagsSchema,
            rootFlags,
            rootHooks,
            debug,
          ),
        ]),
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
        console.log(typeof mutated === 'string' ? mutated : helpText)
        return
      }

      await resolveAndRun(
        rootName,
        parsedArgs as unknown as Record<string, unknown>,
        schemas,
        mergedJsonSchema,
        schemaDefaults,
        childConfig.hooks ?? rootHooks,
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
 * import { clily } from 'clily'
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
  const environment = getExecutionEnvironment()
  const debug = config.debug ?? environment.isDebug
  const completionConfig = normalizeCompletionConfig(config.completion)
  const completionCommandNames = getCompletionCommandNames(config.completion).filter(
    (name) => !(config.children && name in config.children),
  )
  const flagSchema = config.flags ? toJsonSchema(config.flags as StandardSchemaV1) : null
  const argSchema = config.args ? toJsonSchema(config.args as StandardSchemaV1) : null

  const cittyArgs = buildArgsDef(flagSchema, argSchema)

  const flagDefaults = flagSchema ? getDefaults(flagSchema) : {}
  const argDefaults = argSchema ? getDefaults(argSchema) : {}
  const schemaDefaults = { ...flagDefaults, ...argDefaults }

  const mergedJsonSchema: JsonSchema = {
    type: 'object',
    properties: {
      ...flagSchema?.properties,
      ...argSchema?.properties,
    },
    required: [...(flagSchema?.required ?? []), ...(argSchema?.required ?? [])],
  }

  const schemas: StandardSchemaV1[] = []
  if (config.flags) schemas.push(config.flags as StandardSchemaV1)
  if (config.args) schemas.push(config.args as StandardSchemaV1)

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
              config.flags as StandardSchemaV1 | undefined,
              config.hooks,
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
        console.log(typeof mutated === 'string' ? mutated : helpText)
        return
      }

      await resolveAndRun(
        config.name,
        parsedArgs as unknown as Record<string, unknown>,
        schemas,
        mergedJsonSchema,
        schemaDefaults,
        config.hooks,
        debug,
        config.handler as ((args: Record<string, unknown>) => void | Promise<void>) | undefined,
      )
    },
  })

  return async () => {
    try {
      if (completionConfig && isCompletionCommand(process.argv.slice(2), completionCommandNames)) {
        const shell = resolveCompletionShell(
          extractCompletionShellArg(process.argv.slice(2), completionCommandNames),
          completionConfig,
          environment,
        )
        const script = generateCompletionScript(
          config.name,
          buildCompletionTree({
            flags: config.flags,
            args: config.args,
            children: config.children as Record<string, ClilyChildSimple> | undefined,
            completion: config.completion,
          }),
          shell,
        )
        console.log(script)
        return
      }

      await runMain(rootCommand)
    } catch (err) {
      if (config.hooks?.onError) {
        await config.hooks.onError(err instanceof Error ? err : new Error(String(err)))
      } else {
        consola.error(err)
        process.exit(1)
      }
    }
  }
}
