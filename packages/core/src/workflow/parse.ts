import { defu } from 'defu'
import type { JSONSchema7 } from 'json-schema'

import { parseArgTokens, resolveEnvArgs } from '../args.ts'
import { getCommandConfig, loadClilyConfig } from '../config.ts'
import { ClilyError } from '../errors.ts'
import { coerceObjectValue, coerceValue, getObjectDefaults, getSchemaKind } from '../schema.ts'
import type { ClilyCommandNode } from '../tree.ts'
import type { CommandInputLayer, LayerName, ParsedCommandInput } from './types.ts'

const createInputLayer = (name: LayerName, value: Record<string, unknown>): CommandInputLayer => ({
  name,
  value,
})

const resolvePositionals = (tokens: string[], schema?: JSONSchema7): unknown => {
  if (!schema) return undefined
  if (tokens.length === 0) return schema.default
  if (getSchemaKind(schema) === 'array') return tokens
  if (tokens.length > 1)
    throw new ClilyError({ kind: 'usage', message: 'Too many positional arguments.' })

  return tokens[0]
}

export async function parseCommandInput(options: {
  node: ClilyCommandNode
  rawArgs: string[]
  env?: Record<string, string | undefined>
  cwd?: string
  config?: Record<string, unknown>
}): Promise<ParsedCommandInput> {
  const argsSchema = options.node.getArgsSchema()
  const positionalsSchema = options.node.getPositionalsSchema()
  const argDefinitions = options.node.getArgDefinitions()
  const parsedTokens = parseArgTokens(options.rawArgs, argDefinitions)
  const rootName = options.node.path[0]
  const rootConfig =
    options.config ??
    (await loadClilyConfig({
      name: rootName,
      cwd: options.cwd ?? process.cwd(),
    }))

  const cliLayer = createInputLayer(
    'cli',
    argsSchema ? coerceObjectValue(parsedTokens.args, argsSchema) : {},
  )
  const envLayer = createInputLayer(
    'env',
    argsSchema
      ? coerceObjectValue(
          resolveEnvArgs(options.env ?? process.env, options.node.path, argDefinitions),
          argsSchema,
        )
      : {},
  )
  const configLayer = createInputLayer(
    'config',
    argsSchema
      ? coerceObjectValue(getCommandConfig(rootConfig, options.node.path.slice(1)), argsSchema)
      : {},
  )
  const defaultsLayer = createInputLayer(
    'defaults',
    argsSchema ? getObjectDefaults(argsSchema) : {},
  )

  const args = argsSchema
    ? coerceObjectValue(
        defu(cliLayer.value, envLayer.value, configLayer.value, defaultsLayer.value),
        argsSchema,
      )
    : {}
  const positionals = positionalsSchema
    ? coerceValue(
        resolvePositionals(parsedTokens.positionals, positionalsSchema),
        positionalsSchema,
      )
    : undefined

  return {
    argsSchema,
    positionalsSchema,
    args,
    positionals,
    positionalTokens: parsedTokens.positionals,
    layers: {
      cli: cliLayer,
      env: envLayer,
      config: configLayer,
      defaults: defaultsLayer,
    },
  }
}
