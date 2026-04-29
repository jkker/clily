import type { JSONSchema7 } from 'json-schema'

export type LayerName = 'cli' | 'env' | 'config' | 'defaults' | 'prompt'

/** Individually testable resolved input layer. */
export interface CommandInputLayer {
  /** Layer name in merge order. */
  name: LayerName

  /** Coerced value contributed by this layer. */
  value: Record<string, unknown>
}

/** Parse-stage command input before final schema validation. */
export interface ParsedCommandInput {
  /** Active args JSON Schema metadata, when present. */
  argsSchema?: JSONSchema7

  /** Active positional JSON Schema metadata, when present. */
  positionalsSchema?: JSONSchema7

  /** Coerced named args before final Standard Schema validation. */
  args: Record<string, unknown>

  /** Coerced positional payload before final Standard Schema validation. */
  positionals: unknown

  /** Raw positional tokens captured after named option parsing. */
  positionalTokens: string[]

  /** Individually testable input layers. */
  layers: {
    cli: CommandInputLayer
    env: CommandInputLayer
    config: CommandInputLayer
    defaults: CommandInputLayer
  }
}

/** Fully resolved command input, including per-layer state for isolated tests. */
export interface ResolvedCommandInput {
  /** Resolved named args after merge, prompt, and final validation. */
  args: Record<string, unknown>

  /** Resolved positional payload after coercion, prompt, and final validation. */
  positionals: unknown

  /** Raw positional tokens captured after named option parsing. */
  positionalTokens: string[]

  /** Individually testable input layers. */
  layers: {
    cli: CommandInputLayer
    env: CommandInputLayer
    config: CommandInputLayer
    defaults: CommandInputLayer
    prompt?: CommandInputLayer
  }
}
