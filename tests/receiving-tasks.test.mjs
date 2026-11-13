import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/operations/receivingTaskModel.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { readReceivingTasks, receivingCreatePath, receivingWork } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('receiving tasks accept a list or a page and drop rows that are not receiving tasks', () => {
  const task = { taskId: 1, taskType: 'SUPPLIER_RECEIVING', documentId: 5 }
  assert.deepEqual(readReceivingTasks([task]), [task])
  assert.deepEqual(readReceivingTasks({ items: [task] }), [task])
  assert.deepEqual(
    readReceivingTasks([
      { taskId: 2, taskType: 'INSPECTION', documentId: 5 },
      { taskId: 3, taskType: 'TRANSFER_RECEIVING', documentId: 0 },
      null,
    ]),
    [],
  )
  assert.deepEqual(readReceivingTasks(undefined), [])
})
test('staff opens the receipt create screen of the assigned document', () => {
  assert.equal(
    receivingCreatePath('SUPPLIER_RECEIVING', 5),
    '/purchase-orders/5/receipts/new',
  )
  assert.equal(
    receivingCreatePath('TRANSFER_RECEIVING', 3),
    '/transfer-orders/3/receipts/new',
  )
  const row = receivingWork({
    taskId: 9,
    taskType: 'TRANSFER_RECEIVING',
    documentId: 3,
    partnerName: 'Kho tổng',
    lineCount: 2,
  })
  assert.equal(row.task, 'Nhận hàng điều chuyển')
  assert.equal(row.code, 'DC-0003')
  assert.equal(row.description, 'Kho tổng · 2 dòng')
  assert.equal(row.action, 'Lập phiếu nhập')
  assert.equal(row.href, '/transfer-orders/3/receipts/new')
  const po = receivingWork({
    taskId: 8,
    taskType: 'SUPPLIER_RECEIVING',
    documentId: 12,
    documentCode: 'YCN-0012',
  })
  assert.equal(po.task, 'Nhận hàng nhập từ nhà cung cấp')
  assert.equal(po.code, 'YCN-0012')
  assert.equal(po.href, '/purchase-orders/12/receipts/new')
})
