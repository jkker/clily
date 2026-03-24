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
  onValidationError?: (issues: readonly StandardSchemaV1.Issue[]) => void | Promise<void>
  onPromptSelect?: (missingKeys: string[]) => void | Promise<void>
  onHelp?: (helpText: string) => string | void | Promise<string | void>
}

// ─── Child Command Config ────────────────────────────────

/** Simplified child config for deeply nested subcommands. */
export interface ClilyChildSimple<TParentFlags extends StandardSchemaV1 | undefined = undefined> {
  description?: string
  args?: StandardSchemaV1
  positionals?: StandardSchemaV1
  hooks?: ClilyHooks
  handler?: (
    args: TParentFlags extends StandardSchemaV1
      ? Prettify<InferOutput<TParentFlags> & Record<string, unknown>>
      : Record<string, unknown>,
  ) => void | Promise<void>
  children?: Record<string, ClilyChildSimple<TParentFlags>>
}

/** Type-safe children map: each child handler receives merged parent flags + own args. */
export type TypedChildren<
  TFlags extends StandardSchemaV1 | undefined,
  TChildren extends Record<string, { args?: StandardSchemaV1 }>,
> = {
  [K in keyof TChildren]: {
    description?: string
    args?: TChildren[K]['args']
    positionals?: StandardSchemaV1
    hooks?: ClilyHooks
    handler?: (
      args: MergedOutput<
        TFlags,
        TChildren[K] extends { args: infer A extends StandardSchemaV1 } ? A : undefined
      >,
    ) => void | Promise<void>
    children?: Record<string, ClilyChildSimple<TFlags>>
  }
}

/** Root configuration for the clily CLI framework. */
export interface ClilyOptions<
  TFlags extends StandardSchemaV1 | undefined = undefined,
  TArgs extends StandardSchemaV1 | undefined = undefined,
  TChildren extends Record<string, { args?: StandardSchemaV1 }> = Record<never, never>,
> {
  name: string
  version?: string
  description?: string
  debug?: boolean
  flags?: TFlags
  args?: TArgs
  positionals?: StandardSchemaV1
  plugins?: unknown[]
  hooks?: ClilyHooks
  handler?: (args: MergedOutput<TFlags, TArgs>) => void | Promise<void>
  children?: TypedChildren<TFlags, TChildren>
}
