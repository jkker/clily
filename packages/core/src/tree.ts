import type { JSONSchema7 } from 'json-schema'

import { flattenArgDefinitions, type ArgDefinition } from './args.ts'
import { asObjectSchema, asPositionalSchema, toJsonSchema } from './schema.ts'
import type { AnyClilyCommand, AnyClilyRootCommand, ClilyCommandMeta } from './types.ts'

/** Normalized command node used internally as clily's single command-tree source of truth. */
export interface ClilyCommandNode {
  /** Canonical command key used in the `subCommands` map. */
  key: string

  /** Original command definition. */
  command: AnyClilyCommand

  /** Resolved metadata with a guaranteed command name. */
  meta: ClilyCommandMeta & { name: string }

  /** Canonical path from the root command to this node. */
  path: string[]

  /** Aliases accepted for this node. */
  aliases: string[]

  /** Parent command node, when present. */
  parent?: ClilyCommandNode

  /** Nested child command nodes keyed by their canonical names. */
  children: Record<string, ClilyCommandNode>

  /** Lazily resolve the JSON Schema object used for named args. */
  getArgsSchema: () => JSONSchema7 | undefined

  /** Lazily resolve flattened leaf arg definitions for CLI/env parsing. */
  getArgDefinitions: () => ArgDefinition[]

  /** Lazily resolve the JSON Schema used for positional input. */
  getPositionalsSchema: () => JSONSchema7 | undefined
}

/** Internal command tree created once at `clily()` invocation time. */
export interface ClilyCommandTree {
  /** Root node for the command tree. */
  root: ClilyCommandNode & { command: AnyClilyRootCommand }
}

const normalizeAlias = (alias?: string | string[]): string[] => {
  if (!alias) return []
  return Array.isArray(alias) ? alias : [alias]
}

const resolveCommandMeta = (command: AnyClilyCommand, fallbackName: string) => ({
  name: command.name ?? fallbackName,
  version: command.version,
  description: command.description,
  alias: command.alias,
  hidden: command.hidden,
})

const createCommandNode = (
  command: AnyClilyCommand,
  key: string,
  path: string[],
  parent?: ClilyCommandNode,
): ClilyCommandNode => {
  let argsSchema: JSONSchema7 | undefined | null
  let argDefinitions: ArgDefinition[] | undefined
  let positionalsSchema: JSONSchema7 | undefined | null

  const node: ClilyCommandNode = {
    key,
    command,
    meta: resolveCommandMeta(command, key),
    path,
    aliases: normalizeAlias(command.alias),
    parent,
    children: {},
    getArgsSchema: () => {
      if (argsSchema === undefined) {
        argsSchema = command.args
          ? asObjectSchema(toJsonSchema(command.args), `Args for ${path.join(' ')}`)
          : null
      }

      return argsSchema ?? undefined
    },
    getArgDefinitions: () => {
      if (argDefinitions === undefined) {
        const resolvedSchema = node.getArgsSchema()
        argDefinitions = resolvedSchema ? flattenArgDefinitions(resolvedSchema) : []
      }

      return argDefinitions
    },
    getPositionalsSchema: () => {
      if (positionalsSchema === undefined) {
        positionalsSchema = command.positionals
          ? asPositionalSchema(
              toJsonSchema(command.positionals),
              `Positionals for ${path.join(' ')}`,
            )
          : null
      }

      return positionalsSchema ?? undefined
    },
  }

  const childCommands = Object.entries(command.subCommands ?? {})
  for (const [childKey, childCommand] of childCommands)
    node.children[childKey] = createCommandNode(childCommand, childKey, [...path, childKey], node)

  return node
}

/** Build clily's internal command tree once and reuse it across all later workflow steps. */
export function buildCommandTree(command: AnyClilyRootCommand): ClilyCommandTree {
  return {
    root: createCommandNode(command, command.name, [command.name]) as ClilyCommandNode & {
      command: AnyClilyRootCommand
    },
  }
}

/** Return child nodes as stable `[name, node]` tuples. */
export const getChildEntries = (node: ClilyCommandNode): Array<[string, ClilyCommandNode]> =>
  Object.entries(node.children)

/** Find a direct child node by canonical name or configured alias. */
const findSubCommandNode = (
  node: ClilyCommandNode,
  token: string | undefined,
): ClilyCommandNode | undefined => {
  if (!token) return undefined

  for (const [childName, childNode] of getChildEntries(node))
    if (token === childName || childNode.aliases.includes(token)) return childNode

  return undefined
}

/** Check whether a built-in command name collides with a declared root subcommand or alias. */
export const hasCommandNameConflict = (
  root: ClilyCommandNode,
  commandNames: readonly string[],
): boolean =>
  commandNames.some((commandName) => {
    for (const [childName, childNode] of getChildEntries(root))
      if (commandName === childName || childNode.aliases.includes(commandName)) return true

    return false
  })

/** Resolve the executed command subtree from the positional command tokens provided by the user. */
export function resolveCommandSubtree(
  tree: ClilyCommandTree,
  tokens: readonly string[],
): { node: ClilyCommandNode; consumedTokens: string[]; remainingTokens: string[] } {
  let node = tree.root as ClilyCommandNode
  const consumedTokens: string[] = []
  let remainingTokens = [...tokens]

  while (remainingTokens.length > 0) {
    const nextToken = remainingTokens[0]
    if (nextToken.startsWith('-')) break

    const childNode = findSubCommandNode(node, nextToken)
    if (!childNode) break

    node = childNode
    consumedTokens.push(nextToken)
    remainingTokens = remainingTokens.slice(1)
  }

  return { node, consumedTokens, remainingTokens }
}
