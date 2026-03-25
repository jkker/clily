import type { StandardSchemaV1 } from '@standard-schema/spec'
/**
 * Help text generation for clily.
 *
 * Auto-generates help menus from JSON Schema metadata and command tree.
 */
import { colors } from 'consola/utils'

import { camelToKebab } from './args.ts'
import { toJsonSchema } from './schema.ts'
import type { JsonSchema, JsonSchemaProperty } from './types.ts'

type HelpChildConfig = {
  description?: string
  args?: StandardSchemaV1
}

/**
 * Format a single flag entry for help display.
 */
function formatFlag(key: string, prop: JsonSchemaProperty, isRequired: boolean): string {
  const flag = `--${camelToKebab(key)}`
  const typeStr = prop.type ? `<${prop.type}>` : ''
  const reqStr = isRequired ? colors.red('(required)') : ''
  const defStr =
    prop.default !== undefined ? colors.dim(`(default: ${JSON.stringify(prop.default)})`) : ''
  const descStr = prop.description ?? ''

  return `  ${colors.green(flag)} ${typeStr} ${descStr} ${reqStr} ${defStr}`.trimEnd()
}

/**
 * Generate a complete help text string for a clily command.
 */
export function generateHelp(
  config: {
    name?: string
    version?: string
    description?: string
    flags?: StandardSchemaV1
    args?: StandardSchemaV1
    children?: Record<string, HelpChildConfig>
  },
  commandPath: string[] = [],
): string {
  const lines: string[] = []
  const name = config.name ?? commandPath.at(-1) ?? ''
  const fullCommand = commandPath.length > 0 ? commandPath.join(' ') : name

  // Header
  if (config.version) {
    lines.push(`${colors.bold(name)} ${colors.dim(`v${config.version}`)}`)
  } else {
    lines.push(colors.bold(name))
  }

  if (config.description) {
    lines.push(`  ${config.description}`)
  }
  lines.push('')

  // Usage
  lines.push(colors.bold('USAGE:'))
  const hasChildren = config.children && Object.keys(config.children).length > 0
  if (hasChildren) {
    lines.push(`  ${fullCommand} <command> [options]`)
  } else {
    lines.push(`  ${fullCommand} [options]`)
  }
  lines.push('')

  // Global flags
  if (config.flags) {
    const flagSchema = toJsonSchema(config.flags)
    if (Object.keys(flagSchema.properties).length > 0) {
      lines.push(colors.bold('GLOBAL FLAGS:'))
      for (const [key, prop] of Object.entries(flagSchema.properties)) {
        lines.push(formatFlag(key, prop, flagSchema.required.includes(key)))
      }
      lines.push('')
    }
  }

  // Args (command-specific flags)
  if (config.args) {
    const argSchema = toJsonSchema(config.args)
    if (Object.keys(argSchema.properties).length > 0) {
      lines.push(colors.bold('OPTIONS:'))
      for (const [key, prop] of Object.entries(argSchema.properties)) {
        lines.push(formatFlag(key, prop, argSchema.required.includes(key)))
      }
      lines.push('')
    }
  }

  // Subcommands
  if (hasChildren) {
    lines.push(colors.bold('COMMANDS:'))
    for (const [cmdName, cmdConfig] of Object.entries(
      config.children as Record<string, HelpChildConfig>,
    )) {
      const desc = cmdConfig.description ?? ''
      lines.push(`  ${colors.green(cmdName)}  ${desc}`)
    }
    lines.push('')
  }

  // Footer
  lines.push(colors.dim(`  Use "${fullCommand} <command> --help" for more information.`))

  return lines.join('\n')
}

/**
 * Generate help text for a child command, extracting schema from JSON Schema.
 */
export function generateChildHelp(
  childConfig: HelpChildConfig,
  parentFlagsSchema: JsonSchema | null,
  commandPath: string[],
): string {
  const lines: string[] = []
  const name = commandPath.at(-1) ?? ''
  const fullCommand = commandPath.join(' ')

  lines.push(colors.bold(name))
  if (childConfig.description) {
    lines.push(`  ${childConfig.description}`)
  }
  lines.push('')

  lines.push(colors.bold('USAGE:'))
  lines.push(`  ${fullCommand} [options]`)
  lines.push('')

  // Parent flags
  if (parentFlagsSchema && Object.keys(parentFlagsSchema.properties).length > 0) {
    lines.push(colors.bold('GLOBAL FLAGS:'))
    for (const [key, prop] of Object.entries(parentFlagsSchema.properties)) {
      lines.push(formatFlag(key, prop, parentFlagsSchema.required.includes(key)))
    }
    lines.push('')
  }

  // Child args
  if (childConfig.args) {
    const argSchema = toJsonSchema(childConfig.args)
    if (Object.keys(argSchema.properties).length > 0) {
      lines.push(colors.bold('OPTIONS:'))
      for (const [key, prop] of Object.entries(argSchema.properties)) {
        lines.push(formatFlag(key, prop, argSchema.required.includes(key)))
      }
      lines.push('')
    }
  }

  lines.push(colors.dim(`  Use "${fullCommand} --help" for more information.`))

  return lines.join('\n')
}
