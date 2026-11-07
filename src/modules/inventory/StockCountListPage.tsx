import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryScope } from './api'
import { InventoryHeader, InventoryPanel, WarehouseFilter } from './components'
import { StockCountFormDialog } from './StockCountFormDialog'
import './stock-count.css'

export default function StockCountListPage() {
  const scope = useInventoryScope()
  const staff = scope.user?.role === 'STAFF'
  const [dialog, setDialog] = useState(false)
  const p = scope.params
  const tabs = staff
    ? [
        ['TODO', 'Cần đếm'],
        ['SENT', 'Đã gửi, đã xong'],
      ]
    : [
        ...(scope.owner ? [['APPROVAL', 'Chờ Owner duyệt']] : []),
        ['OPEN', 'Đang mở'],
        ['COMPLETED', 'Hoàn tất'],
        ['CANCELLED', 'Đã hủy'],
        ['ALL', 'Tất cả'],
      ]
  const active = p.get('tab') ?? tabs[0][0]
  const closed = ['SENT', 'COMPLETED', 'CANCELLED', 'ALL'].includes(active)
  return (
    <main className="inventory-workspace count-workspace">
      <InventoryHeader title="Kiểm kê" />
      {!staff && !scope.owner && (
        <InventoryPanel
          title={
            scope.owner ? 'Yêu cầu kiểm kê đã gửi' : 'Yêu cầu kiểm kê của Owner'
          }
        >
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Yêu cầu</th>
                  {scope.owner && <th>Kho</th>}
                  <th>Phạm vi</th>
                  <th>Lý do</th>
                  <th>{scope.owner ? 'Trạng thái' : 'Cần làm'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={scope.owner ? 5 : 4} className="stock-empty">
                    Chức năng kiểm kê đang chờ BE hoàn thiện API.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </InventoryPanel>
      )}
      <InventoryPanel
        title={
          staff
            ? 'Việc kiểm kê của tôi'
            : scope.owner
              ? 'Phiếu kiểm kê các kho'
              : 'Phiếu kiểm kê · ' + scope.warehouse
        }
        action={
          !staff && (
            <button className="count-primary" onClick={() => setDialog(true)}>
              {scope.owner ? 'Yêu cầu kiểm kê' : 'Tạo phiếu kiểm kê'}
            </button>
          )
        }
      >
        <div className="stock-tabs" aria-label="Lọc phiếu kiểm kê">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              aria-pressed={active === value}
              className={active === value ? 'count-tab-active' : ''}
              onClick={() => scope.filter({ tab: value })}
            >
              {label}
            </button>
          ))}
        </div>
        {(scope.owner || closed) && (
          <div className="stock-filters">
            <WarehouseFilter
              owner={scope.owner}
              stores={scope.stores}
              value={scope.storeId}
              onChange={(storeId) => scope.filter({ storeId })}
            />
            {closed && (
              <>
                <label className="stock-filter">
                  <span>Từ ngày kiểm kê</span>
                  <input
                    type="date"
                    max={p.get('to') || undefined}
                    value={p.get('from') ?? ''}
                    onChange={(e) => scope.filter({ from: e.target.value })}
                  />
                </label>
                <label className="stock-filter">
                  <span>Đến ngày</span>
                  <input
                    type="date"
                    min={p.get('from') || undefined}
                    value={p.get('to') ?? ''}
                    onChange={(e) => scope.filter({ to: e.target.value })}
                  />
                </label>
              </>
            )}
          </div>
        )}
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Phiếu</th>
                {scope.owner && <th>Kho</th>}
                <th>{staff ? 'Phạm vi' : 'Phạm vi, ngày'}</th>
                {staff ? (
                  <>
                    <th>Ngày đếm</th>
                    <th>Số dòng</th>
                  </>
                ) : (
                  <>
                    <th>Người đếm</th>
                    <th>Chênh lệch</th>
                    {scope.owner && <th>Giá trị chênh lệch</th>}
                  </>
                )}
                <th>Trạng thái</th>
                <th>Cần làm</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  className="stock-empty"
                  colSpan={staff ? 6 : scope.owner ? 8 : 6}
                >
                  Chức năng kiểm kê đang chờ BE hoàn thiện API.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </InventoryPanel>
      {!staff && scope.owner && (
        <InventoryPanel
          title={
            scope.owner ? 'Yêu cầu kiểm kê đã gửi' : 'Yêu cầu kiểm kê của Owner'
          }
        >
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Yêu cầu</th>
                  {scope.owner && <th>Kho</th>}
                  <th>Phạm vi</th>
                  <th>Lý do</th>
                  <th>{scope.owner ? 'Trạng thái' : 'Cần làm'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={scope.owner ? 5 : 4} className="stock-empty">
                    Chức năng kiểm kê đang chờ BE hoàn thiện API.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </InventoryPanel>
      )}
      {scope.storesError && (
        <p role="alert" className="stock-error">
          {scope.storesError}
        </p>
      )}
      {(dialog ||
        scope.params.get('action') === (scope.owner ? 'request' : 'create')) &&
        !staff && (
          <StockCountFormDialog
            owner={scope.owner}
            storeId={scope.user?.storeId}
            onClose={() => {
              setDialog(false)
              scope.filter({ action: '' })
            }}
          />
        )}
    </main>
  )
}

export function CountBackLink() {
  return <Link to="/stock-counts">← Danh sách kiểm kê</Link>
}
