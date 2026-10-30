import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
async function load(file) {
  const source = readFileSync(
    new URL('../src/' + file, import.meta.url),
    'utf8',
  )
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(
    'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  )
}
const { formatDate } = await load('shared/utils/format.ts')
const { recentAccounts } = await load(
  'modules/dashboard/utils/recentAccounts.ts',
)
const accounts = [
  { id: 1, lastLoginAt: null },
  { id: 2, lastLoginAt: '2026-10-28T10:00:00Z' },
  { id: 3, lastLoginAt: '2026-10-29T10:00:00Z' },
]
test('missing login dates never become January 1970', () => {
  assert.equal(formatDate(null), '—')
  assert.equal(formatDate(undefined), '—')
  assert.equal(formatDate(''), '—')
  assert.match(formatDate(accounts[2].lastLoginAt), /2026/)
})
test('selecting a never signed-in account retains that account with its null date', () => {
  assert.deepEqual(recentAccounts(accounts, 1), [accounts[0]])
})
test('clearing selection restores recent signed-in accounts newest first', () => {
  assert.deepEqual(
    recentAccounts(accounts, null).map((account) => account.id),
    [3, 2],
  )
})
test('unknown selection is empty and recent results are limited to six without mutating input', () => {
  assert.deepEqual(recentAccounts(accounts, 99), [])
  const rows = Array.from({ length: 10 }, (_, id) => ({
    id,
    lastLoginAt: '2026-10-29T10:00:00Z',
  }))
  assert.equal(recentAccounts(rows, null).length, 6)
  assert.equal(rows.length, 10)
})
