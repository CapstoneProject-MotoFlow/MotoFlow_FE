import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import { apiMessage } from '../supplierService'

type DiscrepancyCase = {
  id: number
  sku: string
  partName: string
  shortQty: number
  wrongItemQty: number
  damagedQty: number
  rejectedExcessQty: number
  returnRequiredQty: number
  replacementRequiredQty: number
  replacementLimitQty: number
  replacementDelivery: boolean
  canHandle: boolean
}

type Draft = { returned: string; replacement?: string }

function replacementLimit(row: DiscrepancyCase) {
  return row.replacementDelivery
    ? 0
    : Math.min(
        row.replacementLimitQty,
        row.shortQty + row.wrongItemQty + row.damagedQty,
      )
}

function replacementValue(row: DiscrepancyCase, draft: Draft) {
  if (row.replacementDelivery) return '0'
  return (
    draft.replacement ??
    String(
      Math.min(
        replacementLimit(row),
        Math.max(
          0,
          row.shortQty + Number(draft.returned) - row.rejectedExcessQty,
        ),
      ),
    )
  )
}

function errorMessage(error: unknown) {
  const code = isAxiosError<{ code?: string }>(error)
    ? error.response?.data?.code
    : undefined
  return code ? `${code} · ${apiMessage(error)}` : apiMessage(error)
}

export default function ResolveSupplierDiscrepancyPage() {
  const [params, setParams] = useSearchParams()
  const receiptId = params.get('receipt') ?? ''
  return (
    <DiscrepancyForm
      key={receiptId}
      receiptId={receiptId}
      onOpenReceipt={(receipt) => setParams({ receipt })}
    />
  )
}

function DiscrepancyForm({
  receiptId,
  onOpenReceipt,
}: {
  receiptId: string
  onOpenReceipt: (receipt: string) => void
}) {
  const [rows, setRows] = useState<DiscrepancyCase[]>([])
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const validReceipt = /^[1-9]\d*$/.test(receiptId)
  const [loading, setLoading] = useState(validReceipt)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!validReceipt) return
    const controller = new AbortController()
    async function load() {
      try {
        const cases: DiscrepancyCase[] = []
        for (let page = 0; ; page++) {
          const { data } = await axiosClient.get<{
            items: DiscrepancyCase[]
            totalItems: number
          }>('/discrepancy-cases', {
            params: { goodsReceiptNoteId: receiptId, page, size: 100 },
            signal: controller.signal,
          })
          cases.push(...data.items)
          if (!data.items.length || cases.length >= data.totalItems) break
        }
        if (!controller.signal.aborted) setRows(cases)
      } catch (error) {
        if (!controller.signal.aborted) setError(errorMessage(error))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [receiptId, validReceipt])

  return (
    <main className="dashboard-content">
      <h1>Xử lý sai lệch nhà cung cấp</h1>
      <form
        key={receiptId}
        onSubmit={(event) => {
          event.preventDefault()
          const receipt = String(
            new FormData(event.currentTarget).get('receipt') ?? '',
          )
          onOpenReceipt(receipt)
        }}
      >
        <label>
          Mã phiếu nhập hàng
          <input
            name="receipt"
            defaultValue={receiptId}
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            required
          />
        </label>
        <button type="submit" disabled={saving}>
          Mở phiếu
        </button>
      </form>
      {loading && <p role="status">Đang tải sai lệch…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {receiptId && !validReceipt && (
        <p role="alert">Mã phiếu nhập hàng không hợp lệ.</p>
      )}
      {validReceipt && !loading && !error && !rows.length && (
        <p>Phiếu này chưa có sai lệch.</p>
      )}
      {rows.length > 0 && (
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (saving) return
            const lines = rows
              .filter((row) => row.canHandle && drafts[row.id])
              .map((row) => ({
                caseId: row.id,
                returnRequiredQty: Number(drafts[row.id].returned),
                replacementRequiredQty: Number(
                  replacementValue(row, drafts[row.id]),
                ),
              }))
            if (!lines.length) return
            const note = String(
              new FormData(event.currentTarget).get('note') ?? '',
            ).trim()
            setError('')
            setNotice('')
            setSaving(true)
            try {
              const { data } = await axiosClient.put<DiscrepancyCase[]>(
                `/goods-receipt-notes/${receiptId}/discrepancies`,
                { lines, note },
              )
              setRows(data)
              setDrafts({})
              setNotice('Đã lưu hướng xử lý sai lệch.')
            } catch (error) {
              setError(errorMessage(error))
            } finally {
              setSaving(false)
            }
          }}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Phụ tùng</th>
                  <th>Thiếu</th>
                  <th>Giao sai</th>
                  <th>Hỏng</th>
                  <th>Thừa từ chối</th>
                  <th>Số trả lại</th>
                  <th>Số giao bù</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const draft = drafts[row.id] ?? {
                    returned: String(row.returnRequiredQty),
                  }
                  return (
                    <tr key={row.id}>
                      <th scope="row">
                        {row.sku} · {row.partName}
                      </th>
                      <td>{row.shortQty}</td>
                      <td>{row.wrongItemQty}</td>
                      <td>{row.damagedQty}</td>
                      <td>{row.rejectedExcessQty}</td>
                      <td>
                        <input
                          type="number"
                          aria-label={`Số trả lại · ${row.sku}`}
                          min={row.returnRequiredQty}
                          max={
                            row.wrongItemQty +
                            row.damagedQty +
                            row.rejectedExcessQty
                          }
                          required
                          disabled={!row.canHandle || saving}
                          value={draft.returned}
                          onChange={(event) =>
                            setDrafts({
                              ...drafts,
                              [row.id]: {
                                ...draft,
                                returned: event.target.value,
                              },
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          aria-label={`Số giao bù · ${row.sku}`}
                          min={0}
                          max={replacementLimit(row)}
                          required
                          disabled={
                            !row.canHandle || row.replacementDelivery || saving
                          }
                          value={
                            row.canHandle && (!notice || drafts[row.id])
                              ? replacementValue(row, draft)
                              : row.replacementRequiredQty
                          }
                          onChange={(event) =>
                            setDrafts({
                              ...drafts,
                              [row.id]: {
                                ...draft,
                                replacement: event.target.value,
                              },
                            })
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <label>
            Ghi chú <textarea name="note" maxLength={255} disabled={saving} />
          </label>
          <button
            className="ui-confirm-button"
            type="submit"
            disabled={saving || !Object.keys(drafts).length}
          >
            {saving ? 'Đang lưu…' : 'Lưu hướng xử lý'}
          </button>
        </form>
      )}
    </main>
  )
}
