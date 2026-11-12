import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FormDialog from '../../shared/ui/FormDialog'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import { useChoicePages } from '../sales/useSalesList'
import { date, money } from '../inventory/presentation'
import { purchaseOrderCode } from '../receiving/receivingPresentation'
import type { Replenishment } from './types'
import { hasExistingPurchase, unplannedQuantity } from './transferRules'
type SupplierChoice = {
  id: number
  supplierName: string
  status: string
}
export default function ReplenishmentPurchaseDialog({
  request,
  onClose,
}: {
  request: Replenishment
  onClose: () => void
}) {
  const [supplier, setSupplier] = useState<SupplierChoice>(),
    [supplierSearch, setSupplierSearch] = useState<string | null>(null),
    [arrival, setArrival] = useState(''),
    [quantities, setQuantities] = useState<Record<number, string>>({}),
    [prices, setPrices] = useState<Record<number, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [created, setCreated] = useState<number>(),
    [copyText, setCopyText] = useState(''),
    [copyStatus, setCopyStatus] = useState('')
  const copyField = useRef<HTMLTextAreaElement>(null)
  const savedAllocation = useRef(request)
  const lock = useRef(false),
    suppliers = useChoicePages<SupplierChoice>(
      '/suppliers',
      supplierSearch?.trim() ?? '',
      supplierSearch !== null && !created,
    ),
    options = suppliers.data?.items.filter((s) => s.status === 'ACTIVE') ?? [],
    lines = request.lines
      .map((line) => ({
        ...line,
        availableQty: line.toPurchaseQty + unplannedQuantity(line),
      }))
      .filter((line) => line.availableQty > 0)
      .map((line) => ({
        ...line,
        quantity: quantities[line.productId] ?? String(line.availableQty),
      })),
    orderedLines = lines.filter((line) => Number(line.quantity) > 0),
    edited = lines.some((line) => Number(line.quantity) !== line.availableQty),
    valid =
      request.status !== 'CLOSED' &&
      !hasExistingPurchase(request.purchaseOrders) &&
      !!supplier &&
      orderedLines.length > 0 &&
      lines.every(
        (l) =>
          l.quantity !== '' &&
          Number.isInteger(Number(l.quantity)) &&
          Number(l.quantity) >= 0 &&
          Number(l.quantity) <= Math.min(l.availableQty, 1000000),
      ) &&
      orderedLines.every(
        (l) =>
          Number.isSafeInteger(Number(prices[l.productId])) &&
          Number(prices[l.productId]) > 0 &&
          Number(prices[l.productId]) <= 10000000000,
      ),
    total = orderedLines.reduce(
      (n, l) => n + Number(l.quantity) * Number(prices[l.productId] || 0),
      0,
    )
  const shortage = lines.reduce((sum, line) => sum + line.availableQty, 0)

  async function saveEditedAllocation() {
    const path = '/replenishment-requests/' + request.id
    const { data: latest } = await axiosClient.get<Replenishment>(path)
    if (
      latest.status === 'CLOSED' ||
      hasExistingPurchase(latest.purchaseOrders)
    )
      throw new Error('Yêu cầu đã thay đổi. Đóng popup và tải lại để kiểm tra.')
    const baseline = new Map(
      savedAllocation.current.lines.map((line) => [line.productId, line]),
    )
    const selected = new Map(
      lines.map((line) => [line.productId, Number(line.quantity)]),
    )
    if (
      latest.lines.length !== baseline.size ||
      latest.lines.some((line) => {
        const prior = baseline.get(line.productId)
        return (
          !prior ||
          prior.requestedQty !== line.requestedQty ||
          prior.plannedQty !== line.plannedQty ||
          (prior.toPurchaseQty !== line.toPurchaseQty &&
            selected.get(line.productId) !== line.toPurchaseQty)
        )
      })
    ) {
      throw new Error(
        'Số lượng cần mua đã thay đổi. Đóng popup và tải lại yêu cầu.',
      )
    }
    const changes = latest.lines.flatMap((line) => {
      const quantity = selected.get(line.productId)
      return quantity === undefined || quantity === line.toPurchaseQty
        ? []
        : [{ productId: line.productId, toPurchaseQty: quantity }]
    })
    savedAllocation.current = changes.length
      ? (
          await axiosClient.put<Replenishment>(path + '/to-purchase', {
            lines: changes,
          })
        ).data
      : latest
    return changes.length > 0
  }

  return (
    <FormDialog
      title={
        'Lập phiếu nhập hàng cho YBS-' + String(request.id).padStart(4, '0')
      }
      formId="replenishment-purchase"
      className="tf-purchase-dialog"
      submitLabel={created ? 'Đã tạo phiếu' : 'Tạo phiếu nhập hàng'}
      submitDisabled={!valid || !Number.isSafeInteger(total)}
      hideSubmit={!!created}
      closeLabel={created ? 'Đóng' : 'Để sau'}
      busy={busy}
      footerExtra={
        <span>
          Tổng tiền phiếu <strong>{money.format(total)}</strong>
        </span>
      }
      onClose={onClose}
    >
      <form
        id="replenishment-purchase"
        className="tf-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            lock.current ||
            !valid ||
            !supplier ||
            !Number.isSafeInteger(total) ||
            created
          )
            return
          lock.current = true
          setBusy(true)
          setError('')
          let allocationSaved = false
          try {
            if (edited) allocationSaved = await saveEditedAllocation()
            const r = await axiosClient.post<{ id: number }>(
              '/purchase-orders',
              {
                supplierId: supplier.id,
                storeId: request.requestingStoreId,
                replenishmentRequestId: request.id,
                includeUnallocated: !edited,
                expectedArrival: arrival || undefined,
                note:
                  'Phần chuyển mua từ yêu cầu YBS-' +
                  String(request.id).padStart(4, '0'),
                lines: orderedLines.map((l) => ({
                  productId: l.productId,
                  quantity: Number(l.quantity),
                  purchasePrice: Number(prices[l.productId]),
                })),
              },
            )
            setCopyText(
              [
                'Đơn đặt hàng ' + purchaseOrderCode(r.data.id),
                'Nhà cung cấp: ' + supplier.supplierName,
                'Kho nhận: ' + request.storeName,
                ...(arrival ? ['Ngày giao dự kiến: ' + date(arrival)] : []),
                '',
                ...orderedLines.map(
                  (line, index) =>
                    `${index + 1}. ${line.partName} (${line.sku}) · ${line.quantity} ${line.baseUnit} · Đơn giá ${money.format(Number(prices[line.productId]))}`,
                ),
                '',
                'Tổng tiền: ' + money.format(total),
                'Nhờ anh/chị xác nhận số lượng và lịch giao. Cảm ơn!',
              ].join('\n'),
            )
            setCreated(r.data.id)
          } catch (err) {
            setError(
              inventoryError(err) +
                (allocationSaved
                  ? ' Số lượng chuyển mua đã lưu. Có thể thử tạo phiếu lại.'
                  : ''),
            )
          } finally {
            setBusy(false)
            lock.current = false
          }
        }}
      >
        {error && (
          <p role="alert" className="stock-error">
            {error}
          </p>
        )}
        {hasExistingPurchase(request.purchaseOrders) && (
          <p role="alert">
            Yêu cầu đã có phiếu nhập hàng. Vui lòng kiểm tra phiếu liên quan để
            tránh lập trùng.
          </p>
        )}
        {created ? (
          <div className="tf-form">
            <p role="status">
              Đã tạo{' '}
              <Link to={'/purchase-orders/' + created}>
                phiếu nhập hàng {purchaseOrderCode(created)}
              </Link>
            </p>
            <label>
              Nội dung đặt hàng
              <textarea
                className="tf-purchase-copy-text"
                ref={copyField}
                rows={8}
                value={copyText}
                onChange={(event) => {
                  setCopyText(event.target.value)
                  setCopyStatus('')
                }}
              />
            </label>
            <div className="tf-purchase-copy-actions">
              {copyStatus && <small role="status">{copyStatus}</small>}
              <button
                className="tf-purchase-copy-button"
                type="button"
                disabled={!copyText.trim()}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(copyText)
                    setCopyStatus('Đã sao chép nội dung.')
                  } catch {
                    copyField.current?.focus()
                    copyField.current?.select()
                    setCopyStatus(
                      'Nội dung đã được chọn. Bạn có thể bấm Ctrl+C để sao chép.',
                    )
                  }
                }}
              >
                Sao chép nội dung
              </button>
            </div>
          </div>
        ) : (
          <fieldset disabled={busy}>
            <p role="status" className="tf-shortage">
              Còn thiếu <strong>{shortage} sản phẩm</strong> thuộc{' '}
              {lines.length} mã phụ tùng.
            </p>
            <div className="tf-purchase-fields">
              <div className="tf-purchase-supplier">
                <span>Nhà cung cấp *</span>
                <SearchableFilter
                  label="Nhà cung cấp"
                  value={supplier ? String(supplier.id) : ''}
                  options={(supplierSearch === null && supplier
                    ? [supplier]
                    : options
                  ).map((item) => ({
                    value: String(item.id),
                    label: item.supplierName,
                  }))}
                  searchPlaceholder={
                    supplierSearch === null
                      ? 'Chọn nhà cung cấp'
                      : 'Tìm nhà cung cấp'
                  }
                  loading={suppliers.loading}
                  error={suppliers.error}
                  disabled={busy}
                  toggleOnClick
                  onSearch={setSupplierSearch}
                  onChange={(value) =>
                    setSupplier(
                      options.find((item) => String(item.id) === value),
                    )
                  }
                />
              </div>
              <label>
                Kho nhận<strong>{request.storeName}</strong>
              </label>
              <label>
                Ngày giao dự kiến
                <input
                  type="date"
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                />
              </label>
            </div>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Số lượng</th>
                    <th>Giá nhập (đ)</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.productId}>
                      <td>
                        {l.partName}
                        <small>{l.sku}</small>
                      </td>
                      <td>
                        <input
                          type="number"
                          aria-label={'Số lượng mua ' + l.sku}
                          min={0}
                          max={Math.min(l.availableQty, 1000000)}
                          step={1}
                          required
                          value={l.quantity}
                          onChange={(e) =>
                            setQuantities({
                              ...quantities,
                              [l.productId]: e.target.value,
                            })
                          }
                        />
                        <small>
                          Tối đa {l.availableQty} {l.baseUnit}
                        </small>
                      </td>
                      <td>
                        <input
                          aria-label={'Giá nhập ' + l.sku}
                          required={Number(l.quantity) > 0}
                          disabled={Number(l.quantity) === 0}
                          inputMode="numeric"
                          value={
                            prices[l.productId]
                              ? Number(prices[l.productId]).toLocaleString(
                                  'vi-VN',
                                )
                              : ''
                          }
                          onChange={(e) =>
                            setPrices({
                              ...prices,
                              [l.productId]: e.target.value.replace(/\D/g, ''),
                            })
                          }
                        />
                      </td>
                      <td>
                        {money.format(
                          Number(l.quantity) * Number(prices[l.productId] || 0),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>
        )}
      </form>
    </FormDialog>
  )
}
