// PM 23/11 (plan bản 2): giao sai tách khỏi thiếu, Owner chỉ xác nhận, "Bên nhận kiểm sai".
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
    wrongAwaitingOwnerQty: 1,
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
  status: 'AWAITING_OWNER',
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

test('the receiving BM records a wrong item receipt and sees it wait for the Owner', async () => {
  await withModules(({ Section, html }) => {
    const out = html(
      createElement(Section, {
        order: order([line()], [awaiting]),
        canRecord: true,
        onDone: () => {},
      }),
    )
    // PM 23/11 UI-01: giải thích nằm trong biểu tượng (i), không còn đoạn mô tả.
    assert.match(
      out,
      /<h2>Hàng giao sai <span class="mf-info-tip"[^>]*title="Giao sai là giao nhầm/,
    )
    assert.doesNotMatch(out, /<p class="tf-note">Giao sai là/)
    // Không phải Owner thì không có nút xác nhận.
    assert.doesNotMatch(out, />Xác nhận<\/button>/)
    assert.match(out, /Giao sai 2 · Chưa lập phiếu 1 · Chờ Owner xác nhận 1/)
    assert.match(out, /1 × MA-PHANH-SAU · Má phanh sau · HSD 01\/03\/2027 · Chờ Owner xác nhận · Lê B/)
    assert.match(out, />Lập phiếu nhận hàng giao sai<\/button>/)
    // Không còn cách "Trả về kho gửi" cho hàng giao sai.
    assert.doesNotMatch(out, /Trả về kho gửi/)
  })
})

test('the Owner confirms a wrong item receipt from the order page (test 23/11 T-04)', async () => {
  await withModules(({ Section, html }) => {
    const out = html(
      createElement(Section, {
        order: order([line()], [awaiting]),
        canRecord: true,
        canConfirm: true,
        onDone: () => {},
      }),
    )
    assert.match(
      out,
      /Chờ Owner xác nhận · Lê B<button[^>]*>Xác nhận<\/button>/,
    )
    const confirmed = html(
      createElement(Section, {
        order: order(
          [line({ wrongPendingQty: 0, wrongAwaitingOwnerQty: 0 })],
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
    assert.doesNotMatch(done, />Lập phiếu nhận hàng giao sai<\/button>/)
    const source = html(
      createElement(Section, {
        order: order([line()]),
        canRecord: false,
        onDone: () => {},
      }),
    )
    assert.doesNotMatch(source, />Lập phiếu nhận hàng giao sai<\/button>/)
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
