/**
 * Config file resolution via c12.
 *
 * Loads and merges config from local/global config files, .rc files, and .env.
 */
import { loadConfig } from 'c12'

export interface LoadClilyConfigOptions {
  name: string
  cwd?: string
}

/**
 * Load configuration using c12, searching for config files matching the CLI name.
 * e.g., name='mycli' will look for mycli.config.ts, mycli.config.js, .myclirc, etc.
 */
export async function loadClilyConfig(
  options: LoadClilyConfigOptions,
): Promise<Record<string, unknown>> {
  const { config } = await loadConfig({
    name: options.name,
    cwd: options.cwd ?? process.cwd(),
    rcFile: `.${options.name}rc`,
    globalRc: true,
    dotenv: true,
    packageJson: true,
  })

  return (config as Record<string, unknown>) ?? {}
}
