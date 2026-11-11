import { Link } from 'react-router-dom'
import { InventoryNotice } from '../../inventory/components'
import { dateTime } from '../../inventory/presentation'
import type { useBranchWork } from './useBranchWork'
export default function BranchWorkBoard({
  data,
  storeName,
}: {
  data: ReturnType<typeof useBranchWork>
  storeName: string
}) {
  return (
    <div className="bm-overview-columns">
      <section className="bm-panel">
        <h2>Việc đang chờ xử lý</h2>
        <InventoryNotice loading={data.loading} error={data.error} />
        <div className="bm-work-table">
          <table>
            <thead>
              <tr>
                <th>Chứng từ</th>
                <th>Việc</th>
                <th>Thời điểm</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 5).map((w) => (
                <tr key={w.key}>
                  <td>
                    <Link to={w.href}>{w.code}</Link>
                    <small>{w.kind}</small>
                  </td>
                  <td>
                    <strong>{w.title}</strong>
                    <small>{w.description}</small>
                  </td>
                  <td>
                    <small>{dateTime(w.at)}</small>
                  </td>
                  <td>
                    <Link className="bm-work-action" to={w.href}>
                      {w.action}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.loading && !data.error && !data.rows.length && (
            <p className="bm-work-empty">Chưa có việc cần xử lý.</p>
          )}
        </div>
        <footer>
          Hiển thị tối đa 5 việc từ các chứng từ gần đây trong phạm vi của bạn.
          Mở các thẻ phía trên để xem đầy đủ.
        </footer>
      </section>
      <aside className="bm-panel bm-monitor">
        <h2>Theo dõi</h2>
        <section>
          <p>Doanh số hôm nay</p>
          <strong>—</strong>
          <small>Chưa có số liệu tổng hợp</small>
        </section>
        <section>
          <p>Tồn dưới ngưỡng · {storeName}</p>
          <InventoryNotice
            loading={data.summary.loading}
            error={data.summary.error}
          />
          <strong>
            {data.summary.data ? data.summary.data.lowStock + ' dòng' : '—'}
          </strong>
          <Link to="/inventory?view=lowStock">Mở tồn kho</Link>
        </section>
        <section>
          <p>Lô sắp hết hạn</p>
          <InventoryNotice
            loading={data.lots.loading}
            error={data.lots.error}
          />
          <strong>
            {data.lots.data ? data.lots.data.page.totalItems + ' lô' : '—'}
          </strong>
          <Link to="/inventory/lots?tab=NEAR_EXPIRY">Mở danh sách lô</Link>
        </section>
      </aside>
    </div>
  )
}
