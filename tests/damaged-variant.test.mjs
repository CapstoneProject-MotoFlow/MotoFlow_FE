import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/shared/utils/damagedVariant.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { isDamagedVariant, damagedVariantBaseSku } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('a dented-goods variant needs both the -M SKU and the "(hàng móp)" name', () => {
  assert.equal(isDamagedVariant({ sku: 'DEN-01-M', partName: 'Đèn pha (hàng móp)' }), true)
  assert.equal(isDamagedVariant({ sku: 'GHI-M', partName: 'Ghi đông M' }), false)
  assert.equal(isDamagedVariant({ sku: 'DEN-01', partName: 'Đèn pha (hàng móp)' }), false)
  assert.equal(damagedVariantBaseSku({ sku: 'DEN-01-M', partName: 'Đèn pha (hàng móp)' }), 'DEN-01')
  assert.equal(damagedVariantBaseSku({ sku: 'DEN-01', partName: 'Đèn pha' }), null)
})
