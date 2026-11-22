/**
 * File: modules/sales/SalesDraftPages.tsx
 * Loại: THÀNH PHẦN + MÀN HÌNH — tab "Nháp" của màn Đơn bán và màn sửa nháp (route /sales-drafts/:id).
 * Công dụng: Đơn bán lưu ở trạng thái DRAFT trên server. Mỗi người thấy các nháp mình đã lưu, mở lại để sửa,
 * chốt thành đơn bán ("Tạo đơn") hoặc xóa. Nháp không nằm ở các tab khác và chưa giao việc lấy hàng.
 * PM 17/11: danh sách nháp là tab "Nháp" ngoài cùng bên phải của màn Đơn bán; /sales-drafts chuyển hướng tới đó.
 * API: GET/POST /sales-orders/drafts, GET/PUT/DELETE /sales-orders/drafts/{id}, POST /sales-orders/drafts/{id}/submit.
 */
import { useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import PageBackLink from '../../shared/ui/PageBackLink'
import { useSearchBox } from '../../shared/hooks/useSearchBox'
import {
  inventoryError,
  useInventoryData,
  type useInventoryScope,
} from '../inventory/api'
import {
  InventoryNotice,
  Pagination,
  WarehouseFilter,
} from '../inventory/components'
import { dateTime, money } from '../inventory/presentation'
import type { Page } from '../inventory/types'
import type { Customer } from '../customers/types'
import {
  orderFromDto,
  salesDraftsPath,
  type OrderDto,
  type SummaryDto,
} from './salesApi'
import { SalesOrderFormView } from './SalesOrderForm'
import './sales.css'

/** Đường dẫn cũ /sales-drafts (mục sidebar đã bỏ): chuyển sang tab "Nháp", giữ thông báo nếu có. */
export function SalesDraftListPage() {
  const location = useLocation()
  return <Navigate to={salesDraftsPath} replace state={location.state} />
}

/** Nội dung tab "Nháp" của màn Đơn bán (Owner, BM): nháp của chính người dùng. */
export function SalesDraftTab({
  scope,
}: {
  scope: ReturnType<typeof useInventoryScope>
}) {
  const p = scope.params,
    page = Math.max(0, Number(p.get('page')) || 0)
  const search = useSearchBox(p.get('q') ?? '', (value) =>
    scope.filter({ q: value }, true),
  )
  const location = useLocation()
  const [notice, setNotice] = useState(
    (location.state as { notice?: string } | null)?.notice ?? '',
  )
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [removing, setRemoving] = useState<SummaryDto>()
  const data = useInventoryData<Page<SummaryDto>>(
    '/sales-orders/drafts',
    { storeId: scope.storeId, q: p.get('q') ?? '', page, size: 20 },
    revision,
  )
  const columns = scope.owner ? 6 : 5

  async function remove(draft: SummaryDto) {
    setError('')
    setNotice('')
    try {
      await axiosClient.delete('/sales-orders/drafts/' + draft.id)
      setNotice('Đã xóa đơn nháp SO-' + draft.id + '.')
      setRevision((value) => value + 1)
    } catch (failure) {
      setError(inventoryError(failure))
    }
  }

  return (
    <>
      <div className="stock-filters">
        <WarehouseFilter
          owner={scope.owner}
          stores={scope.stores}
          value={scope.storeId}
          onChange={(storeId) => scope.filter({ storeId })}
        />
        <label>
          Tìm đơn nháp
          <input
            {...search}
            placeholder="Mã đơn, tên hoặc số điện thoại khách…"
          />
        </label>
      </div>
      <p className="sales-unmet-description">
        Nháp chỉ có ở tab này, chỉ bạn thấy và chưa giao việc lấy hàng. Mở nháp
        rồi bấm "Tạo đơn" để chốt thành đơn bán.
      </p>
      {notice && (
        <p className="stock-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="stock-notice stock-error" role="alert">
          {error}
        </p>
      )}
      <InventoryNotice
        loading={data.loading}
        error={data.error}
        onRetry={data.retry}
      />
      <div className="stock-table-scroll">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Mã nháp</th>
              {scope.owner && <th>Cửa hàng</th>}
              <th>Khách hàng</th>
              <th>Tổng tiền</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {data.data?.items.map((draft) => (
              <tr key={draft.id}>
                <td>
                  <Link to={'/sales-drafts/' + draft.id}>SO-{draft.id}</Link>
                </td>
                {scope.owner && <td>{draft.storeName}</td>}
                <td>{draft.customerName ?? 'Khách lẻ'}</td>
                <td>{draft.total == null ? '—' : money.format(draft.total)}</td>
                <td>{dateTime(draft.createdAt)}</td>
                <td>
                  <div className="mf-row-actions">
                    <Link
                      className="mf-btn mf-btn--sm mf-btn--primary"
                      to={'/sales-drafts/' + draft.id}
                    >
                      Mở nháp
                    </Link>
                    <button
                      type="button"
                      className="mf-btn mf-btn--sm mf-btn--danger"
                      onClick={() => setRemoving(draft)}
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.data && !data.data.items.length && (
              <tr>
                <td colSpan={columns} className="stock-empty">
                  Chưa có đơn nháp nào. Khi tạo đơn bán, bấm "Lưu nháp" để lưu
                  lại làm tiếp sau.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        total={data.data?.totalItems ?? 0}
        page={page}
        size={20}
        loading={data.loading}
        onPage={(next) =>
          scope.setParams((previous) => {
            const params = new URLSearchParams(previous)
            params.set('page', String(next))
            return params
          })
        }
      />
      {removing && (
        <ConfirmDialog
          title={'Xóa đơn nháp SO-' + removing.id + '?'}
          message="Đơn nháp bị xóa hẳn và không khôi phục được."
          confirmLabel="Xóa nháp"
          cancelLabel="Không xóa"
          danger
          onConfirm={async () => {
            const draft = removing
            setRemoving(undefined)
            await remove(draft)
          }}
          onCancel={() => setRemoving(undefined)}
        />
      )}
    </>
  )
}

export function SalesDraftFormPage() {
  const { id } = useParams()
  const valid = !!id && /^[1-9]\d*$/.test(id)
  const data = useInventoryData<OrderDto>(
    '/sales-orders/drafts/' + id,
    {},
    0,
    valid,
  )
  const customerId = data.data?.customerId
  const buyer = useInventoryData<{ customer: Customer }>(
    '/customers/' + customerId,
    {},
    0,
    !!customerId,
  )
  if (!valid)
    return (
      <main className="inventory-workspace sales-workspace">
        <PageBackLink to={salesDraftsPath} />
        <p role="status">Mã đơn nháp không hợp lệ.</p>
      </main>
    )
  if (!data.data || (customerId && !buyer.data))
    return (
      <main className="inventory-workspace sales-workspace">
        <PageBackLink to={salesDraftsPath} />
        <InventoryNotice
          loading={data.loading || buyer.loading}
          error={data.error ?? buyer.error}
          onRetry={data.error ? data.retry : buyer.retry}
        />
      </main>
    )
  if (data.data.status !== 'DRAFT')
    return (
      <main className="inventory-workspace sales-workspace">
        <PageBackLink to={salesDraftsPath} />
        <p role="status">
          Nháp này đã được tạo thành đơn bán.{' '}
          <Link to={'/sales-orders/' + data.data.id}>
            Xem đơn SO-{data.data.id}
          </Link>
        </p>
      </main>
    )
  return (
    <SalesOrderFormView
      key={data.data.id}
      initialCustomer={buyer.data?.customer}
      order={orderFromDto(data.data)}
    />
  )
}
