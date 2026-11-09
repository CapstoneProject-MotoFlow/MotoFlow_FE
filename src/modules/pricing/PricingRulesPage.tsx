import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import FormDialog from '../../shared/ui/FormDialog'
import { useInventoryData, inventoryError } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import {
  today,
  percentValid,
  type Rules,
  type Limits,
  type Category,
} from './model'
import SalesLimitCard from './SalesLimitCard'
import SuggestionRules from './SuggestionRules'
import './pricing.css'
export default function PricingRulesPage() {
  const [revision, setRevision] = useState(0),
    [tab, setTab] = useState('limits'),
    [notice, setNotice] = useState('')
  const rules = useInventoryData<Rules>(
      '/pricing/markup-rules',
      {},
      revision,
      tab === 'suggestions',
    ),
    limits = useInventoryData<Limits>(
      '/pricing/sales-limits',
      {},
      revision,
      tab === 'limits',
    )
  const categories = useInventoryData<Category[]>(
    '/part-categories',
    {},
    0,
    tab === 'suggestions',
  )
  function saved() {
    setRevision((n) => n + 1)
    setNotice('Đã lưu cấu hình giá.')
  }
  return (
    <main className="dashboard-content pricing-page pricing-rules-page">
      <header>
        <h1>Quy tắc giá</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Giá bán › Quy tắc giá
        </nav>
      </header>
      <div className="pricing-tabs" role="tablist" aria-label="Quy tắc giá">
        <button
          role="tab"
          aria-selected={tab === 'limits'}
          onClick={() => {
            setTab('limits')
            setNotice('')
          }}
        >
          Ngưỡng và biên lợi nhuận
        </button>
        <button
          role="tab"
          aria-selected={tab === 'suggestions'}
          onClick={() => {
            setTab('suggestions')
            setNotice('')
          }}
        >
          Giá bán lẻ gợi ý
        </button>
      </div>
      {notice && (
        <p role="status" className="pricing-notice">
          {notice}
        </p>
      )}
      <InventoryNotice
        loading={rules.loading || limits.loading}
        error={rules.error || limits.error}
      />
      {tab === 'suggestions' && (
        <>
          <InventoryNotice
            loading={categories.loading}
            error={categories.error}
          />
          {rules.data && categories.data && (
            <SuggestionRules
              key={revision}
              config={rules.data.scheduled ?? rules.data.current}
              categories={categories.data}
              onSaved={saved}
            />
          )}
        </>
      )}
      {tab === 'limits' && limits.data && (
        <div className="pricing-limit-grid">
          <SalesLimitCard
            title="Ngưỡng chiết khấu tối đa"
            type="DISCOUNT_THRESHOLD"
            limit={limits.data.discountThreshold}
            onSaved={saved}
          />
          <SalesLimitCard
            title="Biên lợi nhuận tối thiểu"
            type="MINIMUM_MARGIN"
            limit={limits.data.minimumMargin}
            onSaved={saved}
          />
        </div>
      )}
    </main>
  )
}
export function LimitEditor({
  type,
  onClose,
  onSaved,
}: {
  type: string
  onClose: () => void
  onSaved: () => void
}) {
  const [rate, setRate] = useState(''),
    [effective, setEffective] = useState(today()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    lock = useRef(false),
    valid = percentValid(rate) && effective >= today()
  return (
    <FormDialog
      title={
        type === 'DISCOUNT_THRESHOLD'
          ? 'Đặt chiết khấu tối đa'
          : 'Đặt biên lợi nhuận tối thiểu'
      }
      formId="sales-limit"
      submitLabel="Lưu ngưỡng"
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
    >
      <form
        id="sales-limit"
        className="pricing-dialog"
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
            onSaved()
          } catch (err) {
            setError(inventoryError(err))
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        {error && (
          <p className="pricing-negative" role="alert">
            {error}
          </p>
        )}
        <div className="pricing-grid">
          <label>
            Tỷ lệ (%) *
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={rate}
              disabled={busy}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <label>
            Áp dụng từ *
            <input
              required
              type="date"
              min={today()}
              value={effective}
              disabled={busy}
              onChange={(e) => setEffective(e.target.value)}
            />
          </label>
        </div>
        <p className="pricing-recap">
          Ngưỡng áp dụng toàn chuỗi. Lưu mới có thể thay thế lịch đã hẹn từ ngày
          áp dụng.
        </p>
      </form>
    </FormDialog>
  )
}
