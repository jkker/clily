import { defu } from 'defu'
import * as v from 'valibot'
import { describe, expect, test } from 'vite-plus/test'

import { normalizeArgs } from '../src/args.ts'
import { resolveEnvVars } from '../src/env.ts'
import { generateHelp } from '../src/help.ts'
import {
  getMissingRequiredKeys,
  getSchemaDefaults,
  getSchemaEntries,
  validateSchema,
} from '../src/schema.ts'

/**
 * Integration tests that test the full config resolution pipeline
 * without relying on process.argv or actual CLI execution.
 */

describe('Config Resolution Pipeline', () => {
  const flagsSchema = v.object({
    verbose: v.optional(v.boolean(), false),
    logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
  })

  const argsSchema = v.object({
    apiKey: v.string(),
    dryRun: v.optional(v.boolean(), false),
  })

  test('Scenario A: Perfectly Configured Run', async () => {
    // Simulate: config file has logLevel, env has apiKey, CLI has dryRun
    const cliArgs = normalizeArgs({ 'dry-run': true })
    const envVars = resolveEnvVars('mycli', {
      MYCLI_API_KEY: 'sk_live_123',
    })
    const fileConfig = { logLevel: 'debug' }
    const flagDefaults = getSchemaDefaults(flagsSchema)
    const argDefaults = getSchemaDefaults(argsSchema)
    const schemaDefaults = { ...flagDefaults, ...argDefaults }

    // Merge in priority order
    const merged = defu(cliArgs, envVars, fileConfig, schemaDefaults)

    // Validate against schemas
    const flagResult = await validateSchema(flagsSchema, merged)
    expect(flagResult.success).toBe(true)

    const argResult = await validateSchema(argsSchema, merged)
    expect(argResult.success).toBe(true)

    // Final resolved config
    expect(merged).toEqual({
      dryRun: true,
      apiKey: 'sk_live_123',
      logLevel: 'debug',
      verbose: false,
    })
  })

  test('Scenario B: Missing Required Args (validation fails)', async () => {
    // No config files, no env vars, no CLI args
    const cliArgs = normalizeArgs({})
    const envVars = resolveEnvVars('mycli', {})
    const fileConfig = {}
    const flagDefaults = getSchemaDefaults(flagsSchema)
    const argDefaults = getSchemaDefaults(argsSchema)
    const schemaDefaults = { ...flagDefaults, ...argDefaults }

    const merged = defu(cliArgs, envVars, fileConfig, schemaDefaults)

    // Flags should pass (all have defaults)
    const flagResult = await validateSchema(flagsSchema, merged)
    expect(flagResult.success).toBe(true)

    // Args should fail (apiKey is required)
    const argResult = await validateSchema(argsSchema, merged)
    expect(argResult.success).toBe(false)
    expect(argResult.issues).toBeDefined()

    // Identify missing keys
    const missingKeys = getMissingRequiredKeys(argsSchema, merged)
    expect(missingKeys).toEqual(['apiKey'])
  })

  test('Scenario C: Invalid type (validation error)', async () => {
    // Invalid boolean value
    const cliArgs = { dryRun: 'abc' }
    const envVars = resolveEnvVars('mycli', {})
    const fileConfig = {}
    const schemaDefaults = {
      ...getSchemaDefaults(flagsSchema),
      ...getSchemaDefaults(argsSchema),
    }

    const merged = defu(cliArgs, envVars, fileConfig, schemaDefaults)

    const argResult = await validateSchema(argsSchema, merged)
    expect(argResult.success).toBe(false)
  })

  test('CLI args take highest priority', () => {
    const cliArgs = { logLevel: 'warn' }
    const envVars = { logLevel: 'error' }
    const fileConfig = { logLevel: 'debug' }
    const schemaDefaults = { logLevel: 'info' }

    const merged = defu(cliArgs, envVars, fileConfig, schemaDefaults)
    expect(merged.logLevel).toBe('warn')
  })

  test('Env vars take second priority', () => {
    const cliArgs = {}
    const envVars = { logLevel: 'error' }
    const fileConfig = { logLevel: 'debug' }
    const schemaDefaults = { logLevel: 'info' }

    const merged = defu(cliArgs, envVars, fileConfig, schemaDefaults)
    expect(merged.logLevel).toBe('error')
  })

  test('File config takes third priority', () => {
    const cliArgs = {}
    const envVars = {}
    const fileConfig = { logLevel: 'debug' }
    const schemaDefaults = { logLevel: 'info' }

    const merged = defu(cliArgs, envVars, fileConfig, schemaDefaults)
    expect(merged.logLevel).toBe('debug')
  })

  test('Schema defaults are lowest priority', () => {
    const cliArgs = {}
    const envVars = {}
    const fileConfig = {}
    const schemaDefaults = { logLevel: 'info' }

    const merged = defu(cliArgs, envVars, fileConfig, schemaDefaults)
    expect(merged.logLevel).toBe('info')
  })
})

describe('Help Generation Integration', () => {
  test('generates comprehensive help for a CLI with flags, args, and children', () => {
    const help = generateHelp({
      name: 'mycli',
      version: '1.2.0',
      description: 'A modern CLI framework',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
        logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
      }),
      args: v.object({
        ci: v.optional(v.boolean(), false),
      }),
      children: {
        deploy: {
          description: 'Deploy the project',
        },
        init: {
          description: 'Initialize a new project',
        },
      },
    })

    // Check header
    expect(help).toContain('mycli')
    expect(help).toContain('v1.2.0')
    expect(help).toContain('A modern CLI framework')

    // Check usage
    expect(help).toContain('USAGE:')
    expect(help).toContain('mycli <command> [options]')

    // Check global flags
    expect(help).toContain('GLOBAL FLAGS:')
    expect(help).toContain('--verbose')
    expect(help).toContain('--log-level')

    // Check options
    expect(help).toContain('OPTIONS:')
    expect(help).toContain('--ci')

    // Check commands
    expect(help).toContain('COMMANDS:')
    expect(help).toContain('deploy')
    expect(help).toContain('init')
  })
})

describe('Type Coercion', () => {
  test('coerces string "true" to boolean true during validation', async () => {
    const schema = v.object({
      dryRun: v.optional(v.boolean(), false),
    })

    // After coercion, "true" should become true
    const data = { dryRun: true }
    const result = await validateSchema(schema, data)
    expect(result.success).toBe(true)
    expect(result.value).toEqual({ dryRun: true })
  })

  test('validates picklist values', async () => {
    const schema = v.object({
      logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
    })

    const result = await validateSchema(schema, { logLevel: 'debug' })
    expect(result.success).toBe(true)

    const invalidResult = await validateSchema(schema, {
      logLevel: 'invalid',
    })
    expect(invalidResult.success).toBe(false)
  })
})

describe('Schema Introspection with Complex Types', () => {
  test('handles nested optional with picklist', () => {
    const schema = v.object({
      level: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
    })

    const entries = getSchemaEntries(schema)
    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('level')
    expect(entries[0].type).toBe('string')
    expect(entries[0].required).toBe(false)
    expect(entries[0].default).toBe('info')
  })

  test('handles schema with all optional fields', async () => {
    const schema = v.object({
      a: v.optional(v.string()),
      b: v.optional(v.boolean()),
      c: v.optional(v.number()),
    })

    const result = await validateSchema(schema, {})
    expect(result.success).toBe(true)

    const missing = getMissingRequiredKeys(schema, {})
    expect(missing).toEqual([])
  })

  test('handles schema with all required fields', async () => {
    const schema = v.object({
      name: v.string(),
      age: v.number(),
    })

    const missing = getMissingRequiredKeys(schema, {})
    expect(missing).toEqual(['name', 'age'])
  })
})
