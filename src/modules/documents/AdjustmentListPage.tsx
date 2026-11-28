import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import type { Page } from '../inventory/types'
import Hint from '../../shared/ui/Hint'
import { formatDateTime, formatMoney } from '../../shared/utils/format'
import { Card, Pager, Result, Status, Table } from './DocumentUi'
import {
  adjustmentPath,
  adjustmentStatuses,
  adjustmentTypes,
  pageIndex,
} from './model'
import type { AdjustmentSummary } from './types'

export default function AdjustmentListPage() {
  const {
    owner,
    warehouse,
    stores,
    storesError,
    storeId,
    params,
    setParams,
    filter,
  } = useInventoryScope()
  const tabs = [
    [
      'open',
      owner ? 'Chờ duyệt' : 'Nháp, chờ duyệt',
      owner ? 'PENDING' : 'DRAFT,PENDING',
    ],
    ['approved', 'Đã duyệt', 'APPROVED'],
    ['applied', 'Đã áp dụng', 'APPLIED'],
    ['closed', 'Từ chối / Đã rút', 'REJECTED,WITHDRAWN'],
    ['all', 'Tất cả', ''],
  ]
  const [current, , status] =
    tabs.find(([key]) => key === params.get('tab')) ?? tabs[0]
  const type = params.get('type') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const dateError = !!from && !!to && from > to
  const request = useInventoryData<Page<AdjustmentSummary>>(
    '/adjustment-requests',
    {
      type: Object.hasOwn(adjustmentTypes, type) ? type : '',
      status,
      storeId,
      from,
      to,
      page: pageIndex(params.get('page')),
      size: 20,
    },
    0,
    !dateError,
    { live: true },
  )
  return (
    <div className="docs-page">
      <Card
        title={
          owner
            ? 'Yêu cầu điều chỉnh các cửa hàng'
            : 'Yêu cầu điều chỉnh · ' + warehouse
        }
        actions={
          <Link className="mf-btn mf-btn--primary" to="/adjustments/new">
            Báo mất, hỏng hàng
          </Link>
        }
      >
        <Hint>
          Chênh lệch kiểm kê được ghi thẳng vào tồn kho khi Chủ cửa hàng duyệt
          phiếu; xem ở{' '}
          <Link to="/inventory/movements?movementType=COUNT_ADJUSTMENT">
            Lịch sử xuất nhập
          </Link>
          , loại Điều chỉnh kiểm kê.
        </Hint>
        <div className="docs-tabs" aria-label="Trạng thái yêu cầu">
          {tabs.map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={current === value}
              onClick={() => filter({ tab: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="docs-filters">
          <label>
            Loại
            <select
              value={type}
              onChange={(event) => filter({ type: event.target.value })}
            >
              <option value="">Mọi loại</option>
              {Object.entries(adjustmentTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {owner && (
            <label>
              Cửa hàng
              <select
                value={storeId}
                onChange={(event) => filter({ storeId: event.target.value })}
              >
                <option value="">Mọi cửa hàng</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Từ ngày
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => filter({ from: event.target.value })}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => filter({ to: event.target.value })}
            />
          </label>
        </div>
        {storesError && (
          <p role="alert" className="docs-muted">
            Không tải được danh sách cửa hàng.
          </p>
        )}
        {dateError ? (
          <p role="alert" className="docs-alert">
            Từ ngày phải trước hoặc bằng đến ngày.
          </p>
        ) : (
          <Result request={request}>
            {(page) => (
              <>
                {page.items.length ? (
                  <Table
                    label="Danh sách yêu cầu điều chỉnh"
                    headers={[
                      'Yêu cầu',
                      ...(owner ? ['Cửa hàng'] : []),
                      'Nội dung',
                      ...(owner ? ['Chênh lệch tiền'] : []),
                      'Người đề nghị',
                      'Trạng thái',
                      'Thao tác',
                    ]}
                  >
                    {page.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link to={adjustmentPath(item.id)}>
                            {item.number}
                          </Link>
                          <small>
                            {adjustmentTypes[item.adjustmentType] ??
                              item.adjustmentType}
                          </small>
                        </td>
                        {owner && <td>{item.storeName}</td>}
                        <td>
                          {item.reason}
                          {item.source && (
                            <small>Chứng từ gốc {item.source.number}</small>
                          )}
                        </td>
                        {owner && (
                          <td>
                            {item.totalValue != null
                              ? formatMoney(item.totalValue)
                              : ''}
                          </td>
                        )}
                        <td>
                          {item.requestedBy?.fullName}
                          <small>{formatDateTime(item.submittedAt)}</small>
                        </td>
                        <td>
                          <Status
                            value={item.status}
                            label={
                              adjustmentStatuses[item.status] ?? item.status
                            }
                          />
                        </td>
                        <td>
                          <Link
                            className={
                              owner && item.status === 'PENDING'
                                ? 'mf-btn mf-btn--primary'
                                : 'mf-btn mf-btn--secondary'
                            }
                            to={adjustmentPath(item.id)}
                          >
                            {owner && item.status === 'PENDING'
                              ? 'Xem và duyệt'
                              : 'Xem'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <p className="docs-message">Không có yêu cầu phù hợp.</p>
                )}
                <Pager
                  page={page}
                  noun="yêu cầu"
                  onPage={(index) =>
                    setParams((previous) => {
                      const next = new URLSearchParams(previous)
                      next.set('page', String(index))
                      return next
                    })
                  }
                />
              </>
            )}
          </Result>
        )}
      </Card>
    </div>
  )
}
