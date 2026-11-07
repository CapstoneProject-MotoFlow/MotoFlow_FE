import { useState, type FormEvent } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import FormDialog from '../../shared/ui/FormDialog'
import type { StockRow, ExpiryWarning } from './types'
import { date, dateTime, today } from './presentation'
import { inventoryError, useInventoryData } from './api'

export function StockSettingsDialog({
  row,
  mode,
  areas,
  onClose,
  onSaved,
}: {
  row: StockRow
  mode: 'location' | 'threshold'
  areas: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const fields = new FormData(event.currentTarget)
    const threshold = String(fields.get('threshold') ?? '').trim()
    if (
      mode === 'threshold' &&
      threshold &&
      (!Number.isInteger(Number(threshold)) ||
        Number(threshold) < 0 ||
        Number(threshold) > 1_000_000)
    ) {
      setError('Ngưỡng tồn phải là số nguyên từ 0 đến 1.000.000.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await axiosClient.put(
        '/inventory/stock/' +
          row.storeId +
          '/' +
          row.productId +
          (mode === 'location' ? '/location' : '/low-stock-threshold'),
        mode === 'location'
          ? {
              storageArea: String(fields.get('area') ?? '').trim() || null,
              binLocation: String(fields.get('bin') ?? '').trim() || null,
            }
          : { lowStockThreshold: threshold ? Number(threshold) : null },
      )
      onSaved()
    } catch (error) {
      setError(inventoryError(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <FormDialog
      title={
        (mode === 'location'
          ? 'Cập nhật vị trí · '
          : 'Đặt ngưỡng tồn tối thiểu · ') + row.partName
      }
      formId="stock-settings"
      submitLabel="Lưu thay đổi"
      busy={saving}
      onClose={onClose}
    >
      <form id="stock-settings" onSubmit={submit}>
        <p>
          {row.sku} · {row.storeName}
        </p>
        {mode === 'location' ? (
          <div className="stock-fields">
            <label>
              Khu vực{' '}
              <input
                name="area"
                list="stock-areas"
                defaultValue={row.storageArea ?? ''}
                maxLength={50}
                disabled={saving}
              />
            </label>
            <datalist id="stock-areas">
              {areas.map((area) => (
                <option key={area} value={area} />
              ))}
            </datalist>
            <label>
              Ô kệ{' '}
              <input
                name="bin"
                defaultValue={row.binLocation ?? ''}
                maxLength={50}
                disabled={saving}
              />
            </label>
          </div>
        ) : (
          <div className="stock-fields">
            <p>
              Khả dụng hiện tại: {row.availableQty} {row.baseUnit}
            </p>
            <label>
              Ngưỡng tồn tối thiểu{' '}
              <input
                name="threshold"
                type="number"
                min={0}
                max={1000000}
                defaultValue={row.lowStockThreshold ?? ''}
                disabled={saving}
              />
            </label>
            <small>
              Để trống để bỏ ngưỡng cảnh báo cho phụ tùng tại kho này.
            </small>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
      </form>
    </FormDialog>
  )
}

export function ExpiryWarningDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const current = useInventoryData<ExpiryWarning>('/inventory/expiry-warning')
  const [days, setDays] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  return (
    <FormDialog
      title="Cảnh báo hạn dùng"
      formId="expiry-warning"
      submitLabel="Lưu cảnh báo"
      busy={saving}
      onClose={onClose}
    >
      <form
        id="expiry-warning"
        onSubmit={async (event) => {
          event.preventDefault()
          if (saving || current.loading || !current.data) return
          const value = Number(days)
          if (
            !Number.isInteger(value) ||
            value < 1 ||
            value > 365 ||
            effectiveDate < today()
          ) {
            setError(
              'Nhập số ngày từ 1 đến 365 và ngày áp dụng từ hôm nay trở đi.',
            )
            return
          }
          setError('')
          setSaving(true)
          try {
            await axiosClient.put('/inventory/expiry-warning', {
              days: value,
              effectiveDate,
            })
            onSaved()
          } catch (error) {
            setError(inventoryError(error))
          } finally {
            setSaving(false)
          }
        }}
      >
        {current.loading && <p role="status">Đang tải cấu hình…</p>}
        {current.error && <p role="alert">{current.error}</p>}
        {current.data && (
          <>
            <div className="stock-warning-current">
              <div>
                <small>Đang áp dụng</small>
                <strong>
                  {current.data.inEffect
                    ? current.data.inEffect.days + ' ngày trước hạn dùng'
                    : 'Chưa đặt cảnh báo'}
                </strong>
              </div>
              <div>
                <small>Từ ngày</small>
                <strong>{date(current.data.inEffect?.effectiveFrom)}</strong>
              </div>
            </div>
            {current.data.waiting && (
              <p>
                Đang chờ áp dụng {current.data.waiting.days} ngày từ{' '}
                {date(current.data.waiting.effectiveFrom)}.
              </p>
            )}
            <div className="stock-fields stock-fields--two">
              <label>
                Số ngày cảnh báo trước hạn dùng{' '}
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  required
                  disabled={saving}
                  onChange={(event) => setDays(event.target.value)}
                />
              </label>
              <label>
                Áp dụng từ{' '}
                <input
                  type="date"
                  min={today()}
                  value={effectiveDate}
                  required
                  disabled={saving}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                />
              </label>
            </div>
            {!!days && (
              <p role="status">
                Cảnh báo trước {days} ngày, áp dụng từ {date(effectiveDate)}.
              </p>
            )}
            <h3>Các lần thay đổi</h3>
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Số ngày</th>
                    <th>Áp dụng</th>
                    <th>Người đặt</th>
                  </tr>
                </thead>
                <tbody>
                  {current.data.history.map((version) => (
                    <tr key={version.effectiveFrom}>
                      <td>{version.days}</td>
                      <td>{dateTime(version.effectiveFrom)}</td>
                      <td>{version.setByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </form>
    </FormDialog>
  )
}
