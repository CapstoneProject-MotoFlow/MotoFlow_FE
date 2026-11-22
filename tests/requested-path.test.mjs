import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/shared/utils/requestedPath.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { requestedPathFrom } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

test('returns the in-app path the user asked for before login', () => {
  assert.equal(
    requestedPathFrom({ from: '/receivables/customers/18' }),
    '/receivables/customers/18',
  )
  assert.equal(
    requestedPathFrom({ from: '/inventory/movements?q=abc#row-2' }),
    '/inventory/movements?q=abc#row-2',
  )
})

test('ignores missing state, non-string values and external URLs', () => {
  assert.equal(requestedPathFrom(null), null)
  assert.equal(requestedPathFrom(undefined), null)
  assert.equal(requestedPathFrom({}), null)
  assert.equal(requestedPathFrom({ from: 42 }), null)
  assert.equal(requestedPathFrom({ from: 'https://evil.example/' }), null)
  assert.equal(requestedPathFrom({ from: '//evil.example/x' }), null)
  assert.equal(requestedPathFrom({ from: '/\\evil.example/x' }), null)
  assert.equal(requestedPathFrom({ from: 'dashboard' }), null)
})

test('never returns to login, change-password or the root', () => {
  assert.equal(requestedPathFrom({ from: '/login' }), null)
  assert.equal(requestedPathFrom({ from: '/login?next=1' }), null)
  assert.equal(requestedPathFrom({ from: '/change-password' }), null)
  assert.equal(requestedPathFrom({ from: '/' }), null)
  assert.equal(requestedPathFrom({ from: '/Login' }), null)
  assert.equal(requestedPathFrom({ from: '/login/' }), null)
  assert.equal(requestedPathFrom({ from: '/LOGIN//?next=1' }), null)
  assert.equal(requestedPathFrom({ from: '/change-password/' }), null)
  assert.equal(requestedPathFrom({ from: '/Change-Password' }), null)
  assert.equal(requestedPathFrom({ from: '/login/#x' }), null)
})
