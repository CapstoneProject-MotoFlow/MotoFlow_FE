import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/receivables/debtRules.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { confirmedAllocations } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('debt collection preserves the server balance snapshot and ignores zero shares', () => {
  assert.deepEqual(
    confirmedAllocations({
      amount: 50,
      allocations: [
        {
          receivableId: 9,
          remainingBefore: 80,
          allocatedAmount: 50,
          remainingAfter: 30,
        },
        {
          receivableId: 10,
          remainingBefore: 40,
          allocatedAmount: 0,
          remainingAfter: 40,
        },
      ],
    }),
    [{ receivableId: 9, remainingBefore: 80, amount: 50 }],
  )
})
test('debt collection refuses a mismatched total or an allocation beyond the balance', () => {
  assert.throws(() =>
    confirmedAllocations({
      amount: 51,
      allocations: [
        {
          receivableId: 9,
          remainingBefore: 80,
          allocatedAmount: 50,
          remainingAfter: 30,
        },
      ],
    }),
  )
  assert.throws(() =>
    confirmedAllocations({
      amount: 90,
      allocations: [
        {
          receivableId: 9,
          remainingBefore: 80,
          allocatedAmount: 90,
          remainingAfter: -10,
        },
      ],
    }),
  )
})
