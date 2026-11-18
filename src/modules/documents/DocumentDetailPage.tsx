import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { uploadAttachment } from '../../shared/api/upload'
import { useInventoryData } from '../inventory/api'
import { paymentMethodLabels } from '../../shared/labels/status'
import { formatDateTime, formatMoney } from '../../shared/utils/format'
import FormDialog from '../../shared/ui/FormDialog'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import PageHeader from '../../shared/ui/PageHeader'
import AdjustmentEffects from './AdjustmentEffects'
import { inventoryError } from '../inventory/api'
import {
  Card,
  EvidenceList,
  Facts,
  History,
  Result,
  Status,
  Table,
} from './DocumentUi'
import {
  adjustmentPath,
  adjustmentStatuses,
  adjustmentTypes,
  documentPath,
  documentStatus,
  documentTypes,
  isDocumentType,
  validId,
  workPath,
} from './model'
import type {
  AdjustmentDetail,
  AdjustmentEffects as Effects,
  DocumentDetail,
  DocumentLine,
  DocumentLink,
} from './types'

function RecordLink({ record }: { record: DocumentLink }) {
  const href = record.documentType
    ? documentPath(record.documentType, record.id)
    : workPath(record.recordType, record.id)
  return (
    <li>
      {href ? (
        <Link to={href}>{record.number}</Link>
      ) : (
        <strong>{record.number}</strong>
      )}
      {record.note && <small>{record.note}</small>}
    </li>
  )
}

function DocumentContents({ data }: { data: DocumentDetail }) {
  const { content, document: row } = data
  const lines = content.lines ?? []
  const sale = row.type === 'SALES_ORDER'
  const receipt = row.type === 'GOODS_RECEIPT'
  const columns: [
    string,
    (line: DocumentLine) => string | number | null | undefined,
  ][] = sale
    ? [
        ['Đã giao', (line) => line.deliveredQty],
        ['Đơn giá', (line) => formatMoney(line.actualUnitPrice)],
        ['Thành tiền', (line) => formatMoney(line.lineTotal)],
      ]
    : receipt
      ? [
          ['Theo chứng từ', (line) => line.documentQty],
          ['Thực giao', (line) => line.deliveredQty],
          ['Đạt', (line) => line.passedQty],
          [
            'Thiếu',
            (line) =>
              Math.max(0, (line.documentQty ?? 0) - (line.deliveredQty ?? 0)),
          ],
          ['Giao sai', (line) => line.wrongItemQty],
          ['Hư hỏng', (line) => line.damagedQty],
        ]
      : [
          ['Kế hoạch', (line) => line.plannedQty],
          ['Đã xuất', (line) => line.dispatchedQty],
          ['Đã nhận', (line) => line.receivedQty],
        ]
  if (receipt && lines.some((line) => line.unitPrice != null))
    columns.push(['Giá nhập', (line) => formatMoney(line.unitPrice)])
  const evidence =
    content.documents ?? content.attachments ?? content.evidence ?? []
  return (
    <>
      {lines.length > 0 && (
        <Card title="Nội dung chứng từ">
          <Table
            label="Các dòng chứng từ"
            headers={['Phụ tùng', ...columns.map(([label]) => label)]}
          >
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <strong>{line.partName}</strong>
                  <small>
                    {line.sku} · {line.baseUnit}
                  </small>
                </td>
                {columns.map(([label, value]) => (
                  <td key={label}>{value(line) ?? '—'}</td>
                ))}
              </tr>
            ))}
          </Table>
          {row.value != null && (
            <p className="docs-total">
              Tổng giá trị <strong>{formatMoney(row.value)}</strong>
            </p>
          )}
        </Card>
      )}
      {!!content.stockLines?.length && (
        <Card title="Điều chỉnh tồn kho">
          <Table
            label="Điều chỉnh tồn kho"
            headers={['Phụ tùng', 'Lô', 'Chênh lệch']}
          >
            {content.stockLines.map((line, index) => (
              <tr key={index}>
                <td>
                  {line.partName}
                  <small>{line.sku}</small>
                </td>
                <td>
                  {line.manufacturerLotNo ||
                    (line.lotId ? '#' + line.lotId : '—')}
                </td>
                <td>
                  {line.quantityChange} {line.baseUnit}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {!!content.amountLines?.length && (
        <Card title="Điều chỉnh số tiền">
          <Table label="Điều chỉnh số tiền" headers={['Bản ghi', 'Chênh lệch']}>
            {content.amountLines.map((line, index) => (
              <tr key={index}>
                <td>
                  {line.paymentId
                    ? 'Phiếu thu #' + line.paymentId
                    : 'Khoản nợ #' + line.receivableId}
                </td>
                <td>{formatMoney(line.amountChange)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {evidence.length > 0 && (
        <Card title="Chứng cứ">
          <EvidenceList files={evidence} />
        </Card>
      )}
    </>
  )
}

function CorrectionDialog({
  data,
  onClose,
}: {
  data: DocumentDetail
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { document: row, content } = data
  const isPayment = row.type === 'PAYMENT'
  const isReceipt = row.type === 'GOODS_RECEIPT'
  const documentType = isPayment
    ? 'DEBT_PAYMENT'
    : isReceipt
      ? 'GOODS_RECEIPT_NOTE'
      : 'SALES_ORDER'
  const lines = (content.lines ?? []).filter(
    (line): line is DocumentLine & { id: number } => Number.isSafeInteger(line.id),
  )
  const targets = lines.map((line) => ({
    line,
    name: line.partName + ' · ' + line.sku,
    value: isReceipt ? (line.toStockQty ?? line.passedQty) : line.deliveredQty,
  }))
  const [selected, setSelected] = useState(0)
  const [correct, setCorrect] = useState('')
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<Effects>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const uploaded = useRef(
    new Map<File, Awaited<ReturnType<typeof uploadAttachment>>>(),
  )
  const current = isPayment ? content.amount : targets[selected]?.value
  const delta = current != null && correct !== '' ? Number(correct) - current : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!reason.trim() || reason.length > 500) {
      setError('Nhập lý do sửa, tối đa 500 ký tự.')
      return
    }
    if (!isPayment && (!targets[selected] || correct === '')) {
      setError('Chọn dòng chứng từ và nhập giá trị đúng.')
      return
    }
    if (isPayment && (!Number.isSafeInteger(Number(correct)) || Number(correct) <= 0)) {
      setError('Số tiền đúng phải là số nguyên lớn hơn 0.')
      return
    }
    if (files.length > 10 || files.some((file) =>
      !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) ||
      !file.size || file.size > 10 * 1024 * 1024 || file.name.length > 255
    )) {
      setError('Tối đa 10 tệp JPG, PNG, WebP hoặc PDF, không quá 10 MB mỗi tệp.')
      return
    }
    const body = {
      documentType,
      documentId: row.id,
      lines: isPayment ? [] : [{ lineId: targets[selected].line.id, correctedQty: Number(correct) }],
      correctedAmount: isPayment ? Number(correct) : undefined,
      reason: reason.trim(),
    }
    setError('')
    setBusy(true)
    try {
      if (!preview) {
        const { data: effects } = await axiosClient.post<Effects>(
          '/adjustment-requests/corrections/preview', body,
        )
        setPreview(effects)
        return
      }
      const attachments = []
      for (const file of files) {
        let attachment = uploaded.current.get(file)
        if (!attachment) {
          attachment = await uploadAttachment(file)
          uploaded.current.set(file, attachment)
        }
        attachments.push(attachment)
      }
      const { data: adjustment } = await axiosClient.post<AdjustmentDetail>(
        '/adjustment-requests/corrections', { ...body, attachments },
      )
      onClose()
      navigate(adjustmentPath(adjustment.id), { replace: true })
    } catch (failure) {
      setError(inventoryError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      title={'Yêu cầu sửa chứng từ ' + row.number}
      formId="document-correction"
      submitLabel={busy ? 'Đang xử lý…' : preview ? 'Gửi Owner duyệt' : 'Xem trước ảnh hưởng'}
      busy={busy}
      submitDisabled={!isPayment && (!targets.length || correct === '')}
      onClose={onClose}
    >
      <form
        id="document-correction"
        className="docs-form"
        onSubmit={submit}
      >
        <p className="docs-note">
          Chứng từ gốc được giữ để đối chiếu. Điều chỉnh được ghi vào ngày Owner
          duyệt trong kỳ đang mở.
        </p>
        {!isPayment && <label>
          Dòng cần sửa
          <select value={selected} onChange={(event) => { setSelected(Number(event.target.value)); setCorrect(''); setPreview(undefined) }}>
            {targets.map((target, index) => <option value={index} key={target.line.id}>{target.name}</option>)}
          </select>
        </label>}
        <div className="docs-facts docs-correction-values">
          <div>
            <strong>Đang ghi</strong>
            <p>
              {isPayment ? formatMoney(current) : (current ?? '—')}
            </p>
          </div>
          <label>
            {isPayment ? 'Số tiền đúng (₫)' : 'Số lượng đúng'}
            <input
                required
                type="number"
                min="0"
                step="1"
                value={correct}
                onChange={(event) => { setCorrect(event.target.value); setPreview(undefined) }}
              />
          </label>
          <div>
            <strong>Chênh lệch</strong>
            <p aria-live="polite">
              {delta == null ? '—' : isPayment ? formatMoney(delta) : delta}
            </p>
          </div>
        </div>
        <label>
          Lý do
          <textarea required rows={3} maxLength={500} value={reason} onChange={(event) => { setReason(event.target.value); setPreview(undefined) }} />
        </label>
        <div>
          <strong>Chứng cứ</strong>
          <LocalizedFileInput
            aria-label="Chứng cứ"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            multiple
            onChange={(event) => { uploaded.current.clear(); setFiles(Array.from(event.currentTarget.files ?? [])); setPreview(undefined) }}
          />
        </div>
        {preview && <AdjustmentEffects data={preview} />}
        {error && <p role="alert" className="docs-alert">{error}</p>}
      </form>
    </FormDialog>
  )
}

export default function DocumentDetailPage() {
  const { type, id } = useParams()
  const valid = isDocumentType(type) && validId(id)
  const request = useInventoryData<DocumentDetail>(
    valid ? documentPath(type, id!) : '',
    {},
    0,
    valid,
  )
  const [correction, setCorrection] = useState(false)
  return (
    <div className="docs-page">
      <PageHeader
        title={
          request.data
            ? documentTypes[request.data.document.type] +
              ' ' +
              request.data.document.number
            : 'Chi tiết chứng từ'
        }
        breadcrumb={[
          { label: 'Tra cứu chứng từ', to: '/documents' },
          { label: request.data?.document.number ?? 'Chi tiết' },
        ]}
      />
      <Result request={request} empty="Chứng từ không hợp lệ.">
        {(data) => {
          const { document: row, content } = data
          const path = documentPath(row.type, row.id)
          const relatedWork =
            row.type === 'GOODS_RECEIPT'
              ? content.transferOrderId
                ? '/transfer-orders/' +
                  content.transferOrderId +
                  '/receipts/' +
                  row.id
                : workPath('GOODS_RECEIPT_NOTE', row.id)
              : workPath(row.type, row.id)
          const pending = data.adjustments.find(
            (item) =>
              item.adjustmentType === 'DOCUMENT_CORRECTION' &&
              (item.status === 'PENDING' || item.status === 'APPROVED'),
          )
          const canCorrect =
            row.status !== 'CANCELLED' && !pending && (
              (row.type === 'SALES_ORDER' && row.status === 'COMPLETED' && !!content.lines?.every((line) => line.id != null)) ||
              (row.type === 'GOODS_RECEIPT' && row.status === 'CONFIRMED' && !!content.lines?.every((line) => line.id != null)) ||
              (row.type === 'PAYMENT' && content.paymentType === 'DEBT_PAYMENT' && row.status === 'VERIFIED' && content.amount != null)
            )
          const author =
            typeof content.createdBy === 'string'
              ? content.createdBy
              : content.createdBy?.fullName ??
                content.createdByName ??
                content.recordedByName ??
                (typeof content.requestedBy === 'string'
                  ? content.requestedBy
                  : content.requestedBy?.fullName)
          return (
            <>
              <div className="docs-split">
                <div className="docs-stack">
                  <Card
                    title={
                      <>
                        {row.number}{' '}
                        <Status
                          value={row.status}
                          label={documentStatus(row.type, row.status)}
                        />
                      </>
                    }
                    actions={
                      <div className="docs-actions">
                        {relatedWork && (
                          <Link
                            className="mf-btn mf-btn--secondary"
                            to={relatedWork}
                          >
                            Mở màn nghiệp vụ
                          </Link>
                        )}
                        {row.printForms.length > 0 && (
                          <Link
                            className="mf-btn mf-btn--secondary"
                            to={path + '/print'}
                          >
                            In, xuất tệp
                          </Link>
                        )}
                        {canCorrect && (
                          <button
                            className="mf-btn mf-btn--primary"
                            onClick={() => setCorrection(true)}
                          >
                            Yêu cầu sửa chứng từ
                          </button>
                        )}
                      </div>
                    }
                  >
                    {pending && (
                      <p className="docs-note">
                        Đang xử lý yêu cầu sửa{' '}
                        <Link to={adjustmentPath(pending.id)}>
                          {pending.number}
                        </Link>
                        .
                      </p>
                    )}
                    <Facts
                      items={[
                        ['Ngày chứng từ', formatDateTime(row.documentDate)],
                        ['Cửa hàng', row.storeName],
                        ['Kho đích / kho liên quan', row.otherStoreName],
                        ['Đối tượng', row.partnerName],
                        ['Người lập', author ?? content.recordedBy],
                        ['Phiên bản', content.version],
                        ['Số chứng từ giao hàng', content.deliveryDocumentNo],
                        [
                          'Hàng đến',
                          content.arrivedAt &&
                            formatDateTime(content.arrivedAt),
                        ],
                        [
                          'Xác nhận lúc',
                          content.confirmedAt &&
                            formatDateTime(content.confirmedAt),
                        ],
                        [
                          'Hình thức thanh toán',
                          content.paymentMethod &&
                            (paymentMethodLabels[content.paymentMethod] ??
                              content.paymentMethod),
                        ],
                        [
                          'Số tiền',
                          content.amount != null
                            ? formatMoney(content.amount)
                            : null,
                        ],
                        ['Mã giao dịch', content.transactionReference],
                        ['Lý do', content.reason],
                        ['Ghi chú', content.note],
                      ]}
                    />
                  </Card>
                  <DocumentContents data={data} />
                  {!!data.adjustments.length && (
                    <Card title="Điều chỉnh liên quan">
                      <Table
                        label="Điều chỉnh liên quan"
                        headers={['Yêu cầu', 'Loại', 'Nội dung', 'Trạng thái']}
                      >
                        {data.adjustments.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <Link to={adjustmentPath(item.id)}>
                                {item.number}
                              </Link>
                            </td>
                            <td>
                              {adjustmentTypes[item.adjustmentType] ??
                                item.adjustmentType}
                            </td>
                            <td>{item.reason}</td>
                            <td>
                              <Status
                                value={item.status}
                                label={
                                  adjustmentStatuses[item.status] ?? item.status
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </Table>
                    </Card>
                  )}
                </div>
                <div className="docs-stack">
                  {(data.sources.length > 0 || data.related.length > 0) && (
                    <Card title="Liên kết">
                      {data.sources.length > 0 && (
                        <>
                          <h3>Chứng từ gốc</h3>
                          <ul className="docs-files">
                            {data.sources.map((record) => (
                              <RecordLink
                                key={record.recordType + record.id}
                                record={record}
                              />
                            ))}
                          </ul>
                        </>
                      )}
                      {data.related.length > 0 && (
                        <>
                          <h3>Bản ghi phát sinh</h3>
                          <ul className="docs-files">
                            {data.related.map((record) => (
                              <RecordLink
                                key={record.recordType + record.id}
                                record={record}
                              />
                            ))}
                          </ul>
                        </>
                      )}
                    </Card>
                  )}
                  <Card title="Lịch sử thay đổi">
                    <History items={data.history} />
                  </Card>
                </div>
              </div>
              {correction && canCorrect && (
                <CorrectionDialog
                  key={path}
                  data={data}
                  onClose={() => setCorrection(false)}
                />
              )}
            </>
          )
        }}
      </Result>
    </div>
  )
}
