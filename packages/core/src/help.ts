import type { JSONSchema7 } from 'json-schema'

import type { ArgDefinition } from './args.ts'
import { getCompletionCommandNames, normalizeCompletionConfig } from './completion.ts'
import { getSchemaKind } from './schema.ts'
import { getChildEntries, type ClilyCommandNode, type ClilyCommandTree } from './tree.ts'

const formatDefault = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value)

const formatChoice = (value: unknown): string => {
  if (typeof value === 'string') return value
  const serialized = JSON.stringify(value)
  return serialized ?? ''
}

const getTypeHint = (schema: JSONSchema7): string => {
  const kind = getSchemaKind(schema)
  if (kind === 'boolean') return ''
  if (kind === 'array') {
    const itemSchema =
      schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)
        ? schema.items
        : undefined
    const itemKind = itemSchema ? (getSchemaKind(itemSchema) ?? 'value') : 'value'
    return `<${itemKind}...>`
  }
  return `<${kind ?? 'value'}>`
}

const getPositionalUsage = (schema: JSONSchema7): string => {
  const required = schema.default === undefined
  const wrapper = required ? ['<', '>'] : ['[', ']']
  if (getSchemaKind(schema) === 'array') return `${wrapper[0]}values...${wrapper[1]}`
  return `${wrapper[0]}value${wrapper[1]}`
}

const getVisibleCommands = (node: ClilyCommandNode): Array<[string, ClilyCommandNode]> =>
  getChildEntries(node).filter(([, childNode]) => !childNode.meta.hidden)

const formatOptionLine = (definition: ArgDefinition): string => {
  const parts = [`  --${definition.cliKey}`]
  const typeHint = getTypeHint(definition.schema)
  if (typeHint) parts.push(typeHint)
  if (definition.schema.description) parts.push(definition.schema.description)
  if (definition.required) parts.push('(required)')
  if (definition.schema.default !== undefined)
    parts.push(`(default: ${formatDefault(definition.schema.default)})`)

  if (Array.isArray(definition.schema.enum) && definition.schema.enum.length > 0)
    parts.push(`(choices: ${definition.schema.enum.map(formatChoice).join(', ')})`)

  return parts.join(' ')
}

/** Render help output from the built command tree and resolved subtree. */
export function renderHelp(
  tree: ClilyCommandTree,
  node: ClilyCommandNode = tree.root,
  options?: { includeCompletionCommand?: boolean },
): string {
  const lines: string[] = []
  const isRoot = node.path.length === 1
  const visibleCommands = getVisibleCommands(node)
  const completionConfig = isRoot ? normalizeCompletionConfig(tree.root.command.completion) : null
  const completionCommands = isRoot ? getCompletionCommandNames(tree.root.command.completion) : []
  const showCompletionCommand =
    isRoot && options?.includeCompletionCommand === true && completionConfig !== null

  lines.push(node.meta.version ? `${node.meta.name} v${node.meta.version}` : node.meta.name)
  if (node.meta.description) lines.push(`  ${node.meta.description}`)
  lines.push('')

  const usageParts = [node.path.join(' '), '[options]']
  const positionalsSchema = node.getPositionalsSchema()
  if (positionalsSchema) usageParts.push(getPositionalUsage(positionalsSchema))
  if (visibleCommands.length > 0 || showCompletionCommand) usageParts.push('<command>')

  lines.push('USAGE:')
  lines.push(`  ${usageParts.join(' ')}`)

  lines.push('')
  lines.push('OPTIONS:')
  for (const definition of node.getArgDefinitions()) lines.push(formatOptionLine(definition))
  lines.push('  --help Show this help message')
  if (isRoot && node.meta.version) lines.push('  --version Show the command version')

  if (positionalsSchema) {
    lines.push('')
    lines.push('POSITIONALS:')
    lines.push(
      `  ${getPositionalUsage(positionalsSchema)} ${positionalsSchema.description ?? ''}`.trimEnd(),
    )
    if (positionalsSchema.default !== undefined)
      lines.push(`  default: ${formatDefault(positionalsSchema.default)}`)
  }

  if (visibleCommands.length > 0 || showCompletionCommand) {
    lines.push('')
    lines.push('COMMANDS:')
    for (const [childName, childNode] of visibleCommands) {
      const description = childNode.meta.description ?? ''
      const suffix = childNode.aliases.length > 0 ? ` (${childNode.aliases.join(', ')})` : ''
      lines.push(`  ${childName}${suffix}${description ? ` ${description}` : ''}`)
    }
    if (showCompletionCommand) {
      lines.push(
        `  ${completionConfig?.command ?? completionCommands[0]} ${completionConfig?.description}`.trimEnd(),
      )
    }
  }

  return lines.join('\n')
}
