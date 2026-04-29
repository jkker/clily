import type { StandardSchemaV1 } from '@standard-schema/spec'

/** Error categories clily can surface while resolving a command. */
export type ClilyErrorKind = 'cancelled' | 'runtime' | 'usage' | 'validation'

/** Construction options for {@link ClilyError}. */
export interface ClilyErrorOptions {
  exitCode?: number
  kind: ClilyErrorKind
  message: string
  issues?: readonly StandardSchemaV1.Issue[]
  silent?: boolean
  cause?: unknown
}

/** Structured error type used by the clily runtime. */
export class ClilyError extends Error {
  readonly exitCode: number
  readonly kind: ClilyErrorKind
  readonly issues?: readonly StandardSchemaV1.Issue[]
  readonly silent: boolean

  constructor(options: ClilyErrorOptions) {
    super(options.message, { cause: options.cause })
    this.name = 'ClilyError'
    this.exitCode = options.exitCode ?? (options.kind === 'cancelled' ? 0 : 1)
    this.kind = options.kind
    this.issues = options.issues
    this.silent = options.silent ?? false
  }
}

/** Normalize unknown thrown values into proper Error instances. */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}
