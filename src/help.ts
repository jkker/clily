/**
 * Help text generation for clily.
 *
 * Auto-generates help menus from schema entries, command metadata, and subcommand tree.
 */
import pc from 'picocolors'

import { camelToKebab } from './args.ts'
import { getSchemaEntries } from './schema.ts'
import type { ClilyChildConfig, ClilyConfig, SchemaEntry } from './types.ts'

/**
 * Format a single flag entry for help display.
 */
function formatFlag(entry: SchemaEntry): string {
  const flag = `--${camelToKebab(entry.key)}`
  const typeStr = entry.type !== 'unknown' ? `<${entry.type}>` : ''
  const reqStr = entry.required ? pc.red('(required)') : ''
  const defStr =
    entry.default !== undefined ? pc.dim(`(default: ${JSON.stringify(entry.default)})`) : ''
  const descStr = entry.description ? entry.description : ''

  return `  ${pc.green(flag)} ${typeStr} ${descStr} ${reqStr} ${defStr}`.trimEnd()
}

/**
 * Generate a complete help text string for a clily command.
 */
export function generateHelp(
  config: ClilyConfig | ClilyChildConfig,
  commandPath: string[] = [],
): string {
  const lines: string[] = []
  const name = 'name' in config ? config.name : (commandPath.at(-1) ?? '')
  const fullCommand = commandPath.length > 0 ? commandPath.join(' ') : name

  // Header
  if ('version' in config && config.version) {
    lines.push(`${pc.bold(name)} ${pc.dim(`v${config.version}`)}`)
  } else {
    lines.push(pc.bold(name))
  }

  if (config.description) {
    lines.push(`  ${config.description}`)
  }
  lines.push('')

  // Usage
  lines.push(pc.bold('USAGE:'))
  const hasChildren = config.children && Object.keys(config.children).length > 0
  if (hasChildren) {
    lines.push(`  ${fullCommand} <command> [options]`)
  } else {
    lines.push(`  ${fullCommand} [options]`)
  }
  lines.push('')

  // Global flags
  if ('flags' in config && config.flags) {
    const flagEntries = getSchemaEntries(config.flags)
    if (flagEntries.length > 0) {
      lines.push(pc.bold('GLOBAL FLAGS:'))
      for (const entry of flagEntries) {
        lines.push(formatFlag(entry))
      }
      lines.push('')
    }
  }

  // Args (command-specific flags)
  if (config.args) {
    const argEntries = getSchemaEntries(config.args)
    if (argEntries.length > 0) {
      lines.push(pc.bold('OPTIONS:'))
      for (const entry of argEntries) {
        lines.push(formatFlag(entry))
      }
      lines.push('')
    }
  }

  // Subcommands
  if (hasChildren) {
    lines.push(pc.bold('COMMANDS:'))
    for (const [cmdName, cmdConfig] of Object.entries(config.children!)) {
      const desc = cmdConfig.description ?? ''
      lines.push(`  ${pc.green(cmdName)}  ${desc}`)
    }
    lines.push('')
  }

  // Footer
  lines.push(pc.dim(`  Use "${fullCommand} <command> --help" for more information.`))

  return lines.join('\n')
}
