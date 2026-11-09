import { Link } from 'react-router-dom'
import { dateTime } from '../inventory/presentation'
import { states, type Replenishment } from './types'
export default function BranchReplenishmentDetail({
  request: d,
}: {
  request: Replenishment
}) {
  const code = 'YBS-' + String(d.id).padStart(4, '0')
  return (
    <main className="dashboard-content tf-page tf-branch-request">
      <header>
        <h1>Yêu cầu bổ sung {code}</h1>
        <nav>
          <Link to="/replenishment-requests">Yêu cầu bổ sung</Link> › {code}
        </nav>
      </header>
      <div className="tf-branch-grid">
        <div className="tf-branch-main">
          <section>
            <div className="tf-list-heading">
              <strong>{code}</strong>
              <span className={'tf-badge tf-status-' + d.status}>
                {states[d.status]}
              </span>
            </div>
            <div className="tf-stage-track">
              {[
                ['AWAITING_COORDINATION', 'Chờ điều phối'],
                ['IN_PROGRESS', 'Đang thực hiện'],
                ['CLOSED', 'Đã đóng'],
              ].map(([value, label], i) => (
                <span
                  key={value}
                  className={
                    i <=
                    ['AWAITING_COORDINATION', 'IN_PROGRESS', 'CLOSED'].indexOf(
                      d.status,
                    )
                      ? 'is-active'
                      : ''
                  }
                >
                  {label}
                </span>
              ))}
            </div>
            <dl className="tf-branch-fields">
              <div>
                <dt>Cửa hàng cần hàng</dt>
                <dd>{d.storeName}</dd>
              </div>
              <div>
                <dt>Người tạo</dt>
                <dd>
                  {d.createdByName}
                  <small>{dateTime(d.createdAt)}</small>
                </dd>
              </div>
              <div className="tf-full">
                <dt>Hàng về</dt>
                <dd>
                  {d.transferOrders.length
                    ? d.transferOrders.map((t) => (
                        <p key={t.id}>
                          <Link to={'/transfer-orders/' + t.id}>
                            DC-{String(t.id).padStart(4, '0')}
                          </Link>{' '}
                          từ {t.sourceStoreName} · {states[t.status]}
                        </p>
                      ))
                    : 'Đang chờ kho tổng điều phối'}
                </dd>
              </div>
              <div className="tf-full">
                <dt>Ghi chú</dt>
                <dd>{d.note || 'Không có ghi chú'}</dd>
              </div>
            </dl>
          </section>
          <section>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Yêu cầu</th>
                    <th>Đã lập kế hoạch</th>
                    <th>Đã nhận</th>
                    <th>Chuyển mua</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => (
                    <tr key={l.productId}>
                      <td>
                        {l.partName}
                        <small>{l.sku}</small>
                      </td>
                      <td>{l.requestedQty}</td>
                      <td>{l.plannedQty}</td>
                      <td>{l.fulfilledQty}</td>
                      <td>{l.toPurchaseQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2>Lệnh điều chuyển</h2>
            {d.transferOrders.map((t) => (
              <div className="tf-branch-transfer" key={t.id}>
                <Link to={'/transfer-orders/' + t.id}>
                  DC-{String(t.id).padStart(4, '0')} · {t.sourceStoreName} →{' '}
                  {d.storeName}
                </Link>
                <span className="tf-badge">{states[t.status]}</span>
              </div>
            ))}
            {!d.transferOrders.length && (
              <p className="tf-empty">Chưa có lệnh điều chuyển.</p>
            )}
          </section>
        </div>
        <aside>
          <section>
            <h2>Lịch sử</h2>
            <ol className="tf-order-history">
              <li>
                <strong>Tạo yêu cầu bổ sung</strong>
                <span>
                  {dateTime(d.createdAt)} · {d.createdByName}
                </span>
              </li>
              {d.transferOrders.map((t) => (
                <li key={t.id}>
                  <strong>Lệnh DC-{String(t.id).padStart(4, '0')}</strong>
                  <span>
                    {t.sourceStoreName} · {states[t.status]}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  )
}
