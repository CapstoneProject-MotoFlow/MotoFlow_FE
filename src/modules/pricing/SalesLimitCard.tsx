import { useRef, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import { date, percentValid, stateNames, today, type Limit } from './model'
export default function SalesLimitCard({
  title,
  type,
  limit,
  onSaved,
}: {
  title: string
  type: string
  limit: Limit
  onSaved: () => void
}) {
  const [rate, setRate] = useState(''),
    [effective, setEffective] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [all, setAll] = useState(false),
    lock = useRef(false)
  const valid = percentValid(rate) && effective >= today(),
    margin = type === 'MINIMUM_MARGIN'
  return (
    <section className="pricing-card pricing-limit-card">
      <div className="pricing-heading">
        <h2>{title}</h2>
        {margin && (
          <span
            className="pricing-help"
            title="Biên lợi nhuận tối thiểu so với giá vốn bình quân."
            aria-label="Biên lợi nhuận tối thiểu so với giá vốn bình quân."
          >
            ⓘ
          </span>
        )}
      </div>
      <div className="pricing-limit-body">
        <div className="pricing-current-limit">
          <strong>{limit.current ? limit.current.rate + '%' : '—'}</strong>
          <span>
            {limit.current
              ? 'đang áp dụng từ ' + date(limit.current.effectiveFrom)
              : 'Chưa thiết lập'}
          </span>
          {limit.scheduled && (
            <span className="pricing-badge">
              {limit.scheduled.rate}% từ {date(limit.scheduled.effectiveFrom)}
            </span>
          )}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!valid || lock.current) return
            lock.current = true
            setBusy(true)
            setError('')
            try {
              await axiosClient.put('/pricing/sales-limits', {
                limitType: type,
                rate: Number(rate),
                effectiveDate: effective,
              })
              setRate('')
              setEffective('')
              onSaved()
            } catch (err) {
              setError(inventoryError(err))
            } finally {
              lock.current = false
              setBusy(false)
            }
          }}
        >
          <div className="pricing-limit-inputs">
            <label>
              {margin ? 'Biên lợi nhuận mới' : 'Ngưỡng mới'} <span>*</span>
              <div className="pricing-percent-input">
                <input
                  aria-label={margin ? 'Biên lợi nhuận mới' : 'Ngưỡng mới'}
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={rate}
                  disabled={busy}
                  onChange={(e) => setRate(e.target.value)}
                />
                <span>%</span>
              </div>
            </label>
            <label>
              Áp dụng từ <span>*</span>
              <input
                aria-label={'Áp dụng từ · ' + title}
                required
                type="date"
                min={today()}
                value={effective}
                disabled={busy}
                onChange={(e) => setEffective(e.target.value)}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="pricing-negative">
              {error}
            </p>
          )}
          {limit.scheduled &&
            effective &&
            effective < limit.scheduled.effectiveFrom.slice(0, 10) && (
              <p className="pricing-notice">
                Mức {limit.scheduled.rate}% đã hẹn từ{' '}
                {date(limit.scheduled.effectiveFrom)} vẫn sẽ áp dụng vào ngày
                đó.
              </p>
            )}
          <button className="pricing-primary" disabled={!valid || busy}>
            {busy ? 'Đang lưu…' : margin ? 'Lưu biên lợi nhuận' : 'Lưu ngưỡng'}
          </button>
        </form>
      </div>
      <div className="pricing-table">
        <table>
          <thead>
            <tr>
              <th>Mức</th>
              <th>Áp dụng</th>
              <th>Người đặt</th>
            </tr>
          </thead>
          <tbody>
            {(all ? limit.history : limit.history.slice(0, 3)).map((v) => (
              <tr key={v.id}>
                <td>
                  <strong>{v.rate}%</strong>
                </td>
                <td>
                  {date(v.effectiveFrom)}
                  {v.effectiveTo && <> – {date(v.effectiveTo)}</>}
                  {v.state !== 'SUPERSEDED' && (
                    <span
                      className={
                        'pricing-history-state ' +
                        (v.state === 'ACTIVE' ? 'pricing-history-active' : '')
                      }
                    >
                      {v.state === 'SCHEDULED'
                        ? 'Sắp áp dụng'
                        : (stateNames[v.state] ?? v.state)}
                    </span>
                  )}
                </td>
                <td>
                  {v.setByName}
                  <small>
                    {date(v.setAt)} · {v.setAt.slice(11, 16)}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!limit.history.length && (
          <p className="pricing-empty">Chưa có lịch sử thay đổi.</p>
        )}
      </div>
      {limit.history.length > 3 && (
        <div className="pricing-history-footer">
          <button onClick={() => setAll((v) => !v)}>
            {all
              ? 'Thu gọn'
              : 'Xem tất cả ' + limit.history.length + ' lần thay đổi'}
          </button>
        </div>
      )}
    </section>
  )
}
