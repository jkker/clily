import type { StandardSchemaV1 } from '@standard-schema/spec'
import omelette from 'omelette'

import { camelToKebab } from './args.ts'
import { toJsonSchema } from './schema.ts'
import type {
  CompletionConfig,
  CompletionShell,
  ExecutionEnvironment,
  JsonSchema,
} from './types.ts'

type CommandLikeChild = {
  description?: string
  args?: StandardSchemaV1
  children?: Record<string, unknown>
  handler?: (...args: unknown[]) => unknown
}

type CommandLike = {
  description?: string
  args?: StandardSchemaV1
  children?: Record<string, CommandLikeChild>
}

export interface CompletionTree {
  [key: string]: CompletionTree | string[]
}

const RESERVED_COMPLETION_KEYS = new Set(['completion', 'completions'])

function getOptionSuggestions(schema: JsonSchema | null): CompletionTree {
  const suggestions: CompletionTree = {}
  if (!schema) {
    return suggestions
  }
  for (const [key, prop] of Object.entries(schema.properties)) {
    const flag = `--${camelToKebab(key)}`
    if (prop.enum) {
      suggestions[flag] = prop.enum.map((value) => String(value))
    } else {
      suggestions[flag] = []
    }
  }
  return suggestions
}

function buildCompletionNode(
  config: CommandLike,
  inheritedFlags: JsonSchema | null,
  completionCommands: string[],
  completionShells: CompletionShell[],
): CompletionTree {
  const node: CompletionTree = {
    '--help': [],
    ...getOptionSuggestions(inheritedFlags),
    ...(config.args ? getOptionSuggestions(toJsonSchema(config.args)) : {}),
  }

  for (const [name, child] of Object.entries(config.children ?? {})) {
    if (RESERVED_COMPLETION_KEYS.has(name)) {
      continue
    }
    node[name] = buildCompletionNode(
      child as CommandLike,
      inheritedFlags,
      completionCommands,
      completionShells,
    )
  }

  if (completionCommands.length > 0) {
    for (const command of completionCommands) {
      node[command] = [...completionShells]
    }
  }

  return node
}

export function normalizeCompletionConfig(
  completion: boolean | CompletionConfig | undefined,
): Required<CompletionConfig> | null {
  if (!completion) {
    return null
  }
  if (completion === true) {
    return {
      command: 'completion',
      aliases: ['completions'],
      shell: 'auto',
      shells: ['bash', 'zsh', 'fish', 'pwsh'],
    }
  }
  return {
    command: completion.command ?? 'completion',
    aliases: completion.aliases ?? ['completions'],
    shell: completion.shell ?? 'auto',
    shells: completion.shells ?? ['bash', 'zsh', 'fish', 'pwsh'],
  }
}

export function getCompletionCommandNames(
  completion: boolean | CompletionConfig | undefined,
): string[] {
  const resolved = normalizeCompletionConfig(completion)
  if (!resolved) {
    return []
  }
  return [resolved.command, ...resolved.aliases]
}

export function buildCompletionTree(config: {
  flags?: StandardSchemaV1
  args?: StandardSchemaV1
  children?: Record<string, CommandLikeChild>
  completion?: boolean | CompletionConfig
}): CompletionTree {
  const completion = normalizeCompletionConfig(config.completion)
  const flagSchema = config.flags ? toJsonSchema(config.flags) : null

  return buildCompletionNode(
    config as CommandLike,
    flagSchema,
    completion ? [completion.command, ...completion.aliases] : [],
    completion?.shells ?? ['bash', 'zsh', 'fish', 'pwsh'],
  )
}

export function generatePwshCompletionScript(program: string, tree: CompletionTree): string {
  const treeJson = JSON.stringify(tree, null, 2).replace(/'/g, "''")

  return [
    `$__clilyCompletionTree = ConvertFrom-Json @'`,
    treeJson,
    `'@`,
    `Register-ArgumentCompleter -Native -CommandName '${program}' -ScriptBlock {`,
    `  param($wordToComplete, $commandAst, $cursorPosition)`,
    `  $tokens = @($commandAst.CommandElements | Select-Object -Skip 1 | ForEach-Object { $_.Extent.Text })`,
    `  $node = $__clilyCompletionTree`,
    `  if ($tokens.Count -gt 0) {`,
    `    foreach ($token in $tokens[0..([Math]::Max(0, $tokens.Count - 2))]) {`,
    `      if ($node -and $node.PSObject.Properties[$token]) {`,
    `        $node = $node.PSObject.Properties[$token].Value`,
    `      } else {`,
    `        break`,
    `      }`,
    `    }`,
    `  }`,
    `  $candidates = @()`,
    `  if ($node -is [System.Array]) {`,
    `    $candidates = @($node)`,
    `  } elseif ($node) {`,
    `    $candidates = @($node.PSObject.Properties | ForEach-Object { $_.Name })`,
    `  }`,
    `  $candidates | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {`,
    `    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)`,
    `  }`,
    `}`,
  ].join('\n')
}

export function generateCompletionScript(
  program: string,
  tree: CompletionTree,
  shell: CompletionShell,
): string {
  if (shell === 'pwsh') {
    return generatePwshCompletionScript(program, tree)
  }

  const completion = omelette(program).tree(tree)
  return shell === 'fish'
    ? completion.generateCompletionCodeFish()
    : completion.generateCompletionCode()
}

export function resolveCompletionShell(
  requestedShell: string | undefined,
  completion: Required<CompletionConfig> | null,
  environment: ExecutionEnvironment,
): CompletionShell {
  const supportedShells = completion?.shells ?? ['bash', 'zsh', 'fish', 'pwsh']

  if (requestedShell) {
    if (supportedShells.includes(requestedShell as CompletionShell)) {
      return requestedShell as CompletionShell
    }
    throw new Error(
      `Unsupported completion shell "${requestedShell}". Supported shells: ${supportedShells.join(', ')}`,
    )
  }

  if (completion?.shell && completion.shell !== 'auto') {
    return completion.shell
  }

  if (environment.shell && supportedShells.includes(environment.shell)) {
    return environment.shell
  }

  return supportedShells[0] ?? 'bash'
}

export function extractCompletionShellArg(
  argv: readonly string[],
  completionCommandNames: string[],
): string | undefined {
  const completionIndex = argv.findIndex((arg) => completionCommandNames.includes(arg))
  if (completionIndex < 0) {
    return undefined
  }

  const candidate = argv[completionIndex + 1]
  if (!candidate || candidate.startsWith('-')) {
    return undefined
  }

  return candidate
}

export function isCompletionCommand(
  argv: readonly string[],
  completionCommandNames: string[],
): boolean {
  return argv.some((arg) => completionCommandNames.includes(arg))
}
