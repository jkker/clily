import { tagLogger } from '../logger.ts'
import type { ClilyCommandNode } from '../tree.ts'
import type { AnyClilyCommand, ClilyLogger } from '../types.ts'
import type { ResolvedCommandInput } from './types.ts'

/** Execute a resolved command node with plugins and command lifecycle hooks. */
export async function executeCommandNode(options: {
  node: ClilyCommandNode
  rawArgs: string[]
  resolvedInput: ResolvedCommandInput
  logger: ClilyLogger
}): Promise<void> {
  const context: Parameters<NonNullable<AnyClilyCommand['run']>>[0] = {
    meta: options.node.meta,
    commandPath: options.node.path,
    rawArgs: options.rawArgs,
    args: options.resolvedInput.args,
    positionals: options.resolvedInput.positionals,
    logger: tagLogger(options.logger, options.node.path.slice(1).join(':')),
  }

  let lifecycleError: unknown

  try {
    for (const plugin of options.node.command.plugins ?? []) await plugin.setup?.(context)
    await options.node.command.setup?.(context)
    await options.node.command.run?.(context)
  } catch (error) {
    lifecycleError = error
  } finally {
    try {
      await options.node.command.cleanup?.(context)
    } catch (error) {
      lifecycleError ??= error
    }

    for (const plugin of (options.node.command.plugins ?? []).toReversed()) {
      try {
        await plugin.cleanup?.(context)
      } catch (error) {
        lifecycleError ??= error
      }
    }
  }

  if (lifecycleError) throw lifecycleError
}
