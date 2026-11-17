import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInventoryData } from '../inventory/api'
import { paymentMethodLabels } from '../../shared/labels/status'
import { formatDateTime, formatMoney } from '../../shared/utils/format'
import FormDialog from '../../shared/ui/FormDialog'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import PageHeader from '../../shared/ui/PageHeader'
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
import type { DocumentDetail, DocumentLine, DocumentLink } from './types'

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
  const { document: row, content } = data
  const isPayment = row.type === 'PAYMENT'
  const unit = isPayment ? '₫' : ''
  const targets = isPayment
    ? [
        { name: 'Số tiền', value: content.amount },
        { name: 'Hình thức thanh toán', value: content.paymentMethod },
      ]
    : (content.lines ?? []).map((line) => ({
        name: line.partName + ' · ' + line.sku,
        value:
          row.type === 'SALES_ORDER'
            ? line.deliveredQty
            : row.type === 'TRANSFER_ORDER'
              ? line.receivedQty
              : line.passedQty,
      }))
  const [selected, setSelected] = useState(0)
  const [correct, setCorrect] = useState('')
  const current = targets[selected]?.value
  const method = typeof current === 'string'
  const delta =
    typeof current === 'number' && correct !== ''
      ? Number(correct) - current
      : null

  return (
    <FormDialog
      title={'Yêu cầu sửa chứng từ ' + row.number}
      formId="document-correction"
      submitLabel="Gửi Owner duyệt"
      submitDisabled
      onClose={onClose}
    >
      <form
        id="document-correction"
        className="docs-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <p className="docs-note">
          Chứng từ gốc được giữ để đối chiếu. Điều chỉnh được ghi vào ngày Owner
          duyệt trong kỳ đang mở.
        </p>
        <label>
          Nội dung cần sửa
          <select
            value={selected}
            onChange={(event) => {
              setSelected(Number(event.target.value))
              setCorrect('')
            }}
          >
            {targets.map((target, index) => (
              <option value={index} key={index}>
                {target.name}
              </option>
            ))}
          </select>
        </label>
        <div className="docs-facts docs-correction-values">
          <div>
            <strong>Đang ghi</strong>
            <p>
              {method
                ? (paymentMethodLabels[current] ?? current)
                : isPayment
                  ? formatMoney(current)
                  : (current ?? '—')}
            </p>
          </div>
          <label>
            {unit && !method ? 'Giá trị đúng (' + unit + ')' : 'Giá trị đúng'}
            {method ? (
              <select
                required
                value={correct}
                onChange={(event) => setCorrect(event.target.value)}
              >
                <option value="">Chọn hình thức</option>
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                type="number"
                min="0"
                step="1"
                value={correct}
                onChange={(event) => setCorrect(event.target.value)}
              />
            )}
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
          <textarea required rows={3} maxLength={500} />
        </label>
        <div>
          <strong>Chứng cứ</strong>
          <LocalizedFileInput
            aria-label="Chứng cứ"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            multiple
          />
        </div>
        <p role="status" className="docs-note">
          Chờ API kiểm tra phụ thuộc, xem ảnh hưởng và gửi yêu cầu sửa chứng từ.
        </p>
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
            row.type !== 'ADJUSTMENT' &&
            row.status !== 'CANCELLED' &&
            !pending &&
            (row.type === 'PAYMENT' || !!content.lines?.length)
          const author =
            typeof content.createdBy === 'string'
              ? content.createdBy
              : content.createdBy?.fullName
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
