import { useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import { useParams, Link } from 'react-router-dom'
import { InventoryHeader, InventoryPanel } from './components'
import {
  countSubmissionReady,
  validCountQuantity,
  type CountLine,
  type StockCount,
} from './stockCountModel'
import { date } from './presentation'
import './stock-count.css'

export default function StockCountRecordPage() {
  const { id } = useParams()
  return <StockCountRecordView key={id} id={id} />
}
// This view intentionally has no book-quantity or unit-cost column: counting is blind.
export function StockCountRecordView({
  count,
  id,
}: {
  count?: StockCount
  id?: string
}) {
  const [importOpen, setImportOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const lines = [...(count?.lines ?? [])]
    .filter(
      (line) => !count?.lines.some((item) => item.recount) || line.recount,
    )
    .sort((a, b) =>
      (a.binLocation ?? '').localeCompare(b.binLocation ?? '', 'vi'),
    )
  const [values, setValues] = useState<
    Record<number, { value: string; note: string }>
  >(() =>
    Object.fromEntries(
      lines.map((line) => [
        line.id,
        {
          value:
            line.countedQty == null || line.recount
              ? ''
              : String(line.countedQty),
          note: line.note ?? '',
        },
      ]),
    ),
  )
  const drafts = Object.values(values)
  const ready = countSubmissionReady(drafts, confirmed)
  const done = drafts.filter((line) => validCountQuantity(line.value)).length
  const back = '/stock-counts/' + (count?.id ?? id ?? '')
  function update(line: CountLine, change: { value?: string; note?: string }) {
    setValues({ ...values, [line.id]: { ...values[line.id], ...change } })
  }
  if (count && (count.status !== 'COUNTING' || count.submittedAt)) {
    return (
      <main className="inventory-workspace count-workspace">
        <InventoryHeader
          title={
            count.status === 'DRAFT'
              ? 'Bắt đầu đếm ' + count.code
              : 'Phiếu ' + count.code
          }
        >
          <Link to={back}>Quay lại phiếu</Link>
        </InventoryHeader>
        <InventoryPanel
          title={count.scopeLabel + ' · ngày ' + date(count.countDate)}
        >
          <dl className="stock-facts">
            <div>
              <dt>Kho</dt>
              <dd>{count.storeName}</dd>
            </div>
            <div>
              <dt>Số dòng cần đếm</dt>
              <dd>{lines.length}</dd>
            </div>
            <div>
              <dt>Người giao</dt>
              <dd>{count.createdByName}</dd>
            </div>
          </dl>
          {count.status === 'DRAFT' ? (
            <div className="count-sticky">
              <Link to={back}>Quay lại</Link>
              <button className="count-primary" disabled>
                Bắt đầu đếm
              </button>
            </div>
          ) : (
            <p className="count-unavailable">
              {count.submittedAt
                ? 'Số đếm đã được gửi, hiện không thể sửa.'
                : 'Phiếu hiện không ở bước nhập số đếm.'}
            </p>
          )}
        </InventoryPanel>
      </main>
    )
  }
  return (
    <main className="inventory-workspace count-workspace">
      <InventoryHeader title={'Ghi số đếm' + (count ? ' ' + count.code : '')}>
        <Link to={back}>Quay lại phiếu</Link>
      </InventoryHeader>
      {!count && (
        <p className="count-unavailable" role="status">
          Chưa tải được phiếu kiểm kê được giao. Vui lòng quay lại sau.
        </p>
      )}
      <InventoryPanel
        title={
          count
            ? count.scopeLabel + ' · ngày ' + date(count.countDate)
            : 'Dòng cần đếm'
        }
        action={
          <div className="count-buttons">
            <button
              type="button"
              disabled={!count || count.type !== 'OPENING'}
              title="Dành cho phiếu kiểm kê đầu kỳ"
              onClick={() => setImportOpen(true)}
            >
              Nhập từ Excel
            </button>
            <label className="stock-check">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
              />
              Chỉ dòng chưa đếm
            </label>
          </div>
        }
      >
        <div
          className="count-record-grid"
          role="table"
          aria-label="Đếm từng dòng"
        >
          <div className="count-record-head" role="row">
            <span role="columnheader">Phụ tùng</span>
            <span role="columnheader">Vị trí</span>
            <span role="columnheader">Số đếm</span>
            <span role="columnheader">Ghi chú</span>
          </div>
          {lines
            .filter((line) => !onlyMissing || values[line.id].value === '')
            .map((line) => (
              <div className="count-record-row" key={line.id} role="row">
                <div role="cell">
                  {line.partName}
                  <small>{line.sku}</small>
                  {line.lotCode && (
                    <strong className="count-lot">
                      Lô {line.lotCode} · HSD {date(line.expiryDate)}
                    </strong>
                  )}
                </div>
                <div role="cell">{line.binLocation ?? '—'}</div>
                <div role="cell">
                  <label
                    className="count-mobile-label"
                    htmlFor={'qty-' + line.id}
                  >
                    Số đếm
                  </label>
                  <input
                    id={'qty-' + line.id}
                    type="text"
                    inputMode="numeric"
                    aria-label={
                      'Số đếm ' +
                      line.partName +
                      (line.lotCode ? ' lô ' + line.lotCode : '')
                    }
                    value={values[line.id].value}
                    aria-invalid={
                      values[line.id].value !== '' &&
                      !validCountQuantity(values[line.id].value)
                    }
                    onChange={(e) => update(line, { value: e.target.value })}
                  />
                </div>
                <div role="cell">
                  <label
                    className="count-mobile-label"
                    htmlFor={'note-' + line.id}
                  >
                    Ghi chú
                  </label>
                  <input
                    id={'note-' + line.id}
                    aria-label={'Ghi chú ' + line.partName}
                    placeholder="Lý do chưa đếm được…"
                    maxLength={1000}
                    value={values[line.id].note}
                    onChange={(e) => update(line, { note: e.target.value })}
                  />
                </div>
              </div>
            ))}
          {!lines.length && (
            <p className="stock-empty">
              Chưa có dòng được giao để nhập số đếm.
            </p>
          )}
        </div>
      </InventoryPanel>
      <footer className="count-sticky count-record-footer">
        <label className="stock-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Tôi đã đếm thực tế từng vị trí và chịu trách nhiệm về số đếm này
        </label>
        <div>
          <span>
            {count
              ? 'Đã đếm ' + done + '/' + lines.length + ' dòng.'
              : 'Chưa có phiếu để nhập số đếm.'}
          </span>
          <div className="count-buttons">
            <Link to={back}>Hủy</Link>
            <button disabled>Lưu tạm</button>
            <button
              className="count-primary"
              disabled
              title={
                ready
                  ? 'Chưa thể gửi số đếm lúc này.'
                  : 'Mỗi dòng cần số đếm hợp lệ hoặc ghi chú và phải đánh dấu cam kết.'
              }
            >
              Gửi số đếm
            </button>
          </div>
        </div>
      </footer>
      {importOpen && (
        <FormDialog
          title="Nhập số đếm từ Excel"
          formId="count-import"
          submitLabel="Nhập số đếm"
          submitDisabled
          onClose={() => setImportOpen(false)}
        >
          <form
            id="count-import"
            className="count-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <label>
              Tệp Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              />
            </label>
            {fileName && <p>Tệp đã chọn: {fileName}</p>}
            <p className="count-unavailable">
              Chưa thể nhập tệp vào phiếu kiểm kê lúc này. Tệp chưa được tải
              lên.
            </p>
          </form>
        </FormDialog>
      )}
    </main>
  )
}
