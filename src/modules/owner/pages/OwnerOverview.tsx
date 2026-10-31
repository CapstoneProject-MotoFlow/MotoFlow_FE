import { getHome } from '../../../shared/api/homeService'
import { useEffect, useState } from 'react'
import Icon, { type IconName } from '../../../shared/ui/Icon'
import '../owner.css'

const metrics: {
  key: string
  title: string
  icon: IconName
  tone: string
  target: string
  action: string
}[] = [
  {
    key: 'ADJUSTMENTS_AWAITING_APPROVAL',
    title: 'Điều chỉnh chờ duyệt',
    icon: 'box',
    tone: 'amber',
    target: 'owner-receipts',
    action: 'Xác nhận',
  },
  {
    key: 'EXCESS_AWAITING_DECISION',
    title: 'Hàng thừa chờ quyết định',
    icon: 'clipboard',
    tone: 'amber',
    target: 'owner-requests',
    action: 'Xem',
  },
  {
    key: 'STOCK_COUNTS_AWAITING_APPROVAL',
    title: 'Kiểm kê chờ duyệt',
    icon: 'alert',
    tone: 'red',
    target: 'owner-requests',
    action: 'Xem',
  },
  {
    key: 'REPLENISHMENTS_AWAITING_COORDINATION',
    title: 'Bổ sung chờ điều phối',
    icon: 'inventory',
    tone: 'slate',
    target: 'owner-stock',
    action: 'Xem',
  },
]
export default function OwnerOverview() {
  const [notice, setNotice] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    let active = true
    getHome()
      .then((response) => {
        if (active)
          setCounts(
            Object.fromEntries(
              response.data.shortcuts.map(
                (item: { key: string; count: number }) => [
                  item.key,
                  item.count,
                ],
              ),
            ),
          )
      })
      .catch(() => {
        if (active) setNotice('Không tải được tổng quan.')
      })
    return () => {
      active = false
    }
  }, [])
  return (
    <div className="owner-overview">
      <section className="owner-metrics" aria-label="Tổng quan hoạt động">
        {metrics.map((metric) => (
          <article className="owner-metric" key={metric.title}>
            <span className={'owner-metric-icon owner-icon-' + metric.tone}>
              <Icon name={metric.icon} />
            </span>
            <p>{metric.title}</p>
            <div>
              <strong>{counts[metric.key] ?? '—'}</strong>
              <a href={'#' + metric.target}>{metric.action} →</a>
            </div>
          </article>
        ))}
      </section>
      <div className="owner-columns">
        <div className="owner-primary">
          <section className="owner-panel" id="owner-requests">
            <div className="owner-panel-heading">
              <h2>Yêu cầu nhập hàng gần đây</h2>
              <button
                type="button"
                onClick={() =>
                  setNotice(
                    'Danh sách yêu cầu nhập hàng chưa có dữ liệu từ hệ thống.',
                  )
                }
              >
                Xem tất cả
              </button>
            </div>
            <div className="owner-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Yêu cầu</th>
                    <th>Kho nhận</th>
                    <th>Trạng thái, cần xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="owner-empty">
                      Chưa có dữ liệu yêu cầu nhập hàng.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section className="owner-panel" id="owner-receipts">
            <div className="owner-panel-heading">
              <h2>Lượt nhận hàng gần đây</h2>
            </div>
            <div className="owner-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Lượt nhận</th>
                    <th>Người ghi, hàng đến</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="owner-empty">
                      Chưa có dữ liệu lượt nhận hàng.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <section className="owner-panel owner-stock" id="owner-stock">
          <div className="owner-panel-heading">
            <h2>Tồn cần chú ý</h2>
            <button
              type="button"
              onClick={() =>
                setNotice(
                  'Chưa có dữ liệu tồn kho và ngưỡng cảnh báo từ hệ thống.',
                )
              }
            >
              Mở tồn kho
            </button>
          </div>
          <p className="owner-empty">Chưa có dữ liệu cảnh báo tồn kho.</p>
        </section>
      </div>
      {notice && (
        <div className="owner-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
