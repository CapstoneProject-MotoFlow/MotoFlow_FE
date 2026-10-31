import ConfirmDialog from '../../../shared/ui/ConfirmDialog'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import FormDialog from '../../../shared/ui/FormDialog'
import Icon from '../../../shared/ui/Icon'
import { apiMessage } from '../../suppliers/supplierService'
import './vehicle-models.css'
type Model = {
  id: number
  manufacturer: string
  modelName: string
  vehicleType: string
  yearFrom: number | null
  yearTo: number | null
  status: string
}
const types: Record<string, string> = {
  MOTORCYCLE: 'Xe máy',
  BICYCLE: 'Xe đạp',
  E_MOTORCYCLE: 'Xe máy điện',
  E_BICYCLE: 'Xe đạp điện',
}
export default function VehicleModelsPage() {
  const [rows, setRows] = useState<Model[]>([])
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Model | null | undefined>()
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirming, setConfirming] = useState<Model | null>(null)
  const [confirmError, setConfirmError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      axiosClient
        .get<Model[]>('/vehicle-models', {
          params: {
            q,
            vehicleType: type || undefined,
            status: status || undefined,
          },
        })
        .then(async (r) => {
          if (!active) return
          setRows(r.data)
          setLoading(false)
          const values: Record<number, number> = {}
          for (const row of r.data) {
            if (!active) return
            try {
              const result = await axiosClient.get('/products', {
                params: { vehicleModelId: row.id, size: 1 },
              })
              values[row.id] = result.data.totalItems
            } catch {
              /* A missing count is not zero. */
            }
          }
          if (active) setCounts(values)
        })
        .catch((e) => {
          if (active) {
            setError(apiMessage(e))
            setLoading(false)
          }
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [q, type, status, revision])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    const from = form.get('yearFrom')
    const to = form.get('yearTo')
    if (from && to && Number(from) > Number(to)) {
      setFormError('Năm bắt đầu phải nhỏ hơn hoặc bằng năm kết thúc.')
      return
    }
    const body = {
      manufacturer: String(form.get('manufacturer')).trim(),
      modelName: String(form.get('modelName')).trim(),
      vehicleType: form.get('vehicleType'),
      yearFrom: from ? Number(from) : null,
      yearTo: to ? Number(to) : null,
    }
    setBusy(true)
    setFormError('')
    try {
      if (editing) await axiosClient.put(`/vehicle-models/${editing.id}`, body)
      else await axiosClient.post('/vehicle-models', body)
      setEditing(undefined)
      setRevision((x) => x + 1)
    } catch (e) {
      setFormError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }
  async function toggle(row: Model) {
    if (busy) return
    setBusy(true)
    setConfirmError('')
    try {
      await axiosClient.post(
        `/vehicle-models/${row.id}/${row.status === 'ACTIVE' ? 'deactivate' : 'activate'}`,
      )
      setConfirming(null)
      setRevision((x) => x + 1)
    } catch (e) {
      setConfirmError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }
  function launch(row: Model | null) {
    setEditing(row)
    setFormError('')
  }
  const years = (row: Model) =>
    row.yearFrom && row.yearTo
      ? `${row.yearFrom}–${row.yearTo}`
      : row.yearFrom
        ? `Từ ${row.yearFrom}`
        : row.yearTo
          ? `Đến ${row.yearTo}`
          : '—'
  return (
    <main className="dashboard-content vehicle-page">
      <header className="vehicle-heading">
        <h1>Dòng xe</h1>
        <nav aria-label="Đường dẫn">
          <Link to="/dashboard">Trang chủ</Link>
          <span>›</span>
          <span>Danh mục</span>
          <span>›</span>
          <span>Dòng xe</span>
        </nav>
      </header>
      <section className="vehicle-panel">
        <header>
          <h2>Dòng xe</h2>
          <button className="vehicle-primary" onClick={() => launch(null)}>
            ＋ Thêm dòng xe
          </button>
        </header>
        <div className="vehicle-toolbar">
          <label className="vehicle-search">
            <Icon name="search" />
            <input
              type="search"
              aria-label="Tìm dòng xe"
              placeholder="Tìm theo hãng hoặc tên dòng xe"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label="Loại xe"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Mọi loại xe</option>
            {Object.entries(types).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Trạng thái"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Đang dùng</option>
            <option value="INACTIVE">Ngừng dùng</option>
          </select>
        </div>
        {error && (
          <p className="vehicle-message" role="alert">
            {error}{' '}
            <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
          </p>
        )}
        {loading ? (
          <p className="vehicle-message" role="status">
            Đang tải dòng xe…
          </p>
        ) : (
          <div className="vehicle-table">
            <table>
              <thead>
                <tr>
                  <th>Dòng xe</th>
                  <th>Loại xe</th>
                  <th>Đời xe</th>
                  <th className="vehicle-count">Phụ tùng tương thích</th>
                  <th>Trạng thái</th>
                  <th className="vehicle-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="vehicle-name">
                        <span className="vehicle-icon">
                          <Icon name="bike" />
                        </span>
                        <div>
                          <strong>{row.modelName}</strong>
                          <small>{row.manufacturer}</small>
                        </div>
                      </div>
                    </td>
                    <td>{types[row.vehicleType] || row.vehicleType}</td>
                    <td>{years(row)}</td>
                    <td className="vehicle-count">{counts[row.id] ?? '—'}</td>
                    <td>
                      <span
                        className={
                          'vehicle-status ' +
                          (row.status === 'ACTIVE' ? 'active' : '')
                        }
                      >
                        {row.status === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng'}
                      </span>
                    </td>
                    <td className="vehicle-actions">
                      <button disabled={busy} onClick={() => launch(row)}>
                        Sửa
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setConfirmError('')
                          setConfirming(row)
                        }}
                      >
                        {row.status === 'ACTIVE' ? 'Ngừng dùng' : 'Mở lại'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && !error && (
              <p className="vehicle-message">Không tìm thấy dòng xe phù hợp.</p>
            )}
          </div>
        )}
      </section>
      {editing !== undefined && (
        <FormDialog
          title={editing ? 'Sửa dòng xe' : 'Thêm dòng xe'}
          formId="vehicle-model-form"
          submitLabel={
            busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm dòng xe'
          }
          onClose={() => {
            if (!busy) setEditing(undefined)
          }}
        >
          <form
            id="vehicle-model-form"
            className="vehicle-form"
            onSubmit={save}
          >
            <fieldset disabled={busy}>
              <div className="vehicle-form-row">
                <label>
                  Hãng <b>*</b>
                  <input
                    name="manufacturer"
                    required
                    maxLength={100}
                    placeholder="Ví dụ: Honda"
                    defaultValue={editing?.manufacturer}
                  />
                </label>
                <label>
                  Tên dòng xe <b>*</b>
                  <input
                    name="modelName"
                    required
                    maxLength={100}
                    placeholder="Ví dụ: SH Mode 125"
                    defaultValue={editing?.modelName}
                  />
                </label>
              </div>
              <label>
                Loại xe <b>*</b>
                <select
                  name="vehicleType"
                  required
                  defaultValue={editing?.vehicleType || type || 'MOTORCYCLE'}
                >
                  {Object.entries(types).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="vehicle-form-row">
                <label>
                  Đời xe từ năm
                  <input
                    type="number"
                    name="yearFrom"
                    min={1900}
                    max={2100}
                    step={1}
                    placeholder="Ví dụ: 2020"
                    defaultValue={editing?.yearFrom ?? ''}
                  />
                </label>
                <label>
                  Đến năm
                  <input
                    type="number"
                    name="yearTo"
                    min={1900}
                    max={2100}
                    step={1}
                    placeholder="Để trống nếu vẫn sản xuất"
                    defaultValue={editing?.yearTo ?? ''}
                  />
                </label>
              </div>
            </fieldset>
            {formError && <p role="alert">{formError}</p>}
          </form>
        </FormDialog>
      )}
      {confirming && (
        <ConfirmDialog
          title={
            (confirming.status === 'ACTIVE'
              ? 'Ngừng dùng dòng xe '
              : 'Dùng lại dòng xe ') +
            confirming.manufacturer +
            ' ' +
            confirming.modelName +
            '?'
          }
          confirmLabel={
            confirming.status === 'ACTIVE' ? 'Ngừng dùng' : 'Dùng lại'
          }
          danger={confirming.status === 'ACTIVE'}
          onCancel={() => setConfirming(null)}
          onConfirm={() => toggle(confirming)}
          message={
            <div>
              {confirming.status === 'ACTIVE' ? (
                <>
                  <p>
                    Không chọn được dòng xe này cho khai báo tương thích mới.
                  </p>
                  <p>
                    {counts[confirming.id] == null
                      ? 'Các phụ tùng đã liên kết'
                      : counts[confirming.id] + ' phụ tùng đã liên kết'}{' '}
                    vẫn giữ dòng xe tương thích hiện có.
                  </p>
                  <p>Có thể bấm “Dùng lại” bất cứ lúc nào.</p>
                </>
              ) : (
                <p>Dòng xe sẽ được mở lại để chọn khi khai báo tương thích.</p>
              )}
              {confirmError && <p role="alert">{confirmError}</p>}
            </div>
          }
        />
      )}
    </main>
  )
}
