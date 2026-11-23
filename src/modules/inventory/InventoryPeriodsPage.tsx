import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { formatDateTime, formatMoney } from '../../shared/utils/format'
import { useInventoryData, useInventoryScope, inventoryError } from './api'
import { InventoryHeader, InventoryNotice, Pagination } from './components'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { categoryOptions, type Category } from '../catalog/api/searchProducts'
import type { Page } from './types'
import './inventory-screens.css'

type PeriodRow = {
  id: number
  month: string
  fromDate: string
  toDate: string
  status: 'OPEN' | 'CLOSED'
  closedBy: number | null
  closedByName: string | null
  closedAt: string | null
  nextToClose: boolean
}
type BalanceRow = {
  storeId: number
  storeName: string
  productId: number
  sku: string
  partName: string
  baseUnit: string
  openingQty: number
  openingValue: number
  inQty: number
  inValue: number
  outQty: number
  outValue: number
  closingQty: number
  closingValue: number
  inTransitQty: number
  inTransitValue: number
  periodAvgUnitCost: number | null
}
type Totals = {
  openingValue: number
  inValue: number
  outValue: number
  closingValue: number
  inTransitValue: number
}
type Balances = {
  period: PeriodRow
  provisional: boolean
  totals: Totals
  page: Page<BalanceRow>
}
type ClosingPreview = {
  period: PeriodRow
  canClose: boolean
  reason: string | null
  blockingCounts: { id: number; storeName: string; countType: string; countDate: string; status: string }[]
  unconfirmedReceipts: { id: number; storeName: string; receiptType: string; arrivedAt: string; status: string }[]
  transfersInTransit: { id: number; sourceStoreName: string; destStoreName: string; dispatchedAt: string; status: string }[]
  balanceRows: number
  totals: Totals
}
const periodStatus: Record<string, string> = { OPEN: 'Đang mở', CLOSED: 'Đã đóng' }
const shortDate = (value: string) => value.slice(0, 10).split('-').reverse().join('/')

export default function InventoryPeriodsPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const scope = useInventoryScope()
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [storeId, setStoreId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [closing, setClosing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const categories = useInventoryData<Category[]>('/part-categories')
  useEffect(() => {
    if (id && searchParams.get('close') === '1') setClosing(true)
  }, [id, searchParams])
  const periods = useInventoryData<PeriodRow[]>('/inventory-periods', {}, revision)
  const balances = useInventoryData<Balances>(
    id ? `/inventory-periods/${id}/balances` : '',
    { storeId: storeId || undefined, q: query.trim() || undefined, categoryId: categoryId || undefined, page, size: 20 },
    revision,
    !!id,
  )
  const preview = useInventoryData<ClosingPreview>(
    id && closing ? `/inventory-periods/${id}/closing-preview` : '',
    {},
    revision,
    !!id && closing,
  )
  const years = useMemo(
    () => [...new Set((periods.data ?? []).map((item) => item.month.slice(0, 4)))].sort().reverse(),
    [periods.data],
  )
  const rows = (periods.data ?? []).filter((item) => year === 'all' || item.month.startsWith(year))

  async function closePeriod() {
    if (!id || busy || !confirmed || !preview.data?.canClose) return
    setBusy(true)
    setError('')
    try {
      await axiosClient.post(`/inventory-periods/${id}/close`)
      setClosing(false)
      setConfirmed(false)
      setRevision((value) => value + 1)
    } catch (failure) {
      setError(inventoryError(failure))
    } finally {
      setBusy(false)
    }
  }

  if (!id) {
    return (
      <main className="inventory-workspace inventory-screen period-screen">
        <InventoryNotice loading={periods.loading} error={periods.error} onRetry={periods.reload} />
        <section className="stock-panel">
          <header className="stock-panel-heading"><h2>Các kỳ kho</h2></header>
          <div className="period-toolbar">
            <label>Năm<select value={year} onChange={(event) => setYear(event.target.value)}>
              {years.map((value) => <option key={value} value={value}>{value}</option>)}
              <option value="all">Mọi năm</option>
            </select></label>
            {periods.data?.length ? <p>Kỳ kho được đóng theo thứ tự. Kỳ chờ đóng được đánh dấu bên dưới.</p> : null}
          </div>
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead><tr><th>Kỳ</th><th>Trạng thái</th><th>Người đóng</th><th>Đóng lúc</th><th>Thao tác</th></tr></thead>
              <tbody>
                {rows.map((period) => <tr key={period.id}>
                  <td><strong>Kỳ {Number(period.month.slice(5))}/{period.month.slice(0, 4)}</strong><small>{shortDate(period.fromDate)} – {shortDate(period.toDate)}</small></td>
                  <td><span className={`stock-badge stock-badge--${period.status.toLowerCase()}`}>{periodStatus[period.status]}</span>{period.nextToClose && <small className="period-waiting">Chờ đóng</small>}</td>
                  <td>{period.closedByName ?? '—'}</td>
                  <td>{period.closedAt ? formatDateTime(period.closedAt) : '—'}</td>
                  <td className="period-actions"><Link className="mf-btn mf-btn--secondary" to={`/inventory/periods/${period.id}`}>Nhập, xuất, tồn</Link>{period.nextToClose && <Link className="mf-btn mf-btn--primary" to={`/inventory/periods/${period.id}?close=1`}>Đóng kỳ</Link>}</td>
                </tr>)}
                {!periods.loading && !rows.length && <tr><td colSpan={5}>Không có kỳ kho trong năm đã chọn.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    )
  }

  const data = balances.data
  return (
    <main className="inventory-workspace inventory-screen period-screen">
      <InventoryHeader title={data ? `Kỳ ${Number(data.period.month.slice(5))}/${data.period.month.slice(0, 4)}` : 'Chi tiết kỳ kho'}>
        <Link className="mf-btn mf-btn--secondary" to="/inventory/periods">Các kỳ kho</Link>
        {data?.period.nextToClose && <button className="mf-btn mf-btn--primary" onClick={() => { setClosing(true); setConfirmed(false); setError('') }}>Đóng kỳ</button>}
      </InventoryHeader>
      <InventoryNotice loading={balances.loading} error={balances.error} onRetry={balances.reload} />
      {data && <>
        <div className="period-status-line"><span className={`stock-badge stock-badge--${data.period.status.toLowerCase()}`}>{periodStatus[data.period.status]}</span>{data.provisional && <span className="period-provisional">Tạm tính · kỳ đang mở</span>}</div>
        <section className="period-totals">
          {[['Tồn đầu kỳ', data.totals.openingValue], ['Nhập trong kỳ', data.totals.inValue], ['Xuất trong kỳ', data.totals.outValue], ['Tồn cuối kỳ', data.totals.closingValue]].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{formatMoney(Number(value))}</strong></article>)}
        </section>
        <section className="stock-panel">
          <header className="stock-panel-heading"><h2>Nhập, xuất, tồn · Kỳ {Number(data.period.month.slice(5))}/{data.period.month.slice(0, 4)}</h2></header>
          <div className="period-toolbar period-filters">
            {scope.owner && <label>Cửa hàng<select value={storeId} onChange={(event) => {setStoreId(event.target.value); setPage(0)}}><option value="">Mọi cửa hàng</option>{scope.stores.map((item) => <option key={item.id} value={item.id}>{item.storeName}</option>)}</select></label>}
            <label>Tìm phụ tùng<input value={query} onChange={(event) => {setQuery(event.target.value); setPage(0)}} placeholder="Tên hoặc SKU" /></label>
            <div className="period-category-filter"><span>Nhóm phụ tùng</span><SearchableFilter label="Nhóm phụ tùng" value={categoryId} options={[{ value: '', label: 'Mọi nhóm phụ tùng' }, ...categoryOptions(categories.data ?? []).map((category) => ({ value: String(category.id), label: category.label ?? category.categoryName }))]} onChange={(value) => { setCategoryId(value); setPage(0) }} /></div>
          </div>
          <div className="stock-table-scroll"><table className="stock-table">
            <thead><tr><th>Cửa hàng</th><th>Phụ tùng</th><th>Tồn đầu kỳ</th><th>Nhập trong kỳ</th><th>Xuất trong kỳ</th><th>Tồn cuối kỳ</th><th>Đang đi đường</th><th>Giá vốn bình quân kỳ</th></tr></thead>
            <tbody>{data.page.items.map((row) => <tr key={`${row.storeId}:${row.productId}`}>
              <td>{row.storeName}</td><td><strong>{row.partName}</strong><small>{row.sku}</small></td>
              <td>{row.openingQty.toLocaleString('vi-VN')} {row.baseUnit}<small>{formatMoney(row.openingValue)}</small></td>
              <td>{row.inQty.toLocaleString('vi-VN')} {row.baseUnit}<small>{formatMoney(row.inValue)}</small></td>
              <td>{row.outQty.toLocaleString('vi-VN')} {row.baseUnit}<small>{formatMoney(row.outValue)}</small></td>
              <td><strong>{row.closingQty.toLocaleString('vi-VN')} {row.baseUnit}</strong><small>{formatMoney(row.closingValue)}</small></td>
              <td>{row.inTransitQty.toLocaleString('vi-VN')} {row.baseUnit}<small>{formatMoney(row.inTransitValue)}</small></td>
              <td>{row.periodAvgUnitCost == null ? '—' : formatMoney(row.periodAvgUnitCost)}</td>
            </tr>)}{!data.page.items.length && <tr><td colSpan={8}>Không có phụ tùng khớp bộ lọc.</td></tr>}</tbody>
          </table></div>
          <Pagination total={data.page.totalItems} page={page} size={data.page.size} loading={balances.loading} onPage={setPage} />
        </section>
      </>}
      {closing && <div className="period-modal-backdrop"><section className="period-modal" role="dialog" aria-modal="true" aria-labelledby="period-close-title">
        <header><h2 id="period-close-title">Đóng kỳ kho</h2><button type="button" aria-label="Đóng" onClick={() => {setClosing(false); if (searchParams.has('close')) setSearchParams({})}}>×</button></header>
        <div className="period-modal-body"><InventoryNotice loading={preview.loading} error={error || preview.error} onRetry={preview.reload} />
          {preview.data && <>
            <p className={preview.data.canClose ? 'period-check-ok' : 'period-check-error'}>{preview.data.canClose ? 'Kỳ đủ điều kiện đóng.' : `Chưa thể đóng kỳ (${preview.data.reason ?? 'cần xử lý điều kiện trước'}).`}</p>
            <h3>Phiếu kiểm kê chưa xong ({preview.data.blockingCounts.length})</h3>{preview.data.blockingCounts.map((item) => <p key={item.id}>KK-{item.id} · {item.storeName} · {shortDate(item.countDate)} · {item.status}</p>)}
            <h3>Phiếu nhập chưa xác nhận ({preview.data.unconfirmedReceipts.length})</h3>{preview.data.unconfirmedReceipts.map((item) => <p key={item.id}>PN-{item.id} · {item.storeName} · {formatDateTime(item.arrivedAt)}</p>)}
            <h3>Lệnh hàng còn trên đường ({preview.data.transfersInTransit.length})</h3>{preview.data.transfersInTransit.map((item) => <p key={item.id}>ĐC-{item.id} · {item.sourceStoreName} → {item.destStoreName} · {formatDateTime(item.dispatchedAt)}</p>)}
            <div className="period-modal-total"><span>{preview.data.balanceRows} dòng tồn cuối kỳ</span><strong>{formatMoney(preview.data.totals.closingValue)}</strong></div>
            {preview.data.canClose && <label className="period-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Tôi hiểu kỳ đã đóng thì không thể mở lại.</label>}
          </>}
        </div>
        <footer><button type="button" className="mf-btn mf-btn--secondary" onClick={() => {setClosing(false); if (searchParams.has('close')) setSearchParams({})}}>Hủy</button><button type="button" className="mf-btn mf-btn--primary" disabled={!preview.data?.canClose || !confirmed || busy} onClick={() => void closePeriod()}>{busy ? 'Đang đóng…' : 'Xác nhận đóng kỳ'}</button></footer>
      </section></div>}
    </main>
  )
}
