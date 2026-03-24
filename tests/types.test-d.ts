/**
 * Type-level tests for clily's generic type inference.
 *
 * These tests verify that handler parameter types are correctly inferred
 * from Standard Schema definitions using Valibot and Zod.
 *
 * Run with: vp test --typecheck
 */
import * as v from 'valibot'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { object, string, number, boolean } from 'zod'

import type { InferOutput, MergedOutput } from '../src/types.ts'

// ─── InferOutput ─────────────────────────────────────────

describe('InferOutput', () => {
  test('infers Valibot object output type', () => {
    const schema = v.object({
      name: v.string(),
      count: v.optional(v.number(), 0),
    })

    type Result = InferOutput<typeof schema>

    expectTypeOf<Result>().toEqualTypeOf<{
      name: string
      count: number
    }>()
  })

  test('infers Zod object output type', () => {
    const schema = object({
      name: string(),
      count: number().default(0),
    })

    type Result = InferOutput<typeof schema>

    expectTypeOf<Result>().toEqualTypeOf<{
      name: string
      count: number
    }>()
  })

  test('infers {} for undefined schema', () => {
    type Result = InferOutput<undefined>

    expectTypeOf<Result>().toEqualTypeOf<{}>()
  })
})

// ─── MergedOutput ────────────────────────────────────────

describe('MergedOutput', () => {
  test('merges two Valibot schemas', () => {
    const flags = v.object({
      verbose: v.optional(v.boolean(), false),
    })
    const args = v.object({
      apiKey: v.string(),
    })

    type Result = MergedOutput<typeof flags, typeof args>

    expectTypeOf<Result>().toMatchTypeOf<{
      verbose: boolean
      apiKey: string
    }>()
  })

  test('merges Valibot flags with Zod args', () => {
    const flags = v.object({
      verbose: v.optional(v.boolean(), false),
    })
    const args = object({
      apiKey: string(),
    })

    type Result = MergedOutput<typeof flags, typeof args>

    expectTypeOf<Result>().toMatchTypeOf<{
      verbose: boolean
      apiKey: string
    }>()
  })

  test('handles undefined flags', () => {
    const args = v.object({ name: v.string() })

    type Result = MergedOutput<undefined, typeof args>

    expectTypeOf<Result>().toMatchTypeOf<{ name: string }>()
  })

  test('handles both undefined', () => {
    type Result = MergedOutput<undefined, undefined>

    expectTypeOf<Result>().toEqualTypeOf<{}>()
  })
})

// ─── Root Handler Type Inference ─────────────────────────

describe('Root handler type inference', () => {
  test('handler receives merged flags + args with Valibot', () => {
    const flags = v.object({
      verbose: v.optional(v.boolean(), false),
      logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
    })
    const args = v.object({
      ci: v.optional(v.boolean(), false),
    })

    type HandlerArgs = MergedOutput<typeof flags, typeof args>

    expectTypeOf<HandlerArgs>().toMatchTypeOf<{
      verbose: boolean
      logLevel: 'info' | 'debug' | 'warn' | 'error'
      ci: boolean
    }>()
  })

  test('handler receives merged flags + args with Zod', () => {
    const flags = object({
      verbose: boolean().default(false),
    })
    const args = object({
      target: string().default('production'),
    })

    type HandlerArgs = MergedOutput<typeof flags, typeof args>

    expectTypeOf<HandlerArgs>().toMatchTypeOf<{
      verbose: boolean
      target: string
    }>()
  })
})
