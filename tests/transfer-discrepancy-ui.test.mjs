// PM 23/11 (plan bản 2): giao sai tách khỏi thiếu, "Bên nhận kiểm sai". GVHD 24/11: kho gửi xác nhận hoặc từ chối,
// kho nhận nhập kho hoặc hoàn trả.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { MemoryRouter } from 'react-router-dom'

function line(overrides = {}) {
  return {
    productId: 7,
    sku: 'MA-PHANH',
    partName: 'Má phanh trước',
    baseUnit: 'cái',
    plannedQty: 5,
    preparedQty: 5,
    dispatchedQty: 5,
    receivedQty: 3,
    returnedQty: 0,
    lossQty: 0,
    extraReceivedQty: 0,
    extraDispatchedQty: 0,
    unresolvedQty: 2,
    damagedQty: 0,
    shortageQty: 2,
    wrongItemQty: 2,
    wrongPendingQty: 1,
    wrongAwaitingSourceQty: 1,
    noReplacementQty: 0,
    latePendingQty: 0,
    receiverMiscounted: false,
    ...overrides,
  }
}

function order(lines, events = []) {
  return {
    id: 12,
    status: 'RECONCILING',
    lines,
    discrepancies: [
      {
        id: 40,
        productId: 7,
        shortQty: 2,
        wrongItemQty: 2,
        damagedQty: 0,
        status: 'OPEN',
        events,
      },
    ],
  }
}

const awaiting = {
  id: 90,
  resolutionType: 'RECEIVED_AS_OTHER_PRODUCT',
  quantity: 1,
  reason: null,
  confirmedAt: null,
  receivedProductId: 9,
  receivedSku: 'MA-PHANH-SAU',
  receivedPartName: 'Má phanh sau',
  receivedExpiryDate: '2027-03-01',
  status: 'AWAITING_SOURCE',
  recordedBy: { id: 3, fullName: 'Lê B' },
}

async function withModules(run) {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { default: Section } = await server.ssrLoadModule(
      '/src/modules/transfers/TransferWrongItemSection.tsx',
    )
    const { default: Miscount } = await server.ssrLoadModule(
      '/src/modules/transfers/ReceiverMiscountAction.tsx',
    )
    const html = (element) =>
      renderToStaticMarkup(createElement(MemoryRouter, null, element))
    await run({ Section, Miscount, html })
  } finally {
    await server.close()
  }
}

test('the receiving BM records a wrong item receipt or hands it back, and sees it wait for the source', async () => {
  await withModules(({ Section, html }) => {
    const out = html(
      createElement(Section, {
        order: order([line()], [awaiting]),
        canRecord: true,
        canReturn: true,
        onDone: () => {},
      }),
    )
    // PM 23/11 UI-01: giải thích nằm trong biểu tượng (i), không còn đoạn mô tả.
    assert.match(
      out,
      /<h2>Hàng giao sai <span class="mf-info-tip"[^>]*title="Giao sai là giao nhầm/,
    )
    assert.doesNotMatch(out, /<p class="tf-note">Giao sai là/)
    // Kho nhận không xác nhận hay từ chối phiếu của mình.
    assert.doesNotMatch(out, />Xác nhận<\/button>/)
    assert.doesNotMatch(out, />Từ chối<\/button>/)
    assert.match(out, /Giao sai 2 · Chưa xử lý 1 · Chờ kho gửi xác nhận 1/)
    assert.match(out, /Nhập kho: 1 × MA-PHANH-SAU · Má phanh sau · HSD 01\/03\/2027 · Chờ kho gửi xác nhận · Lê B/)
    assert.match(out, />Nhập kho \(lập phiếu nhận\)<\/button>/)
    assert.match(out, />Hoàn trả<\/button>/)
  })
})

test('the source BM confirms or rejects a wrong item receipt from the order page (GVHD 24/11)', async () => {
  await withModules(({ Section, html }) => {
    const out = html(
      createElement(Section, {
        order: order([line()], [awaiting]),
        canRecord: false,
        canConfirm: true,
        onDone: () => {},
      }),
    )
    assert.match(
      out,
      /Chờ kho gửi xác nhận · Lê B<\/p><div class="mf-row-actions"><button[^>]*>Xác nhận<\/button><button[^>]*>Từ chối<\/button>/,
    )
    // Kho gửi không lập phiếu hay hoàn trả thay kho nhận.
    assert.doesNotMatch(out, />Hoàn trả<\/button>/)
    const rejected = html(
      createElement(Section, {
        order: order(
          [line({ wrongPendingQty: 2, wrongAwaitingSourceQty: 0 })],
          [
            {
              ...awaiting,
              status: 'REJECTED',
              rejectionReason: 'Kho không xuất mặt hàng này',
            },
            {
              ...awaiting,
              id: 91,
              resolutionType: 'WRONG_ITEM_RETURNED',
              status: null,
              receivedExpiryDate: null,
            },
          ],
        ),
        canRecord: false,
        canConfirm: true,
        onDone: () => {},
      }),
    )
    assert.match(rejected, /Kho gửi từ chối: Kho không xuất mặt hàng này/)
    assert.match(rejected, /Hoàn trả: 1 × MA-PHANH-SAU · Má phanh sau · Lê B/)
    assert.doesNotMatch(rejected, />Xác nhận<\/button>/)
    const confirmed = html(
      createElement(Section, {
        order: order(
          [line({ wrongPendingQty: 0, wrongAwaitingSourceQty: 0 })],
          [
            {
              ...awaiting,
              status: 'CONFIRMED',
              confirmedAt: '2026-11-23T22:00:00',
            },
          ],
        ),
        canRecord: true,
        canConfirm: true,
        onDone: () => {},
      }),
    )
    assert.doesNotMatch(confirmed, />Xác nhận<\/button>/)
  })
})

test('nothing to record once every wrong item has a receipt, or for a store that may not record', async () => {
  await withModules(({ Section, html }) => {
    const done = html(
      createElement(Section, {
        order: order([line({ wrongPendingQty: 0 })], [awaiting]),
        canRecord: true,
        onDone: () => {},
      }),
    )
    assert.doesNotMatch(done, />Nhập kho \(lập phiếu nhận\)<\/button>/)
    const source = html(
      createElement(Section, {
        order: order([line()]),
        canRecord: false,
        onDone: () => {},
      }),
    )
    assert.doesNotMatch(source, />Nhập kho \(lập phiếu nhận\)<\/button>/)
    assert.doesNotMatch(source, />Hoàn trả<\/button>/)
    const none = html(
      createElement(Section, {
        order: order([line({ wrongItemQty: 0, wrongPendingQty: 0 })]),
        canRecord: true,
        onDone: () => {},
      }),
    )
    assert.equal(none, '')
  })
})

test('the Owner opens "Bên nhận kiểm sai" from the discrepancy row', async () => {
  await withModules(({ Miscount, html }) => {
    const out = html(
      createElement(Miscount, {
        orderId: 12,
        caseId: 40,
        line: line(),
        onSaved: () => {},
      }),
    )
    assert.match(out, />Bên nhận kiểm sai<\/button>/)
  })
})
