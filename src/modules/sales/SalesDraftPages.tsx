/**
 * File: modules/sales/SalesDraftPages.tsx
 * Loại: MÀN HÌNH — Đơn nháp (route /sales-drafts, /sales-drafts/:id).
 * Công dụng: Đơn bán lưu ở trạng thái DRAFT trên server. Mỗi người thấy các nháp mình đã lưu, mở lại để sửa,
 * chốt thành đơn bán ("Tạo đơn") hoặc xóa. Nháp không nằm trong danh sách Đơn bán và chưa giao việc lấy hàng.
 * API: GET/POST /sales-orders/drafts, GET/PUT/DELETE /sales-orders/drafts/{id}, POST /sales-orders/drafts/{id}/submit.
 */
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import PageBackLink from '../../shared/ui/PageBackLink'
import PageHeader from '../../shared/ui/PageHeader'
import {
  inventoryError,
  useInventoryData,
  useInventoryScope,
} from '../inventory/api'
import {
  InventoryNotice,
  InventoryPanel,
  Pagination,
  WarehouseFilter,
} from '../inventory/components'
import { dateTime, money } from '../inventory/presentation'
import type { Page } from '../inventory/types'
import type { Customer } from '../customers/types'
import { orderFromDto, type OrderDto, type SummaryDto } from './salesApi'
import { SalesOrderFormView } from './SalesOrderForm'
import './sales.css'

export function SalesDraftListPage() {
  const scope = useInventoryScope(),
    p = scope.params,
    page = Math.max(0, Number(p.get('page')) || 0)
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
    <main className="inventory-workspace sales-workspace">
      <PageHeader
        title="Đơn nháp"
        breadcrumb={[
          { label: 'Đơn bán', to: '/sales-orders' },
          { label: 'Đơn nháp' },
        ]}
      />
      <InventoryPanel
        title="Đơn nháp của tôi"
        action={
          <Link className="mf-btn mf-btn--primary" to="/sales-orders/new">
            Tạo đơn bán
          </Link>
        }
      >
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
              placeholder="Mã đơn, tên hoặc số điện thoại khách…"
              value={p.get('q') ?? ''}
              onChange={(e) => scope.filter({ q: e.target.value }, true)}
            />
          </label>
        </div>
        <p className="sales-unmet-description">
          Đơn nháp chưa vào danh sách Đơn bán và chưa giao việc lấy hàng. Mở
          nháp rồi bấm "Tạo đơn" để chốt thành đơn bán.
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
                  <td>
                    {draft.total == null ? '—' : money.format(draft.total)}
                  </td>
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
      </InventoryPanel>
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
    </main>
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
        <PageBackLink to="/sales-drafts" />
        <p role="status">Mã đơn nháp không hợp lệ.</p>
      </main>
    )
  if (!data.data || (customerId && !buyer.data))
    return (
      <main className="inventory-workspace sales-workspace">
        <PageBackLink to="/sales-drafts" />
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
        <PageBackLink to="/sales-drafts" />
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
