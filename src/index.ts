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

import { normalizeArgs, schemaToCittyArgs } from './args.ts'
import { loadClilyConfig } from './config.ts'
import { resolveEnvVars } from './env.ts'
import { generateHelp } from './help.ts'
import { promptForMissing } from './prompt.ts'
import {
  getMissingRequiredKeys,
  getSchemaDefaults,
  getSchemaEntries,
  validateSchema,
} from './schema.ts'
import type { ClilyChildConfig, ClilyConfig, SchemaEntry } from './types.ts'

export type { ClilyChildConfig, ClilyConfig, ClilyHooks, SchemaEntry } from './types.ts'
export { generateHelp } from './help.ts'
export {
  getSchemaDefaults,
  getSchemaEntries,
  getMissingRequiredKeys,
  validateSchema,
} from './schema.ts'
export { resolveEnvVars, toEnvPrefix } from './env.ts'
export { camelToKebab, kebabToCamel, normalizeArgs } from './args.ts'

/**
 * Build citty ArgsDef from flags + args schemas.
 */
export function buildArgsDef(flagEntries: SchemaEntry[], argEntries: SchemaEntry[]): ArgsDef {
  return {
    ...schemaToCittyArgs(flagEntries),
    ...schemaToCittyArgs(argEntries),
  }
}

/**
 * Merge config layers in priority order:
 * CLI args > env vars > local config > schema defaults
 */
export function mergeConfigLayers(
  cliArgs: Record<string, unknown>,
  envVars: Record<string, unknown>,
  fileConfig: Record<string, unknown>,
  schemaDefaults: Record<string, unknown>,
): Record<string, unknown> {
  // defu merges with first arg having highest priority
  return defu(cliArgs, envVars, fileConfig, schemaDefaults)
}

/**
 * Coerce string values to their expected types based on schema entries.
 */
export function coerceValues(
  data: Record<string, unknown>,
  entries: SchemaEntry[],
): Record<string, unknown> {
  const result = { ...data }
  for (const entry of entries) {
    const val = result[entry.key]
    if (val === undefined) continue
    if (entry.type === 'boolean' && typeof val === 'string') {
      if (val === 'true' || val === '1') result[entry.key] = true
      else if (val === 'false' || val === '0') result[entry.key] = false
    } else if (entry.type === 'number' && typeof val === 'string') {
      const num = Number(val)
      if (!Number.isNaN(num)) result[entry.key] = num
    }
  }
  return result
}

/**
 * Format and log validation issues using consola.
 */
function logValidationIssues(issues: readonly StandardSchemaV1.Issue[]): void {
  for (const issue of issues) {
    const path =
      issue.path
        ?.map((seg) => (typeof seg === 'object' ? String(seg.key) : String(seg)))
        .join('.') ?? ''
    consola.error(`Validation error${path ? ` at "${path}"` : ''}: ${issue.message}`)
  }
}

/**
 * Handle validation failure: prompt in TTY, error in CI.
 */
export async function handleValidationFailure(
  issues: readonly StandardSchemaV1.Issue[],
  mergedConfig: Record<string, unknown>,
  allEntries: SchemaEntry[],
  mergedSchema: StandardSchemaV1 | undefined,
  config: ClilyConfig | ClilyChildConfig,
): Promise<Record<string, unknown> | null> {
  // Call onValidationError hook
  if (config.hooks?.onValidationError) {
    await config.hooks.onValidationError(issues)
  }

  if (hasTTY && !isCI) {
    // Interactive mode: prompt for missing required fields
    const missingKeys = mergedSchema
      ? getMissingRequiredKeys(mergedSchema, mergedConfig)
      : issues
          .filter((i) => i.path && i.path.length > 0)
          .map((i) => {
            const seg = i.path![0]
            return typeof seg === 'object' ? String(seg.key) : String(seg)
          })

    if (missingKeys.length > 0) {
      if (config.hooks?.onPromptSelect) {
        await config.hooks.onPromptSelect(missingKeys)
      }
      const prompted = await promptForMissing(missingKeys, allEntries)
      return { ...mergedConfig, ...prompted }
    }

    // Non-missing-key errors (type errors etc.)
    logValidationIssues(issues)
    return null
  } else {
    // CI/non-TTY: print errors and return null (caller should exit)
    logValidationIssues(issues)
    return null
  }
}

/**
 * Build a citty subcommand from a ClilyChildConfig.
 */
function buildSubCommand(
  name: string,
  childConfig: ClilyChildConfig,
  rootConfig: ClilyConfig,
): CommandDef {
  const flagEntries = rootConfig.flags ? getSchemaEntries(rootConfig.flags) : []
  const argEntries = childConfig.args ? getSchemaEntries(childConfig.args) : []
  const allEntries = [...flagEntries, ...argEntries]

  const cittyArgs = buildArgsDef(flagEntries, argEntries)

  // Build nested subcommands recursively
  const subCommands: SubCommandsDef | undefined = childConfig.children
    ? Object.fromEntries(
        Object.entries(childConfig.children).map(([subName, subConfig]) => [
          subName,
          buildSubCommand(subName, subConfig, rootConfig),
        ]),
      )
    : undefined

  return defineCommand({
    meta: {
      name,
      description: childConfig.description,
    },
    args: cittyArgs,
    subCommands,
    run: async ({ args: parsedArgs }) => {
      // Check for --help
      if ((parsedArgs as Record<string, unknown>)['help']) {
        const helpText = generateHelp(childConfig, [rootConfig.name, name])
        const mutated = childConfig.hooks?.onHelp
          ? await childConfig.hooks.onHelp(helpText)
          : rootConfig.hooks?.onHelp
            ? await rootConfig.hooks.onHelp(helpText)
            : undefined
        console.log(typeof mutated === 'string' ? mutated : helpText)
        return
      }

      // Merge config layers
      const cliArgs = normalizeArgs(parsedArgs as unknown as Record<string, unknown>)
      const envVars = resolveEnvVars(rootConfig.name)
      let fileConfig: Record<string, unknown> = {}
      try {
        fileConfig = await loadClilyConfig({ name: rootConfig.name })
      } catch {
        // Config file loading is optional
      }

      const flagDefaults = rootConfig.flags ? getSchemaDefaults(rootConfig.flags) : {}
      const argDefaults = childConfig.args ? getSchemaDefaults(childConfig.args) : {}
      const schemaDefaults = { ...flagDefaults, ...argDefaults }

      let mergedConfig = mergeConfigLayers(cliArgs, envVars, fileConfig, schemaDefaults)

      // Coerce types
      mergedConfig = coerceValues(mergedConfig, allEntries)

      // Call onValidate hook
      if (childConfig.hooks?.onValidate) {
        await childConfig.hooks.onValidate(mergedConfig)
      } else if (rootConfig.hooks?.onValidate) {
        await rootConfig.hooks.onValidate(mergedConfig)
      }

      // Build a merged schema for validation if we have args
      const schemasToValidate: StandardSchemaV1[] = []
      if (rootConfig.flags) schemasToValidate.push(rootConfig.flags)
      if (childConfig.args) schemasToValidate.push(childConfig.args)

      // Validate against each schema
      for (const schema of schemasToValidate) {
        const result = await validateSchema(schema, mergedConfig)
        if (!result.success) {
          const fixed = await handleValidationFailure(
            result.issues,
            mergedConfig,
            allEntries,
            schema,
            childConfig,
          )
          if (!fixed) {
            process.exit(1)
          }
          mergedConfig = coerceValues(fixed, allEntries)

          // Re-validate
          const reResult = await validateSchema(schema, mergedConfig)
          if (!reResult.success) {
            for (const issue of reResult.issues) {
              consola.error(issue.message)
            }
            process.exit(1)
          }
        }
      }

      if (rootConfig.debug) {
        consola.debug('Resolved config:', mergedConfig)
      }

      // Execute handler
      if (childConfig.handler) {
        await childConfig.handler(mergedConfig)
      }
    },
  })
}

/**
 * Create a clily CLI instance.
 *
 * @param config - The CLI configuration
 * @returns An async function that bootstraps parsing, resolution, validation, prompting, and execution
 */
export function clily(config: ClilyConfig): () => Promise<void> {
  const flagEntries = config.flags ? getSchemaEntries(config.flags) : []
  const argEntries = config.args ? getSchemaEntries(config.args) : []
  const allEntries = [...flagEntries, ...argEntries]
  const cittyArgs = buildArgsDef(flagEntries, argEntries)

  // Build subcommands
  const subCommands: SubCommandsDef | undefined = config.children
    ? Object.fromEntries(
        Object.entries(config.children).map(([name, childConfig]) => [
          name,
          buildSubCommand(name, childConfig, config),
        ]),
      )
    : undefined

  const rootCommand = defineCommand({
    meta: {
      name: config.name,
      version: config.version,
      description: config.description,
    },
    args: cittyArgs,
    subCommands,
    run: async ({ rawArgs, args: parsedArgs }) => {
      // Call onParse hook
      if (config.hooks?.onParse) {
        await config.hooks.onParse(rawArgs)
      }

      // Check for --help or no handler (show help)
      if ((parsedArgs as Record<string, unknown>)['help'] || !config.handler) {
        const helpText = generateHelp(config)
        const mutated = config.hooks?.onHelp ? await config.hooks.onHelp(helpText) : undefined
        console.log(typeof mutated === 'string' ? mutated : helpText)
        return
      }

      // Merge config layers
      const cliArgs = normalizeArgs(parsedArgs as unknown as Record<string, unknown>)
      const envVars = resolveEnvVars(config.name)
      let fileConfig: Record<string, unknown> = {}
      try {
        fileConfig = await loadClilyConfig({ name: config.name })
      } catch {
        // Config file loading is optional
      }

      const flagDefaults = config.flags ? getSchemaDefaults(config.flags) : {}
      const argDefaults = config.args ? getSchemaDefaults(config.args) : {}
      const schemaDefaults = { ...flagDefaults, ...argDefaults }

      let mergedConfig = mergeConfigLayers(cliArgs, envVars, fileConfig, schemaDefaults)

      // Coerce types
      mergedConfig = coerceValues(mergedConfig, allEntries)

      // Call onValidate hook
      if (config.hooks?.onValidate) {
        await config.hooks.onValidate(mergedConfig)
      }

      // Validate
      const schemasToValidate: StandardSchemaV1[] = []
      if (config.flags) schemasToValidate.push(config.flags)
      if (config.args) schemasToValidate.push(config.args)

      for (const schema of schemasToValidate) {
        const result = await validateSchema(schema, mergedConfig)
        if (!result.success) {
          const fixed = await handleValidationFailure(
            result.issues,
            mergedConfig,
            allEntries,
            schema,
            config,
          )
          if (!fixed) {
            process.exit(1)
          }
          mergedConfig = coerceValues(fixed, allEntries)

          // Re-validate
          const reResult = await validateSchema(schema, mergedConfig)
          if (!reResult.success) {
            for (const issue of reResult.issues) {
              consola.error(issue.message)
            }
            process.exit(1)
          }
        }
      }

      if (config.debug) {
        consola.debug('Resolved config:', mergedConfig)
      }

      // Execute root handler
      await config.handler(mergedConfig)
    },
  })

  return async () => {
    try {
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
