import { hasTTY, isBun, isCI, isColorSupported, isDebug, isDeno, isNode, runtime } from 'std-env'

import type { CompletionShell, ExecutionEnvironment } from './types.ts'

/**
 * Environment variable resolution for clily.
 *
 * Maps environment variables with a given prefix to camelCase config keys.
 * Example: name='mycli' → prefix='MYCLI_', MYCLI_API_KEY → apiKey
 */

/**
 * Convert a CLI name to an environment variable prefix.
 * e.g., 'my-cli' → 'MY_CLI_'
 */
export function toEnvPrefix(name: string): string {
  return `${name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_`
}

/**
 * Convert a SCREAMING_SNAKE_CASE env var suffix to camelCase.
 * e.g., 'API_KEY' → 'apiKey', 'DRY_RUN' → 'dryRun'
 */
export function envKeyToCamel(envKey: string): string {
  return envKey.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Convert a camelCase key to SCREAMING_SNAKE_CASE.
 * e.g., 'apiKey' → 'API_KEY', 'dryRun' → 'DRY_RUN'
 */
export function camelToEnvKey(camelKey: string): string {
  return camelKey.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()
}

/**
 * Resolve environment variables that match the given prefix and return
 * a camelCase-keyed object of their values.
 */
export function resolveEnvVars(
  name: string,
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const prefix = toEnvPrefix(name)
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(prefix) && value !== undefined) {
      const suffix = key.slice(prefix.length)
      if (suffix.length > 0) {
        result[envKeyToCamel(suffix)] = value
      }
    }
  }

  return result
}

export function inferShell(
  env: Record<string, string | undefined> = process.env,
): CompletionShell | null {
  const shell = env.SHELL?.toLowerCase()
  if (shell?.includes('bash')) return 'bash'
  if (shell?.includes('zsh')) return 'zsh'
  if (shell?.includes('fish')) return 'fish'
  if (
    shell?.includes('pwsh') ||
    shell?.includes('powershell') ||
    env.TERM_PROGRAM?.toLowerCase().includes('powershell') ||
    env.PSModulePath
  ) {
    return 'pwsh'
  }

  return null
}

export function getExecutionEnvironment(
  env: Record<string, string | undefined> = process.env,
): ExecutionEnvironment {
  return {
    shell: inferShell(env),
    runtime,
    isNode,
    isBun,
    isDeno,
    hasTTY,
    isCI,
    isDebug,
    isColorSupported,
  }
}
