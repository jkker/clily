import { createConsola } from 'consola'

import type { ClilyLogger } from './types.ts'

/** Create the default pretty logger used by clily when the user does not provide one. */
export const createDefaultLogger = (tag?: string): ClilyLogger => {
  const logger = createConsola() as unknown as ClilyLogger
  return tag && logger.withTag ? logger.withTag(tag) : logger
}

/** Create a tagged child logger when the underlying implementation supports tags. */
export const tagLogger = (logger: ClilyLogger, tag?: string): ClilyLogger => {
  if (!tag || !logger.withTag) return logger
  return logger.withTag(tag)
}
