import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec'

/** Empty object shape used when a command omits named `args`. */
export type Empty = Record<never, never>

/** Infer the runtime output type of a Standard Schema. */
export type InferOutput<TSchema> =
  TSchema extends StandardSchemaV1<infer _TInput, infer TOutput> ? TOutput : Empty

/** Combined Standard Schema + Standard JSON Schema contract accepted by clily. */
export interface ClilySchema<Input = unknown, Output = Input> {
  /** Shared standard metadata used for validation and JSON Schema conversion. */
  readonly '~standard': StandardSchemaV1.Props<Input, Output> &
    StandardJSONSchemaV1.Props<Input, Output>
}

/** Object schema used for named command arguments. */
export type ClilyArgsSchema = ClilySchema<Record<string, unknown>, Record<string, unknown>>

/** Primitive or primitive-array schema used for positional input. */
export type ClilyPositionalSchema = ClilySchema

/** Infer the `args` payload for a command context. */
export type InferArgsOutput<TArgs> = TArgs extends ClilyArgsSchema ? InferOutput<TArgs> : Empty

/** Infer the `positionals` payload for a command context. */
export type InferPositionalsOutput<TPositionals> = TPositionals extends ClilyPositionalSchema
  ? InferOutput<TPositionals>
  : undefined

/** Logger contract threaded through clily and backed by `consola` by default. */
export interface ClilyLogger {
  /** Emit an unstyled log message. */
  log: (...args: unknown[]) => void

  /** Emit an informational log message. */
  info: (...args: unknown[]) => void

  /** Emit a success log message. */
  success: (...args: unknown[]) => void

  /** Emit a warning log message. */
  warn: (...args: unknown[]) => void

  /** Emit an error log message. */
  error: (...args: unknown[]) => void

  /** Emit a debug log message. */
  debug: (...args: unknown[]) => void

  /** Optional pretty log type supported by the default consola logger. */
  start?: (...args: unknown[]) => void

  /** Optional pretty log type supported by the default consola logger. */
  ready?: (...args: unknown[]) => void

  /** Optional pretty log type supported by the default consola logger. */
  box?: (...args: unknown[]) => void

  /** Create a tagged child logger when supported by the implementation. */
  withTag?: (tag: string) => ClilyLogger
}

/** Flattened command metadata accepted directly on command config objects. */
export interface ClilyCommandMeta {
  /** Stable command identifier used in usage output. */
  name?: string

  /** Human-readable version string shown by `--version`. */
  version?: string

  /** Short command summary used in help output. */
  description?: string

  /** Alternate command names accepted at the same depth. */
  alias?: string | string[]

  /** Whether this command should be hidden from generated help. */
  hidden?: boolean
}

/** Built-in completion command configuration. */
export interface CompletionConfig {
  /** Primary built-in command name. */
  command?: string

  /** Additional built-in aliases. */
  aliases?: string[]

  /** Short description shown in generated help. */
  description?: string
}

/** Context passed to `setup`, `cleanup`, `run`, and plugins. */
export interface ClilyCommandContext<
  TArgs extends ClilyArgsSchema | undefined = undefined,
  TPositionals extends ClilyPositionalSchema | undefined = undefined,
> {
  /** Resolved command metadata for the executed command. */
  meta: ClilyCommandMeta & { name: string }

  /** Full command path including the root command name. */
  commandPath: string[]

  /** Raw argv slice used to invoke the executed command. */
  rawArgs: string[]

  /** Resolved named arguments after CLI, env, config, defaults, prompts, and validation. */
  args: InferArgsOutput<TArgs>

  /** Resolved positional payload after CLI parsing, prompting, defaults, and validation. */
  positionals: InferPositionalsOutput<TPositionals>

  /** Logger scoped to the active command. */
  logger: ClilyLogger
}

/** Reusable lifecycle hooks that run around a command. */
export interface ClilyPlugin<
  TArgs extends ClilyArgsSchema | undefined = undefined,
  TPositionals extends ClilyPositionalSchema | undefined = undefined,
> {
  /** Optional plugin identifier used only for debugging. */
  name?: string

  /** Hook that runs before the command's own `setup` and `run`. */
  setup?: (context: ClilyCommandContext<TArgs, TPositionals>) => void | Promise<void>

  /** Hook that runs after the command's own `cleanup`, in reverse plugin order. */
  cleanup?: (context: ClilyCommandContext<TArgs, TPositionals>) => void | Promise<void>
}

/** Command definition accepted by nested `subCommands`. */
export interface ClilyCommand<
  TArgs extends ClilyArgsSchema | undefined = undefined,
  TPositionals extends ClilyPositionalSchema | undefined = undefined,
  TSubCommands extends Record<string, unknown> = Record<never, never>,
> extends ClilyCommandMeta {
  /** Named option schema for this command. Must resolve to a JSON Schema object. */
  args?: TArgs

  /** Positional schema for this command. Must resolve to a primitive or primitive array. */
  positionals?: TPositionals

  /** Reusable lifecycle hooks that wrap this command. */
  plugins?: Array<ClilyPlugin<TArgs, TPositionals>>

  /** Hook invoked immediately before validation output reaches `run`. */
  setup?: (context: ClilyCommandContext<TArgs, TPositionals>) => void | Promise<void>

  /** Hook invoked after `run`, even when `run` throws. */
  cleanup?: (context: ClilyCommandContext<TArgs, TPositionals>) => void | Promise<void>

  /** Command body executed when this command is the resolved target. */
  run?: (context: ClilyCommandContext<TArgs, TPositionals>) => void | Promise<void>

  /** Nested subcommand tree. */
  subCommands?: TSubCommands & Record<string, ClilyCommandShape>
}

/** Backwards-friendly alias for a nested command definition. */
export interface ClilyCommandShape {
  /** Stable command identifier used in usage output. */
  name?: string

  /** Human-readable version string shown by `--version`. */
  version?: string

  /** Short command summary used in help output. */
  description?: string

  /** Alternate command names accepted at the same depth. */
  alias?: string | string[]

  /** Whether this command should be hidden from generated help. */
  hidden?: boolean

  /** Named option schema for this command. Must resolve to a JSON Schema object. */
  args?: ClilyArgsSchema

  /** Positional schema for this command. Must resolve to a primitive or primitive array. */
  positionals?: ClilyPositionalSchema

  /** Reusable lifecycle hooks that wrap this command. */
  plugins?: unknown

  /** Hook invoked immediately before validation output reaches `run`. */
  setup?: unknown

  /** Hook invoked after `run`, even when `run` throws. */
  cleanup?: unknown

  /** Command body executed when this command is the resolved target. */
  run?: unknown

  /** Nested subcommand tree. */
  subCommands?: Record<string, ClilyCommandShape>
}

/** Root command definition accepted by `clily()`. */
export interface ClilyRootCommand<
  TArgs extends ClilyArgsSchema | undefined = undefined,
  TPositionals extends ClilyPositionalSchema | undefined = undefined,
  TSubCommands extends Record<string, unknown> = Record<never, never>,
> extends ClilyCommand<TArgs, TPositionals, TSubCommands> {
  /** Root command name. */
  name: string

  /** Built-in completion command configuration. */
  completion?: boolean | CompletionConfig

  /** Optional root logger override. Defaults to a tagged `consola` instance. */
  logger?: ClilyLogger
}

/** Fully-erased command type used internally after the public API has been inferred. */
export interface AnyClilyCommand {
  /** Stable command identifier used in usage output. */
  name?: string

  /** Human-readable version string shown by `--version`. */
  version?: string

  /** Short command summary used in help output. */
  description?: string

  /** Alternate command names accepted at the same depth. */
  alias?: string | string[]

  /** Whether this command should be hidden from generated help. */
  hidden?: boolean

  /** Named option schema for this command. */
  args?: ClilyArgsSchema

  /** Positional schema for this command. */
  positionals?: ClilyPositionalSchema

  /** Reusable lifecycle hooks that wrap this command. */
  plugins?: Array<ClilyPlugin<ClilyArgsSchema, ClilyPositionalSchema>>

  /** Hook invoked before `run`. */
  setup?: (
    context: ClilyCommandContext<ClilyArgsSchema, ClilyPositionalSchema>,
  ) => void | Promise<void>

  /** Hook invoked after `run`. */
  cleanup?: (
    context: ClilyCommandContext<ClilyArgsSchema, ClilyPositionalSchema>,
  ) => void | Promise<void>

  /** Command body executed when this command is the resolved target. */
  run?: (
    context: ClilyCommandContext<ClilyArgsSchema, ClilyPositionalSchema>,
  ) => void | Promise<void>

  /** Nested subcommand tree. */
  subCommands?: Record<string, AnyClilyCommand>
}

/** Fully-erased root command type used internally after the public API has been inferred. */
export interface AnyClilyRootCommand extends AnyClilyCommand {
  /** Root command name. */
  name: string

  /** Built-in completion command configuration. */
  completion?: boolean | CompletionConfig

  /** Optional root logger override. */
  logger?: ClilyLogger
}
