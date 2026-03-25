import type { StandardSchemaV1 } from '@standard-schema/spec'

export type ClilyExitReason = 'cancelled' | 'runtime-error' | 'validation'

export interface ClilyCommandErrorOptions {
  code: number
  reason: ClilyExitReason
  message: string
  issues?: readonly StandardSchemaV1.Issue[]
  silent?: boolean
  cause?: unknown
}

export class ClilyCommandError extends Error {
  readonly code: number
  readonly reason: ClilyExitReason
  readonly issues?: readonly StandardSchemaV1.Issue[]
  readonly silent: boolean

  constructor(options: ClilyCommandErrorOptions) {
    super(options.message, { cause: options.cause })
    this.name = 'ClilyCommandError'
    this.code = options.code
    this.reason = options.reason
    this.issues = options.issues
    this.silent = options.silent ?? false
  }
}

export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}
