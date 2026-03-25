/**
 * External runtime boundary for clily.
 *
 * This module centralizes direct access to process globals and default CLI I/O.
 * Command execution should depend on this runtime abstraction instead of touching
 * process, console, or consola directly.
 */
import consola from 'consola'

import type { ClilyRuntime } from './types.ts'

const defaultCwd = (): string => process.cwd()

const defaultRuntime: ClilyRuntime = {
  argv: process.argv,
  env: process.env,
  cwd: defaultCwd,
  stdout: (message) => {
    console.log(message)
  },
  debug: (message, payload) => {
    if (payload === undefined) {
      consola.debug(message)
      return
    }

    consola.debug(message, payload)
  },
  error: (message) => {
    consola.error(message)
  },
  exit: ({ code }) => {
    process.exit(code)
  },
}

export function createRuntime(overrides: Partial<ClilyRuntime> = {}): ClilyRuntime {
  return {
    ...defaultRuntime,
    ...overrides,
    argv: overrides.argv ?? process.argv,
    env: overrides.env ?? process.env,
    cwd: overrides.cwd ?? defaultCwd,
  }
}
