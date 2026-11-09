import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import { useChoicePages } from '../sales/useSalesList'
import { money } from '../inventory/presentation'
import type { Replenishment } from './types'
import { hasExistingPurchase } from './transferRules'
export default function ReplenishmentPurchaseDialog({
  request,
  onClose,
  onSaved,
}: {
  request: Replenishment
  onClose: () => void
  onSaved: (id: number) => void
}) {
  const [supplier, setSupplier] = useState(''),
    [q, setQ] = useState(''),
    [arrival, setArrival] = useState(''),
    [prices, setPrices] = useState<Record<number, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [created, setCreated] = useState<number>()
  const lock = useRef(false),
    suppliers = useChoicePages<{
      id: number
      supplierName: string
      status: string
    }>('/suppliers', q),
    lines = request.lines.filter((l) => l.toPurchaseQty > 0),
    valid =
      request.status !== 'CLOSED' &&
      !hasExistingPurchase(request.purchaseOrders) &&
      !!supplier &&
      lines.length > 0 &&
      lines.every(
        (l) =>
          l.toPurchaseQty <= 1000000 &&
          Number.isSafeInteger(Number(prices[l.productId])) &&
          Number(prices[l.productId]) > 0 &&
          Number(prices[l.productId]) <= 10000000000,
      ),
    total = lines.reduce(
      (n, l) => n + l.toPurchaseQty * Number(prices[l.productId] || 0),
      0,
    )
  return (
    <FormDialog
      title={
        'Lập phiếu nhập hàng cho YBS-' + String(request.id).padStart(4, '0')
      }
      formId="replenishment-purchase"
      className="tf-purchase-dialog"
      submitLabel={created ? 'Đã tạo phiếu' : 'Tạo phiếu nhập hàng'}
      submitDisabled={!valid || !Number.isSafeInteger(total) || !!created}
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
          if (lock.current || !valid || created) return
          lock.current = true
          setBusy(true)
          setError('')
          try {
            const r = await axiosClient.post<{ id: number }>(
              '/purchase-orders',
              {
                supplierId: Number(supplier),
                storeId: request.requestingStoreId,
                expectedArrival: arrival || undefined,
                note:
                  'Phần chuyển mua từ yêu cầu YBS-' +
                  String(request.id).padStart(4, '0'),
                lines: lines.map((l) => ({
                  productId: l.productId,
                  quantity: l.toPurchaseQty,
                  purchasePrice: Number(prices[l.productId]),
                })),
              },
            )
            setCreated(r.data.id)
            onSaved(r.data.id)
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
          <p role="status">
            Đã tạo{' '}
            <Link to={'/purchase-orders/' + created}>
              phiếu nhập hàng #{created} →
            </Link>
          </p>
        ) : (
          <fieldset disabled={busy}>
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
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  <option value="">Chọn nhà cung cấp</option>
                  {suppliers.data?.items
                    .filter((s) => s.status === 'ACTIVE')
                    .map((s) => (
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
                        {l.toPurchaseQty} {l.baseUnit}
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
                          l.toPurchaseQty * Number(prices[l.productId] || 0),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tf-purchase-note">
              Kiểm tra các phiếu nhập hàng đã lập trước khi tạo mới. Phần chuyển
              mua chưa được tự động trừ sau khi tạo phiếu.
            </p>
          </fieldset>
        )}
      </form>
    </FormDialog>
  )
}
