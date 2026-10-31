import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/shared/utils/mapConcurrent.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { mapConcurrent } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('parallel lookups respect their limit and preserve input order', async () => {
  let active = 0,
    peak = 0
  const result = await mapConcurrent([4, 3, 2, 1], 2, async (value) => {
    active++
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, value))
    active--
    return value * 2
  })
  assert.deepEqual(result, [8, 6, 4, 2])
  assert.equal(peak, 2)
})
test('cancellation stops scheduling further lookups', async () => {
  let active = true
  const seen = []
  await mapConcurrent(
    [1, 2, 3],
    1,
    async (value) => {
      seen.push(value)
      active = false
      return value
    },
    () => active,
  )
  assert.deepEqual(seen, [1])
})
test('failed lookups reject and stop scheduling queued work', async () => {
  const seen = []
  await assert.rejects(
    mapConcurrent([1, 2, 3], 1, async (value) => {
      seen.push(value)
      throw new Error('network')
    }),
    /network/,
  )
  assert.deepEqual(seen, [1])
})
