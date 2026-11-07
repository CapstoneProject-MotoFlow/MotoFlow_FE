import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/inventory/stockCountModel.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { countDifference, validCountQuantity, countSubmissionReady } =
  await import(
    'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  )

test('uncounted lines remain unknown while an explicit zero is a real count', () => {
  assert.equal(countDifference({ countedQty: null, bookQty: 12 }), null)
  assert.equal(countDifference({ countedQty: 12, bookQty: null }), null)
  assert.equal(countDifference({ countedQty: 0, bookQty: 12 }), -12)
  assert.equal(countDifference({ countedQty: 12, bookQty: 12 }), 0)
})
test('blind counts accept zero and whole quantities but reject invalid numeric text', () => {
  for (const value of ['0', '12', '2147483647'])
    assert.equal(validCountQuantity(value), true, value)
  for (const value of [
    '',
    ' ',
    '-1',
    '1.5',
    '1e3',
    '12abc',
    'Infinity',
    '2147483648',
  ])
    assert.equal(validCountQuantity(value), false, value)
})
test('submission needs a nonempty assignment, commitment, and a count or note on every line', () => {
  const counted = { value: '0', note: '' }
  const inaccessible = { value: '', note: 'Kho phụ đang khóa' }
  assert.equal(countSubmissionReady([counted, inaccessible], true), true)
  assert.equal(countSubmissionReady([counted, inaccessible], false), false)
  assert.equal(countSubmissionReady([], true), false)
  assert.equal(
    countSubmissionReady([counted, { value: '', note: ' ' }], true),
    false,
  )
  assert.equal(
    countSubmissionReady([{ value: '-2', note: 'Có ghi chú' }], true),
    false,
  )
})
