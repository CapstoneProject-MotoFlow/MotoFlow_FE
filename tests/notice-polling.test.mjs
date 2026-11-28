import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/notifications/noticePolling.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { diffNotices, nextDelay } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

test('the first poll only records ids and reports nothing', () => {
  const result = diffNotices(null, [{ id: 3 }, { id: 2 }])
  assert.deepEqual(result.fresh, [])
  assert.deepEqual([...result.seen].sort(), [2, 3])
})

test('a new id on top of the list is reported', () => {
  const first = diffNotices(null, [{ id: 3 }, { id: 2 }])
  const next = diffNotices(first.seen, [{ id: 4 }, { id: 3 }, { id: 2 }])
  assert.deepEqual(next.fresh, [{ id: 4 }])
})

test('an id smaller than every seen id but not seen before is reported', () => {
  const first = diffNotices(null, [{ id: 10 }, { id: 9 }])
  const next = diffNotices(first.seen, [{ id: 10 }, { id: 9 }, { id: 5 }])
  assert.deepEqual(next.fresh, [{ id: 5 }])
})

test('the same list again reports nothing', () => {
  const first = diffNotices(null, [{ id: 1 }, { id: 2 }])
  const next = diffNotices(first.seen, [{ id: 2 }, { id: 1 }])
  assert.deepEqual(next.fresh, [])
})

test('an empty baseline followed by one item reports that item', () => {
  const first = diffNotices(null, [])
  const next = diffNotices(first.seen, [{ id: 7 }])
  assert.deepEqual(next.fresh, [{ id: 7 }])
})

test('nextDelay stops while the tab is hidden', () => {
  assert.equal(nextDelay({ hidden: true, focused: true }, 0), null)
})

test('nextDelay polls every 2 seconds plus jitter while focused', () => {
  assert.equal(nextDelay({ hidden: false, focused: true }, 0), 2000)
})

test('nextDelay polls every 10 seconds plus jitter while not focused', () => {
  assert.equal(nextDelay({ hidden: false, focused: false }, 0.999), 10000 + 299)
})
