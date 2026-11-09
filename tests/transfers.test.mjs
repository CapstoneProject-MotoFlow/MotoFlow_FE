import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/transfers/transferRules.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { transferQuantitiesValid, receiptAcceptsResult } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('transfer creation refuses duplicate parts, fractional and out-of-range quantities', () => {
  assert.equal(transferQuantitiesValid([{ productId: 1, quantity: 2 }]), true)
  for (const rows of [
    [],
    [
      { productId: 1, quantity: 1 },
      { productId: 1, quantity: 2 },
    ],
    [{ productId: 1, quantity: 0.5 }],
    [{ productId: 1, quantity: 2147483648 }],
  ])
    assert.equal(transferQuantitiesValid(rows), false)
})
test('zero quantities are accepted only for recording results', () => {
  assert.equal(transferQuantitiesValid([{ productId: 1, quantity: 0 }]), false)
  assert.equal(
    transferQuantitiesValid([{ productId: 1, quantity: 0 }], true),
    true,
  )
})

test('receipt results lock after submission and unlock only for recount', () => {
  assert.equal(receiptAcceptsResult('AWAITING_INSPECTION'), true)
  assert.equal(receiptAcceptsResult('AWAITING_RECOUNT'), true)
  assert.equal(receiptAcceptsResult('AWAITING_CONFIRMATION'), false)
  assert.equal(receiptAcceptsResult('CONFIRMED'), false)
})
