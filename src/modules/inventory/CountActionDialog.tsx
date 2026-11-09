import WarehouseAssignmentDialog from '../operations/WarehouseAssignmentDialog'
import { useState } from 'react'
import { mapCountSheet, readCountFile } from './countImport'
import FormDialog from '../../shared/ui/FormDialog'
import { date, money } from './presentation'
import { countDifference, type StockCount } from './stockCountModel'

export type CountAction = 'assign' | 'verify' | 'approve' | 'cancel' | 'opening'
export function CountActionDialog({
  action,
  count,
  documentId,
  onClose,
}: {
  action: CountAction
  count?: StockCount
  documentId?: string
  onClose: () => void
}) {
  if (action === 'assign')
    return (
      <AssignCounterDialog
        count={count}
        documentId={count ? String(count.id) : documentId}
        onClose={onClose}
      />
    )
  return <CountReviewDialog action={action} count={count} onClose={onClose} />
}
function AssignCounterDialog({
  count,
  documentId,
  onClose,
}: {
  count?: StockCount
  documentId?: string
  onClose: () => void
}) {
  return (
    <WarehouseAssignmentDialog
      taskType="COUNTING"
      documentId={count?.id ?? Number(documentId)}
      onClose={onClose}
      onSaved={() => window.dispatchEvent(new Event('stock-counts-changed'))}
    />
  )
}
function CountReviewDialog({
  action,
  count,
  onClose,
}: {
  action: Exclude<CountAction, 'assign'>
  count?: StockCount
  onClose: () => void
}) {
  const [back, setBack] = useState<Record<number, boolean>>({})
  const [ways, setWays] = useState<Record<number, string>>({})
  const [showAll, setShowAll] = useState(false)
  const lines = (count?.lines ?? []).filter(
    (line) =>
      action === 'opening' ||
      line.countedQty == null ||
      countDifference(line) !== 0,
  )
  const prices = [
    ...new Map(
      (count?.lines ?? []).map((line) => [line.productId, line]),
    ).values(),
  ]
  const [costs, setCosts] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      prices.map((line) => [
        line.productId,
        line.unitCost == null ? '' : String(line.unitCost),
      ]),
    ),
  )
  const [fileName, setFileName] = useState('')
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const returned =
    Object.values(back).filter(Boolean).length +
    Object.values(ways).filter((way) => way === 'back').length
  const titles = {
    verify: 'Xác minh chênh lệch',
    approve: 'Duyệt chênh lệch',
    cancel: 'Hủy phiếu kiểm kê',
    opening: 'Nhập giá vốn ban đầu và duyệt',
  }
  return (
    <FormDialog
      className={
        action === 'cancel'
          ? ''
          : action === 'opening'
            ? 'count-opening-dialog'
            : 'count-review-dialog'
      }
      title={titles[action] + (count ? ' · ' + count.code : '')}
      formId="count-review"
      submitLabel={
        action === 'cancel'
          ? 'Xác nhận hủy phiếu'
          : action === 'opening'
            ? 'Duyệt và ghi tồn đầu kỳ'
            : returned
              ? 'Trả về đếm lại'
              : action === 'verify'
                ? 'Gửi Owner duyệt'
                : 'Duyệt và ghi nhận chênh lệch'
      }
      submitDisabled
      onClose={onClose}
    >
      <form
        id="count-review"
        className="count-form"
        onSubmit={(e) => e.preventDefault()}
      >
        {action === 'cancel' ? (
          <label>
            Lý do hủy *
            <textarea
              required
              rows={3}
              maxLength={255}
              placeholder="Nhập lý do hủy phiếu…"
            />
          </label>
        ) : (
          <>
            <dl className="stock-facts">
              <div>
                <dt>Kho</dt>
                <dd>{count?.storeName ?? '—'}</dd>
              </div>
              <div>
                <dt>Ngày kiểm kê</dt>
                <dd>{date(count?.countDate)}</dd>
              </div>
              <div>
                <dt>
                  {action === 'verify'
                    ? 'Người đếm'
                    : 'Branch Manager xác minh'}
                </dt>
                <dd>
                  {(action === 'verify'
                    ? count?.assigneeName
                    : count?.confirmedByName) ?? '—'}
                </dd>
              </div>
            </dl>
            <dl className="stock-facts count-summary">
              <div>
                <dt>{action === 'opening' ? 'Phụ tùng' : 'Khớp sổ sách'}</dt>
                <dd>
                  {count
                    ? action === 'opening'
                      ? new Set(count.lines.map((line) => line.productId)).size
                      : count.lines.filter(
                          (line) => countDifference(line) === 0,
                        ).length
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{action === 'opening' ? 'Dòng lô' : 'Chênh lệch'}</dt>
                <dd>
                  {count
                    ? action === 'opening'
                      ? count.lines.length
                      : count.lines.filter(
                          (line) =>
                            countDifference(line) != null &&
                            countDifference(line) !== 0,
                        ).length
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Chưa đếm</dt>
                <dd>
                  {count
                    ? count.lines.filter((line) => line.countedQty == null)
                        .length
                    : '—'}
                </dd>
              </div>
              {action === 'approve' && (
                <div>
                  <dt>Tổng giá trị chênh lệch</dt>
                  <dd>
                    {count &&
                    count.lines.every(
                      (line) =>
                        line.unitCost != null && countDifference(line) != null,
                    )
                      ? money.format(
                          count.lines.reduce(
                            (sum, line) =>
                              sum + line.unitCost! * countDifference(line)!,
                            0,
                          ),
                        )
                      : '—'}
                  </dd>
                </div>
              )}
            </dl>
            {action === 'opening' ? (
              <>
                <label>
                  Nhập giá vốn từ Excel
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={importBusy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      setFileName('')
                      setImportError('')
                      if (!file) return
                      setImportBusy(true)
                      try {
                        const rows = mapCountSheet(
                          await readCountFile(file),
                          count?.lines ?? [],
                          'cost',
                        )
                        setCosts((previous) => ({
                          ...previous,
                          ...Object.fromEntries(
                            rows.map((row) => [row.id, row.value]),
                          ),
                        }))
                        setFileName(file.name)
                        setShowAll(true)
                      } catch (error) {
                        setImportError(
                          error instanceof Error
                            ? error.message
                            : 'Không đọc được tệp Excel.',
                        )
                      } finally {
                        setImportBusy(false)
                      }
                    }}
                  />
                </label>
                {fileName && (
                  <small>
                    Đã điền giá vốn từ {fileName} vào màn hình; chưa lưu lên hệ
                    thống.
                  </small>
                )}
                <p>
                  Cột trong tệp: SKU, Giá vốn. Mỗi phụ tùng một giá vốn ban đầu.
                </p>
                {importBusy && <p role="status">Đang đọc tệp…</p>}
                {importError && (
                  <p role="alert" className="stock-error">
                    {importError}
                  </p>
                )}
                <label className="stock-check">
                  <input
                    type="checkbox"
                    checked={showAll}
                    onChange={(e) => setShowAll(e.target.checked)}
                  />
                  Hiện cả phụ tùng đã có giá vốn
                </label>
                <div className="stock-table-scroll">
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>Phụ tùng</th>
                        <th>Số đếm</th>
                        <th>Giá vốn ban đầu (đ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prices
                        .filter((line) => showAll || line.unitCost == null)
                        .map((line) => (
                          <tr key={line.productId}>
                            <td>
                              {line.partName}
                              <small>{line.sku}</small>
                            </td>
                            <td>
                              {(count?.lines ?? [])
                                .filter(
                                  (item) => item.productId === line.productId,
                                )
                                .reduce(
                                  (total, item) =>
                                    total + (item.countedQty ?? 0),
                                  0,
                                )}
                            </td>
                            <td>
                              <input
                                type="number"
                                min={1}
                                step={1}
                                aria-label={'Giá vốn ban đầu ' + line.partName}
                                value={costs[line.productId]}
                                onChange={(e) =>
                                  setCosts({
                                    ...costs,
                                    [line.productId]: e.target.value,
                                  })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      {!prices.length && (
                        <tr>
                          <td colSpan={3} className="stock-empty">
                            Chưa có phụ tùng để nhập giá vốn.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <div className="stock-table-scroll">
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>Phụ tùng / nguyên nhân</th>
                        <th>Sổ sách</th>
                        <th>Số đếm</th>
                        <th>Chênh lệch</th>
                        {action === 'approve' && (
                          <>
                            <th>Giá vốn bình quân</th>
                            <th>Giá trị</th>
                          </>
                        )}
                        <th>{action === 'verify' ? 'Xử lý' : 'Đếm lại'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const diff = countDifference(line)
                        return (
                          <tr key={line.id}>
                            <td>
                              {line.partName}
                              <small>
                                {line.sku}
                                {line.lotCode ? ' · ' + line.lotCode : ''}
                              </small>
                              <small>{line.reason ?? line.note}</small>
                            </td>
                            <td>{line.bookQty ?? '—'}</td>
                            <td>{line.countedQty ?? 'Chưa đếm'}</td>
                            <td>
                              {diff == null
                                ? '—'
                                : (diff > 0 ? '+' : '') + diff}
                            </td>
                            {action === 'approve' && (
                              <>
                                <td>
                                  {line.unitCost == null
                                    ? '—'
                                    : money.format(line.unitCost)}
                                </td>
                                <td>
                                  {line.unitCost == null || diff == null
                                    ? '—'
                                    : money.format(line.unitCost * diff)}
                                </td>
                              </>
                            )}
                            <td>
                              {action === 'verify' ? (
                                line.countedQty == null ? (
                                  <div className="count-buttons">
                                    <button
                                      type="button"
                                      aria-pressed={ways[line.id] === 'drop'}
                                      onClick={() =>
                                        setWays({ ...ways, [line.id]: 'drop' })
                                      }
                                    >
                                      Bỏ dòng
                                    </button>
                                    <button
                                      type="button"
                                      aria-pressed={ways[line.id] === 'back'}
                                      onClick={() =>
                                        setWays({ ...ways, [line.id]: 'back' })
                                      }
                                    >
                                      Cho đếm lại
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <input
                                      aria-label={
                                        'Nguyên nhân ' + line.partName
                                      }
                                      placeholder="Nguyên nhân chênh lệch"
                                      maxLength={255}
                                      disabled={!!back[line.id]}
                                    />
                                    <label className="stock-check">
                                      <input
                                        type="checkbox"
                                        checked={!!back[line.id]}
                                        onChange={(e) =>
                                          setBack({
                                            ...back,
                                            [line.id]: e.target.checked,
                                          })
                                        }
                                      />
                                      Cho đếm lại dòng này
                                    </label>
                                  </>
                                )
                              ) : (
                                <input
                                  type="checkbox"
                                  aria-label={
                                    'Trả ' + line.partName + ' về đếm lại'
                                  }
                                  checked={!!back[line.id]}
                                  onChange={(e) =>
                                    setBack({
                                      ...back,
                                      [line.id]: e.target.checked,
                                    })
                                  }
                                />
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {!lines.length && (
                        <tr>
                          <td
                            colSpan={action === 'approve' ? 7 : 5}
                            className="stock-empty"
                          >
                            Chưa có kết quả kiểm kê để xử lý.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {returned > 0 && (
                  <label>
                    Lý do trả về đếm lại *
                    <textarea required rows={3} maxLength={255} />
                  </label>
                )}
              </>
            )}
          </>
        )}
        <p className="count-unavailable" role="status">
          Chưa thể{' '}
          {action === 'cancel'
            ? 'hủy phiếu'
            : action === 'verify'
              ? 'gửi kết quả xác minh'
              : 'duyệt phiếu'}{' '}
          lúc này. Thông tin chưa được lưu; tồn kho chưa thay đổi.
        </p>
      </form>
    </FormDialog>
  )
}
