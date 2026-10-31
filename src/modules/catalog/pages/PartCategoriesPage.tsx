import ConfirmDialog from '../../../shared/ui/ConfirmDialog'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import FormDialog from '../../../shared/ui/FormDialog'
import Icon from '../../../shared/ui/Icon'
import { apiMessage } from '../../suppliers/supplierService'
import './part-categories.css'
type Category = {
  id: number
  categoryName: string
  vehicleType: string
  parentId: number | null
  description: string | null
  productCount: number
  status: string
  children: Category[]
}
const types: Record<string, string> = {
  MOTORCYCLE: 'Xe máy',
  BICYCLE: 'Xe đạp',
  E_MOTORCYCLE: 'Xe máy điện',
  E_BICYCLE: 'Xe đạp điện',
}
const flatten = (rows: Category[]): Category[] =>
  rows.flatMap((row) => [row, ...flatten(row.children || [])])
export default function PartCategoriesPage() {
  const [rows, setRows] = useState<Category[]>([])
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [tab, setTab] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<number[]>([])
  const [editing, setEditing] = useState<Category | null | undefined>()
  const [parent, setParent] = useState<Category | null>(null)
  const [vehicle, setVehicle] = useState('MOTORCYCLE')
  const [description, setDescription] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [confirming, setConfirming] = useState<Category | null>(null)
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    axiosClient
      .get<Category[]>('/part-categories')
      .then((response) => {
        if (!active) return
        setRows(response.data)
        setLoading(false)
        setCounts(
          Object.fromEntries(
            flatten(response.data).map((row) => [row.id, row.productCount]),
          ),
        )
      })
      .catch((e) => {
        if (active) {
          setError(apiMessage(e))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [revision])
  function launch(row: Category | null, ancestor: Category | null = null) {
    setEditing(row)
    setParent(ancestor)
    setVehicle(row?.vehicleType || ancestor?.vehicleType || tab || 'MOTORCYCLE')
    setDescription(!!row?.description)
    setFormError('')
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setFormError('')
    const payload = {
      categoryName: String(form.get('categoryName')).trim(),
      vehicleType: vehicle,
      parentId: parent?.id ?? editing?.parentId ?? null,
      description: form.get('description') || null,
    }
    try {
      if (editing)
        await axiosClient.put(`/part-categories/${editing.id}`, payload)
      else await axiosClient.post('/part-categories', payload)
      setEditing(undefined)
      setRevision((x) => x + 1)
    } catch (e) {
      setFormError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }
  async function toggle(row: Category) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await axiosClient.post(
        `/part-categories/${row.id}/${row.status === 'ACTIVE' ? 'deactivate' : 'activate'}`,
      )
      setConfirming(null)
      setRevision((x) => x + 1)
    } catch (e) {
      setConfirmError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const all = flatten(rows)
  const text = query.trim().toLocaleLowerCase('vi')
  const matches = (row: Category): boolean =>
    row.categoryName.toLocaleLowerCase('vi').includes(text) ||
    row.children.some(matches)
  // Render child rows in one tbody so the table keeps valid HTML.
  function visibleRows(
    row: Category,
    depth = 0,
  ): { row: Category; depth: number }[] {
    if (!matches(row)) return []
    return [
      { row, depth },
      ...(open.includes(row.id) || text
        ? row.children.flatMap((child) => visibleRows(child, depth + 1))
        : []),
    ]
  }
  return (
    <main className="dashboard-content category-page">
      <header className="category-heading">
        <h1>Nhóm phụ tùng</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link>
          <span>›</span>
          <span>Danh mục</span>
          <span>›</span>
          <span>Nhóm phụ tùng</span>
        </nav>
      </header>
      <section className="category-panel">
        <header>
          <h2>Nhóm phụ tùng theo loại xe</h2>
          <button className="category-primary" onClick={() => launch(null)}>
            ＋ Thêm nhóm phụ tùng
          </button>
        </header>
        <div className="category-tools">
          <div
            className="category-tabs"
            role="group"
            aria-label="Lọc theo loại xe"
          >
            {[['', 'Tất cả'], ...Object.entries(types)].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={tab === key}
                className={tab === key ? 'selected' : ''}
                onClick={() => setTab(key)}
              >
                {label}
                <span>
                  {all.filter((row) => !key || row.vehicleType === key).length}
                </span>
              </button>
            ))}
          </div>
          <label className="category-search">
            <Icon name="search" />
            <input
              placeholder="Tìm tên nhóm hoặc nhóm con"
              aria-label="Tìm nhóm phụ tùng"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="category-message" role="alert">
            {error}
            <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
          </p>
        )}
        {loading ? (
          <p className="category-message">Đang tải nhóm phụ tùng…</p>
        ) : (
          <div className="category-table">
            <table>
              <thead>
                <tr>
                  <th>Tên nhóm</th>
                  <th>Loại xe</th>
                  <th className="category-count">
                    Số
                    <br />
                    phụ tùng
                  </th>
                  <th>Trạng thái</th>
                  <th className="category-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((row) => !tab || row.vehicleType === tab)
                  .flatMap((row) => visibleRows(row))
                  .map(({ row, depth }) => {
                    return (
                      <CategoryRow
                        key={row.id}
                        row={row}
                        depth={depth}
                        expanded={open.includes(row.id) || !!text}
                        count={counts[row.id]}
                        busy={busy}
                        onExpand={() =>
                          setOpen((value) =>
                            value.includes(row.id)
                              ? value.filter((id) => id !== row.id)
                              : [...value, row.id],
                          )
                        }
                        onChild={() => launch(null, row)}
                        onEdit={() => launch(row)}
                        onToggle={() => {
                          setConfirmError('')
                          setConfirming(row)
                        }}
                      />
                    )
                  })}
              </tbody>
            </table>
            {!rows.filter(
              (row) => (!tab || row.vehicleType === tab) && matches(row),
            ).length && (
              <p className="category-message">Không tìm thấy nhóm phù hợp.</p>
            )}
          </div>
        )}
      </section>
      {editing !== undefined && (
        <FormDialog
          busy={busy}
          title={
            editing
              ? 'Sửa nhóm phụ tùng'
              : parent
                ? 'Thêm nhóm con'
                : 'Thêm nhóm phụ tùng'
          }
          formId="category-form"
          submitLabel={
            busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm nhóm'
          }
          onClose={() => {
            if (!busy) setEditing(undefined)
          }}
        >
          <form id="category-form" className="category-form" onSubmit={save}>
            <fieldset disabled={busy}>
              <legend>
                Loại xe <b>*</b>
              </legend>
              <div className="category-radio-grid">
                {Object.entries(types).map(([key, label]) => (
                  <label
                    key={key}
                    className={vehicle === key ? 'selected' : ''}
                  >
                    <input
                      type="radio"
                      name="vehicleType"
                      value={key}
                      checked={vehicle === key}
                      disabled={!!parent || editing?.parentId != null}
                      onChange={() => setVehicle(key)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {parent && (
                <p>
                  Nhóm cha: <strong>{parent.categoryName}</strong>
                </p>
              )}
              <label className="category-name-field">
                Tên nhóm <b>*</b>
                <input
                  name="categoryName"
                  required
                  maxLength={100}
                  defaultValue={editing?.categoryName}
                />
              </label>
              {description ? (
                <label className="category-name-field">
                  Mô tả
                  <textarea
                    name="description"
                    maxLength={500}
                    rows={3}
                    defaultValue={editing?.description || ''}
                  />
                </label>
              ) : (
                <button
                  type="button"
                  className="category-description"
                  onClick={() => setDescription(true)}
                >
                  ＋ Thêm mô tả
                </button>
              )}
            </fieldset>
            {formError && <p role="alert">{formError}</p>}
          </form>
        </FormDialog>
      )}
      {confirming && (
        <ConfirmDialog
          title={
            confirming.status === 'ACTIVE'
              ? 'Ngừng dùng nhóm ' + confirming.categoryName + '?'
              : 'Dùng lại nhóm ' + confirming.categoryName + '?'
          }
          confirmLabel={
            confirming.status === 'ACTIVE' ? 'Ngừng dùng' : 'Dùng lại'
          }
          danger={confirming.status === 'ACTIVE'}
          onCancel={() => setConfirming(null)}
          onConfirm={() => toggle(confirming)}
          message={
            <div className="category-confirm-content">
              {confirming.status === 'ACTIVE' ? (
                <>
                  <p>⊘ Không chọn được nhóm này cho phụ tùng mới.</p>
                  <p>
                    ◇{' '}
                    {counts[confirming.id] != null
                      ? counts[confirming.id] + ' phụ tùng đang thuộc nhóm'
                      : 'Phụ tùng đang thuộc nhóm'}{' '}
                    giữ nguyên nhóm, vẫn bán và nhập bình thường.
                  </p>
                  <p>↻ Có thể bấm “Dùng lại” bất cứ lúc nào.</p>
                </>
              ) : (
                <p>Nhóm sẽ được mở lại để chọn cho phụ tùng.</p>
              )}
              {confirmError && <p role="alert">{confirmError}</p>}
            </div>
          }
        />
      )}
    </main>
  )
}
function CategoryRow({
  row,
  depth,
  expanded,
  count,
  busy,
  onExpand,
  onChild,
  onEdit,
  onToggle,
}: {
  row: Category
  depth: number
  expanded: boolean
  count: number | undefined
  busy: boolean
  onExpand: () => void
  onChild: () => void
  onEdit: () => void
  onToggle: () => void
}) {
  return (
    <tr>
      <td>
        <div className="category-name" style={{ paddingLeft: depth * 26 }}>
          {row.children.length ? (
            <button
              className="category-expand"
              aria-label={`${expanded ? 'Thu gọn' : 'Mở rộng'} ${row.categoryName}`}
              aria-expanded={expanded}
              onClick={onExpand}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          ) : (
            <span className="category-leaf" />
          )}
          <strong>{row.categoryName}</strong>
          {!!row.children.length && (
            <small>{row.children.length} nhóm con</small>
          )}
        </div>
      </td>
      <td>{types[row.vehicleType] || row.vehicleType}</td>
      <td className="category-count">{count ?? '—'}</td>
      <td>
        <span
          className={
            'category-status ' + (row.status === 'ACTIVE' ? 'active' : '')
          }
        >
          {row.status === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng'}
        </span>
      </td>
      <td className="category-actions">
        <button disabled={busy || row.status !== 'ACTIVE'} onClick={onChild}>
          ＋ Nhóm con
        </button>
        <button disabled={busy} onClick={onEdit}>
          Sửa
        </button>
        <button disabled={busy} onClick={onToggle}>
          {row.status === 'ACTIVE' ? 'Ngừng dùng' : 'Mở lại'}
        </button>
      </td>
    </tr>
  )
}
