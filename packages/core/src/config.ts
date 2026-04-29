/**
 * Config file resolution via c12.
 *
 * Loads and merges config from local/global config files, .rc files, and .env.
 */
import { loadConfig } from 'c12'

class ClilyConfigLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ClilyConfigLoadError'
  }
}

export interface LoadClilyConfigOptions {
  name: string
  cwd?: string
}

type MaybeConfigLoadError = {
  code?: string
  message?: string
}

function shouldIgnoreConfigLoadError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const maybeError = error as MaybeConfigLoadError
  if (maybeError.code === 'ENOENT' || maybeError.code === 'ENOTDIR') return true

  const message = maybeError.message?.toLowerCase()
  return message?.includes('file not found') === true || message?.includes('no such file') === true
}

/** Read the config subtree for the executed command path from the root c12 payload. */
export function getCommandConfig(
  config: Record<string, unknown>,
  commandPath: string[],
): Record<string, unknown> {
  let current: unknown = config
  for (const segment of commandPath) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return {}
    current = (current as Record<string, unknown>)[segment]
  }

  if (typeof current !== 'object' || current === null || Array.isArray(current)) return {}
  return current as Record<string, unknown>
}

/**
 * Load configuration using c12, searching for config files matching the CLI name.
 * e.g., name='mycli' will look for mycli.config.ts, mycli.config.js, .myclirc, etc.
 */
export async function loadClilyConfig(
  options: LoadClilyConfigOptions,
): Promise<Record<string, unknown>> {
  try {
    const { config } = await loadConfig({
      name: options.name,
      cwd: options.cwd ?? process.cwd(),
      dotenv: true,
      packageJson: true,
    })

    return (config as Record<string, unknown>) ?? {}
  } catch (error) {
    if (shouldIgnoreConfigLoadError(error)) return {}

    throw new ClilyConfigLoadError(
      `Failed to load config for command "${options.name}" from cwd "${options.cwd ?? process.cwd()}".`,
      { cause: error },
    )
  }
}
