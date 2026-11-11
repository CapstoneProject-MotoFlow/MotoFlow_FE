import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FormDialog from '../../shared/ui/FormDialog'
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
  email?: string | null
}
export default function ReplenishmentPurchaseDialog({
  request,
  onClose,
}: {
  request: Replenishment
  onClose: () => void
}) {
  const [supplier, setSupplier] = useState<SupplierChoice>(),
    [q, setQ] = useState(''),
    [arrival, setArrival] = useState(''),
    [prices, setPrices] = useState<Record<number, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [created, setCreated] = useState<number>(),
    [copyStatus, setCopyStatus] = useState('')
  const lock = useRef(false),
    suppliers = useChoicePages<SupplierChoice>('/suppliers', q, !created),
    options = suppliers.data?.items.filter((s) => s.status === 'ACTIVE') ?? [],
    lines = request.lines
      .map((line) => ({
        ...line,
        purchaseQty:
          line.toPurchaseQty +
          (request.status === 'CLOSED' ? 0 : unplannedQuantity(line)),
      }))
      .filter((line) => line.purchaseQty > 0),
    valid =
      !hasExistingPurchase(request.purchaseOrders) &&
      !!supplier &&
      lines.length > 0 &&
      lines.every(
        (l) =>
          l.purchaseQty <= 1000000 &&
          Number.isSafeInteger(Number(prices[l.productId])) &&
          Number(prices[l.productId]) > 0 &&
          Number(prices[l.productId]) <= 10000000000,
      ),
    total = lines.reduce(
      (n, l) => n + l.purchaseQty * Number(prices[l.productId] || 0),
      0,
    )
  const shortage = lines.reduce((sum, line) => sum + line.purchaseQty, 0)
  const subject = created ? 'Đặt hàng ' + purchaseOrderCode(created) : ''
  const message = [
    'Kính gửi ' + (supplier?.supplierName ?? '') + ',',
    '',
    'Vui lòng xác nhận đơn đặt hàng ' +
      (created ? purchaseOrderCode(created) : '') +
      ' của MotoFlow.',
    'Kho nhận: ' + request.storeName,
    ...(arrival ? ['Ngày giao dự kiến: ' + date(arrival)] : []),
    '',
    ...lines.map(
      (line) =>
        `${line.sku} · ${line.partName} · ${line.purchaseQty} ${line.baseUnit} · đơn giá ${money.format(Number(prices[line.productId]))}`,
    ),
    'Tổng tiền: ' + money.format(total),
  ].join('\r\n')
  const email = supplier?.email?.trim()
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
          try {
            const r = await axiosClient.post<{ id: number }>(
              '/purchase-orders',
              {
                supplierId: supplier.id,
                storeId: request.requestingStoreId,
                replenishmentRequestId: request.id,
                includeUnallocated: true,
                expectedArrival: arrival || undefined,
                note:
                  'Phần chuyển mua từ yêu cầu YBS-' +
                  String(request.id).padStart(4, '0'),
                lines: lines.map((l) => ({
                  productId: l.productId,
                  quantity: l.purchaseQty,
                  purchasePrice: Number(prices[l.productId]),
                })),
              },
            )
            setCreated(r.data.id)
          } catch (err) {
            setError(inventoryError(err))
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
            <div className="tf-replenishment-actions">
              {email && (
                <a
                  href={`mailto:${encodeURIComponent(email).replace('%40', '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
                >
                  Mở email gửi nhà cung cấp
                </a>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      subject + '\r\n\r\n' + message,
                    )
                    setCopyStatus('Đã sao chép nội dung đơn.')
                  } catch {
                    setCopyStatus(
                      'Hãy chọn và sao chép nội dung trong ô bên dưới.',
                    )
                  }
                }}
              >
                Sao chép nội dung gửi
              </button>
            </div>
            {copyStatus && <small role="status">{copyStatus}</small>}
            <label>
              Nội dung gửi nhà cung cấp
              <textarea
                readOnly
                rows={7}
                value={subject + '\r\n\r\n' + message}
              />
            </label>
          </div>
        ) : (
          <fieldset disabled={busy}>
            <p role="status" className="tf-shortage">
              Còn thiếu <strong>{shortage} sản phẩm</strong> thuộc{' '}
              {lines.length} mã phụ tùng.
            </p>
            <div className="tf-purchase-fields">
              <label>
                Nhà cung cấp *
                <input
                  aria-label="Tìm nhà cung cấp"
                  placeholder="Tìm nhà cung cấp"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <select
                  required
                  value={supplier?.id ?? ''}
                  onChange={(e) =>
                    setSupplier(
                      options.find((s) => s.id === Number(e.target.value)),
                    )
                  }
                >
                  <option value="">Chọn nhà cung cấp</option>
                  {supplier && !options.some((s) => s.id === supplier.id) && (
                    <option value={supplier.id}>{supplier.supplierName}</option>
                  )}
                  {options.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplierName}
                    </option>
                  ))}
                </select>
                {suppliers.hasMore && (
                  <button
                    type="button"
                    disabled={suppliers.loading}
                    onClick={suppliers.loadMore}
                  >
                    Xem thêm
                  </button>
                )}
                {suppliers.error && (
                  <small role="alert">{suppliers.error}</small>
                )}
              </label>
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
                        {l.purchaseQty} {l.baseUnit}
                      </td>
                      <td>
                        <input
                          aria-label={'Giá nhập ' + l.sku}
                          required
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
                          l.purchaseQty * Number(prices[l.productId] || 0),
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
