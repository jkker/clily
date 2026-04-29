import type { JSONSchema7 } from 'json-schema'

import { getChildEntries, type ClilyCommandNode, type ClilyCommandTree } from './tree.ts'
import type { CompletionConfig } from './types.ts'

const formatChoice = (value: unknown): string => {
  if (typeof value === 'string') return value
  const serialized = JSON.stringify(value)
  return serialized ?? ''
}

const getItemSchema = (schema: JSONSchema7) =>
  schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)
    ? schema.items
    : undefined

/** Completion payload that can later be fed into an omelette adapter. */
export interface CompletionTree {
  /** Command description used by future completion adapters. */
  description?: string

  /** Option suggestions keyed by their CLI flag names. */
  options: Record<string, string[]>

  /** Nested subcommand completion payloads. */
  commands: Record<string, CompletionTree>
}

const getEnumSuggestions = (schema: JSONSchema7): string[] => {
  if (Array.isArray(schema.enum)) return schema.enum.map(formatChoice)
  if (schema.type !== 'array') return []
  const itemSchema = getItemSchema(schema)
  if (!itemSchema || !Array.isArray(itemSchema.enum)) return []
  return itemSchema.enum.map(formatChoice)
}

/** Normalize built-in completion command options. */
export function normalizeCompletionConfig(
  completion: boolean | CompletionConfig | undefined,
): Required<CompletionConfig> | null {
  if (!completion) return null
  if (completion === true) {
    return {
      command: 'completion',
      aliases: ['completions'],
      description: 'Generate shell completion metadata (placeholder)',
    }
  }

  return {
    command: completion.command ?? 'completion',
    aliases: completion.aliases ?? ['completions'],
    description: completion.description ?? 'Generate shell completion metadata (placeholder)',
  }
}

/** Return every built-in completion command name. */
export function getCompletionCommandNames(
  completion: boolean | CompletionConfig | undefined,
): string[] {
  const config = normalizeCompletionConfig(completion)
  if (!config) return []
  return [config.command, ...config.aliases]
}

/** Build a completion-friendly tree from the clily command graph. */
export function buildCompletionTree(node: ClilyCommandNode): CompletionTree {
  const options: Record<string, string[]> = { '--help': [] }
  if (node.path.length === 1 && node.meta.version) options['--version'] = []
  for (const definition of node.getArgDefinitions())
    options[`--${definition.cliKey}`] = getEnumSuggestions(definition.schema)

  const commands: Record<string, CompletionTree> = {}
  for (const [name, childNode] of getChildEntries(node)) {
    if (childNode.meta.hidden) continue
    commands[name] = buildCompletionTree(childNode)
  }

  return {
    description: node.meta.description,
    options,
    commands,
  }
}

/** Render the isolated placeholder response for the built-in completion command. */
export function renderCompletionPlaceholder(
  tree: ClilyCommandTree,
  requestedShell?: string,
): string {
  const payload = {
    program: tree.root.meta.name,
    shell: requestedShell ?? null,
    tree: buildCompletionTree(tree.root),
  }

  return [
    '# Completion generation is not implemented yet.',
    '# This payload is the isolated clily tree that will later feed the omelette adapter.',
    JSON.stringify(payload, null, 2),
  ].join('\n')
}
