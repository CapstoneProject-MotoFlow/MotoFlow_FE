import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/sales/salesApi.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { orderFromDto } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('sales adapter retains BE status, version, permissions, quantities and authoritative money', () => {
  const actions = {
    canUpdate: false,
    canConfirm: true,
    canRecordPicking: false,
  }
  const dto = {
    id: 1,
    version: 4,
    status: 'AWAITING_PICKING',
    storeId: 2,
    storeName: 'Kho',
    customerId: null,
    customerName: null,
    customerPhone: null,
    priceType: 'WHOLESALE',
    discountRate: 2.5,
    createdAt: '2026-11-08',
    picker: { name: 'NV' },
    total: 975,
    money: { netCollected: 500, remainingPayable: 475, credit: null },
    actions,
    lines: [
      {
        productId: 7,
        sku: 'A',
        partName: 'A',
        baseUnit: 'cái',
        requestedQty: 10,
        pickedQty: 7,
        deliveredQty: 5,
        referencePrice: 200,
        actualUnitPrice: 195,
        shortReason: 'Thiếu hàng',
        barcodes: ['123'],
        pickFirst: [{ lotId: 8, expiryDate: '2027-01-01', takeQty: 7 }],
      },
    ],
    history: [],
  }
  const order = orderFromDto(dto)
  assert.equal(order.status, 'AWAITING_PICKING')
  assert.equal(order.version, 4)
  assert.equal(order.actions, actions)
  assert.equal(order.total, 975)
  assert.equal(order.remainingPayable, 475)
  assert.equal(order.netPaid, 500)
  assert.equal(order.customerName, 'Khách lẻ')
  assert.equal(order.lines[0].picked, 7)
  assert.equal(order.lines[0].actualUnitPrice, 195)
  assert.match(order.lines[0].lotHint, /Lô 8/)
})
