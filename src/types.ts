import type { StandardSchemaV1 } from '@standard-schema/spec'

// ─── JSON Schema Types (Internal Representation) ────────

/** A property within a JSON Schema object. */
export interface JsonSchemaProperty {
  type?: string
  description?: string
  default?: unknown
  enum?: unknown[]
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

/** A JSON Schema object type used as the internal metadata format. */
export interface JsonSchema {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required: string[]
}

// ─── Type Inference Helpers ──────────────────────────────

/** Simplify an intersection type for readability. */
export type Prettify<T> = { [K in keyof T]: T[K] } & {}

/** Infer the output type of a Standard Schema. */
export type InferOutput<S> = S extends StandardSchemaV1<infer _I, infer O> ? O : {}

/** Merge the output types of two optional Standard Schemas. */
export type MergedOutput<
  TFlags extends StandardSchemaV1 | undefined,
  TArgs extends StandardSchemaV1 | undefined,
> = Prettify<
  (TFlags extends StandardSchemaV1 ? InferOutput<TFlags> : {}) &
    (TArgs extends StandardSchemaV1 ? InferOutput<TArgs> : {})
>

// ─── Hooks ───────────────────────────────────────────────

export interface ClilyHooks {
  onParse?: (rawArgs: string[]) => void | Promise<void>
  onValidate?: (resolvedConfig: Record<string, unknown>) => void | Promise<void>
  onError?: (err: Error) => void | Promise<void>
  onExit?: (request: ClilyExitRequest) => void | Promise<void>
  onValidationError?: (issues: readonly StandardSchemaV1.Issue[]) => void | Promise<void>
  onPromptSelect?: (missingKeys: string[]) => void | Promise<void>
  onHelp?: (helpText: string) => string | void | Promise<string | void>
}

export interface ClilyExitRequest {
  code: number
  error?: Error
  reason: 'cancelled' | 'runtime-error' | 'validation'
}

export interface ClilyRuntime {
  argv: readonly string[]
  env: Record<string, string | undefined>
  cwd: () => string
  stdout: (message: string) => void | Promise<void>
  debug: (message: string, payload?: unknown) => void | Promise<void>
  error: (message: string | Error) => void | Promise<void>
  exit: (request: ClilyExitRequest) => void | Promise<void>
}

export type CompletionShell = 'bash' | 'zsh' | 'fish' | 'pwsh'

export interface CompletionConfig {
  command?: string
  aliases?: string[]
  shell?: CompletionShell | 'auto'
  shells?: CompletionShell[]
}

export interface ExecutionEnvironment {
  shell: CompletionShell | null
  runtime: string
  isNode: boolean
  isBun: boolean
  isDeno: boolean
  hasTTY: boolean
  isCI: boolean
  isDebug: boolean
  isColorSupported: boolean
}

// ─── Child Command Config ────────────────────────────────

type ChildCommandShape = {
  args?: StandardSchemaV1
  children?: Record<string, ChildCommandShape>
}

type ExtractChildArgs<TChild> = TChild extends { args: infer A extends StandardSchemaV1 }
  ? A
  : undefined

type ExtractChildChildren<TChild> = TChild extends {
  children: infer TChildren extends Record<string, ChildCommandShape>
}
  ? TChildren
  : Record<never, never>

/** Simplified child config for deeply nested subcommands. */
export interface ClilyChildSimple<
  TParentFlags extends StandardSchemaV1 | undefined = undefined,
  TArgs extends StandardSchemaV1 | undefined = undefined,
  TChildren extends Record<string, ChildCommandShape> = Record<never, never>,
> {
  description?: string
  args?: TArgs
  positionals?: StandardSchemaV1
  hooks?: ClilyHooks
  handler?: (args: MergedOutput<TParentFlags, TArgs>) => void | Promise<void>
  children?: TChildren & TypedChildren<TParentFlags, TChildren>
}

/** Type-safe children map: each child handler receives merged parent flags + own args. */
export type TypedChildren<
  TFlags extends StandardSchemaV1 | undefined,
  TChildren extends Record<string, ChildCommandShape>,
> = {
  [K in keyof TChildren]: ClilyChildSimple<
    TFlags,
    ExtractChildArgs<TChildren[K]>,
    ExtractChildChildren<TChildren[K]>
  >
}

/** Root configuration for the clily CLI framework. */
export interface ClilyOptions<
  TFlags extends StandardSchemaV1 | undefined = undefined,
  TArgs extends StandardSchemaV1 | undefined = undefined,
  TChildren extends Record<string, ChildCommandShape> = Record<never, never>,
> {
  name: string
  version?: string
  description?: string
  debug?: boolean
  flags?: TFlags
  args?: TArgs
  positionals?: StandardSchemaV1
  plugins?: unknown[]
  completion?: boolean | CompletionConfig
  runtime?: Partial<ClilyRuntime>
  hooks?: ClilyHooks
  handler?: (args: MergedOutput<TFlags, TArgs>) => void | Promise<void>
  children?: TChildren & TypedChildren<TFlags, TChildren>
}
