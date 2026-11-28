import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/shared/live/liveSignal.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { emitLiveChanged, holdLiveReload, subscribeLiveChanged } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

// Module state is shared inside this file: every test releases the holds it takes.
function counter() {
  let calls = 0
  const unsubscribe = subscribeLiveChanged(() => calls++)
  return {
    get calls() {
      return calls
    },
    unsubscribe,
  }
}

test('an emit with no hold reaches the listener once', () => {
  const listener = counter()
  emitLiveChanged()
  assert.equal(listener.calls, 1)
  listener.unsubscribe()
})

test('a held emit waits until the hold is released, then arrives once', () => {
  const listener = counter()
  const release = holdLiveReload()
  emitLiveChanged()
  assert.equal(listener.calls, 0)
  release()
  assert.equal(listener.calls, 1)
  listener.unsubscribe()
})

test('the signal waits for the last of two holds', () => {
  const listener = counter()
  const first = holdLiveReload()
  const second = holdLiveReload()
  emitLiveChanged()
  first()
  assert.equal(listener.calls, 0)
  second()
  assert.equal(listener.calls, 1)
  listener.unsubscribe()
})

test('releasing a hold twice does not make the hold count negative', () => {
  const listener = counter()
  const release = holdLiveReload()
  release()
  release()
  emitLiveChanged()
  assert.equal(listener.calls, 1)
  listener.unsubscribe()
})

test('several emits while held collapse into one delivery', () => {
  const listener = counter()
  const release = holdLiveReload()
  emitLiveChanged()
  emitLiveChanged()
  emitLiveChanged()
  release()
  assert.equal(listener.calls, 1)
  listener.unsubscribe()
})

test('unsubscribe stops delivery', () => {
  const listener = counter()
  listener.unsubscribe()
  emitLiveChanged()
  assert.equal(listener.calls, 0)
})
