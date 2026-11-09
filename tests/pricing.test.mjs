import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/pricing/model.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { canEditPrice, priceValid, percentValid } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('retail editing requires Owner or explicit BM retail price permission', () => {
  for (const role of ['STAFF', 'ADMIN', 'BRANCH_MANAGER'])
    assert.equal(canEditPrice({ role, permissions: [] }), false)
  assert.equal(
    canEditPrice({ role: 'BRANCH_MANAGER', permissions: ['CATALOG_EDIT'] }),
    false,
  )
  assert.equal(
    canEditPrice({
      role: 'BRANCH_MANAGER',
      permissions: ['RETAIL_PRICE_EDIT'],
    }),
    true,
  )
  assert.equal(canEditPrice({ role: 'OWNER' }), true)
})
test('prices reject unsafe integers, fractions and zero while percentage policies accept zero', () => {
  assert.equal(priceValid('125000'), true)
  for (const v of ['', '0', '-1', '1.5', 'NaN', '9007199254740992'])
    assert.equal(priceValid(v), false)
  for (const v of ['0', '100', '99.99']) assert.equal(percentValid(v), true)
  for (const v of ['', '-1', '100.01', '1.234', '1e2'])
    assert.equal(percentValid(v), false)
  assert.equal(percentValid('999.99', 999.99), true)
  assert.equal(percentValid('1000', 999.99), false)
})
