import { useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError, useInventoryData } from './api'
import { InventoryNotice } from './components'
import { date, dateTime, money } from './presentation'
import { countDifference, type StockCount } from './stockCountModel'

export type CountAction = 'assign' | 'verify' | 'approve' | 'cancel' | 'opening'
type Assignment = {
  documentId: number
  canAssign: boolean
  blockedMessage: string | null
  noticeMessage: string | null
  current: { assigneeId: number; assigneeName: string } | null
  eligibleAssignees: {
    id: number
    fullName: string
    self: boolean
    openTasks: number
  }[]
  history: {
    id: number
    assigneeName: string
    assignedByName: string
    assignedAt: string
  }[]
}
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
        documentId={count ? String(count.id) : documentId}
        onClose={onClose}
      />
    )
  return <CountReviewDialog action={action} count={count} onClose={onClose} />
}
function AssignCounterDialog({
  documentId,
  onClose,
}: {
  documentId?: string
  onClose: () => void
}) {
  const validId =
    !!documentId &&
    /^[1-9]\d*$/.test(documentId) &&
    Number.isSafeInteger(Number(documentId))
  const [revision, setRevision] = useState(0)
  const resource = useInventoryData<Assignment>(
    '/warehouse-tasks',
    { taskType: 'COUNTING', documentId },
    revision,
    validId,
  )
  const [choice, setChoice] = useState<number>()
  const selected = choice ?? resource.data?.current?.assigneeId
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false)
  return (
    <FormDialog
      title="Giao việc đếm"
      formId="count-assign"
      submitLabel="Giao việc"
      submitDisabled={
        !resource.data?.canAssign || !selected || resource.loading
      }
      busy={saving}
      onClose={onClose}
    >
      <form
        className="count-form"
        id="count-assign"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            !resource.data?.canAssign ||
            !selected ||
            saving ||
            resource.loading
          )
            return
          setSaving(true)
          setError('')
          setSaved(false)
          try {
            await axiosClient.post('/warehouse-tasks', {
              taskType: 'COUNTING',
              documentId: Number(documentId),
              assigneeId: selected,
            })
            setRevision((v) => v + 1)
            setSaved(true)
          } catch (error) {
            setError(inventoryError(error))
          } finally {
            setSaving(false)
          }
        }}
      >
        <InventoryNotice
          loading={resource.loading}
          error={resource.error ?? error}
        />
        {!validId && (
          <p className="count-unavailable">
            Chưa xác định được phiếu kiểm kê cần giao việc.
          </p>
        )}
        {resource.data?.blockedMessage && (
          <p role="status" className="count-unavailable">
            {resource.data.blockedMessage}
          </p>
        )}
        {resource.data?.noticeMessage && (
          <p className="count-unavailable">{resource.data.noticeMessage}</p>
        )}
        {resource.data && (
          <fieldset>
            <legend>Chọn người đếm của kho</legend>
            <div className="count-assignees">
              {resource.data.eligibleAssignees.map((person) => (
                <label key={person.id}>
                  <input
                    type="radio"
                    name="assignee"
                    value={person.id}
                    checked={selected === person.id}
                    disabled={
                      !resource.data?.canAssign || saving || resource.loading
                    }
                    onChange={() => {
                      setChoice(person.id)
                      setSaved(false)
                    }}
                  />
                  <span>{person.self ? 'Tôi tự đếm' : person.fullName}</span>
                  {!person.self && (
                    <small>{person.openTasks} phiếu đang đếm</small>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {resource.data?.eligibleAssignees.some(
          (person) => person.id === selected && person.self,
        ) && (
          <p className="count-unavailable">
            Khi bạn tự đếm, người khác phải xác minh kết quả.
          </p>
        )}
        {saved && <p role="status">Đã lưu người được giao đếm.</p>}
        {!!resource.data?.history.length && (
          <section>
            <h3>Lịch sử giao việc</h3>
            <ol className="count-events">
              {resource.data.history.map((event) => (
                <li key={event.id}>
                  <strong>{event.assigneeName}</strong>
                  <span>
                    {event.assignedByName} · {dateTime(event.assignedAt)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </form>
    </FormDialog>
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
              maxLength={1000}
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
            {action === 'opening' ? (
              <>
                <label>
                  Nhập giá vốn từ Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) =>
                      setFileName(e.target.files?.[0]?.name ?? '')
                    }
                  />
                </label>
                {fileName && (
                  <small>
                    Tệp đã chọn: {fileName}. Chưa tải lên hoặc nhập vào phiếu.
                  </small>
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
                                      maxLength={1000}
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
                    <textarea required rows={3} maxLength={1000} />
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
