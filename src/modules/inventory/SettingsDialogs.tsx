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
  stockRows = [],
  onClose,
  onSaved,
}: {
  row: StockRow
  mode: 'location' | 'threshold'
  areas: string[]
  stockRows?: StockRow[]
  onClose: () => void
  onSaved: (row: StockRow) => void
}) {
  const [area, setArea] = useState(row.storageArea ?? '')
  const [bin, setBin] = useState(row.binLocation ?? '')
  const [thresholdValue, setThresholdValue] = useState(
    String(row.lowStockThreshold ?? ''),
  )
  const occupied = stockRows.filter(
    (item) =>
      item.storeId === row.storeId &&
      item.productId !== row.productId &&
      bin.trim() !== '' &&
      item.binLocation === bin.trim(),
  )
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
      const response = await axiosClient.put<StockRow>(
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
      onSaved(response.data)
    } catch (error) {
      setError(inventoryError(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <FormDialog
      title={
        mode === 'location'
          ? 'Cập nhật vị trí lưu kho'
          : 'Đặt ngưỡng tồn tối thiểu'
      }
      formId="stock-settings"
      submitLabel={mode === 'location' ? 'Lưu vị trí' : 'Lưu ngưỡng'}
      busy={saving}
      onClose={onClose}
    >
      <form id="stock-settings" onSubmit={submit}>
        <p>
          <strong>{row.partName}</strong>
          <br />
          {row.sku} · {row.storeName} · Khả dụng: {row.availableQty}{' '}
          {row.baseUnit}
        </p>
        {mode === 'location' ? (
          <div className="stock-fields">
            <label>
              Khu vực{' '}
              <input
                name="area"
                list="stock-areas"
                value={area}
                onChange={(e) => setArea(e.target.value)}
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
              Mã vị trí{' '}
              <input
                name="bin"
                value={bin}
                onChange={(e) => setBin(e.target.value)}
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
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                disabled={saving}
              />
            </label>
            <small>
              Để trống để bỏ ngưỡng cảnh báo cho phụ tùng tại kho này.
            </small>
            <p role="status">
              {thresholdValue === ''
                ? 'Không cảnh báo cho phụ tùng này.'
                : 'Với ngưỡng ' +
                  thresholdValue +
                  ' ' +
                  row.baseUnit +
                  ', tồn hiện tại ' +
                  row.availableQty +
                  ' sẽ là: ' +
                  (row.availableQty < Number(thresholdValue)
                    ? 'Dưới ngưỡng'
                    : 'Đủ hàng')}
              .
            </p>
          </div>
        )}
        {mode === 'location' && occupied.length > 0 && (
          <p role="status">
            Vị trí {bin} đang có{' '}
            {occupied
              .map((item) => item.partName + ' (' + item.sku + ')')
              .join(', ')}
            . Lưu thì các phụ tùng dùng chung một vị trí.
          </p>
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
  const [typedDays, setDays] = useState<string | null>(null)
  const days = typedDays ?? String(current.data?.inEffect?.days ?? '')
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
