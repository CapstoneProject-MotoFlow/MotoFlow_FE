import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useInventoryData } from '../inventory/api'
import PageHeader from '../../shared/ui/PageHeader'
import { paymentMethodLabels } from '../../shared/labels/status'
import { formatDateTime, formatMoney } from '../../shared/utils/format'
import { Facts, Result, Table } from './DocumentUi'
import {
  documentPath,
  isDocumentType,
  printForms,
  validId,
  type PrintForm,
} from './model'
import type { DocumentDetail, DocumentPrint, PrintParty } from './types'
import { createXlsx, downloadBlob } from '../../shared/utils/xlsx'

function Party({ title, party }: { title: string; party: PrintParty }) {
  return (
    <div>
      <strong>
        {title} · {party.name}
      </strong>
      <p>{party.address}</p>
      {party.phone && <p>Điện thoại {party.phone}</p>}
      {party.taxCode && <p>Mã số thuế {party.taxCode}</p>}
    </div>
  )
}

function PrintSheet({ data }: { data: DocumentPrint }) {
  const priced = data.lines.some(
    (line) => line.unitPrice != null || line.amount != null,
  )
  const lots = data.lines.some(
    (line) => line.lotId != null || line.manufacturerLotNo,
  )
  const payment = data.payment
  const totals = data.totals
  const amounts: [string, number | null | undefined][] = [
    ['Tổng theo giá tham chiếu', totals?.referenceTotal],
    ['Chiết khấu', totals?.discountAmount],
    ['Tổng tiền', totals?.total],
    ['Đã thu', totals?.paid],
    ['Ghi nợ', totals?.credit],
  ]
  return (
    <article className="docs-print-sheet" aria-label={'Bản in ' + data.number}>
      <div className="docs-print-title">
        <div>
          <strong>MotoFlow</strong>
          <p>{data.store.name}</p>
        </div>
        <div>
          <strong>{data.number}</strong>
          <p>{formatDateTime(data.documentDate)}</p>
        </div>
      </div>
      <h2>
        {data.form === 'PAYMENT_RECEIPT' && data.payment?.paymentType === 'REFUND'
          ? 'Phiếu chi hoàn tiền'
          : printForms[data.form]}
      </h2>
      <div className="docs-print-parties">
        <Party title="Đơn vị lập" party={data.store} />
        {data.counterpart && <Party title="Đối tác" party={data.counterpart} />}
      </div>
      {!!data.lines.length && (
        <Table
          label="Nội dung bản in"
          headers={[
            'STT',
            'Phụ tùng',
            ...(lots ? ['Lô'] : []),
            'Đơn vị',
            'Số lượng',
            ...(priced ? ['Đơn giá', 'Thành tiền'] : []),
          ]}
        >
          {data.lines.map((line) => (
            <tr key={line.no}>
              <td>{line.no}</td>
              <td>
                {line.partName}
                <small>{line.sku}</small>
              </td>
              {lots && (
                <td>
                  {line.manufacturerLotNo ||
                    (line.lotId ? '#' + line.lotId : '—')}
                </td>
              )}
              <td>{line.baseUnit}</td>
              <td>{line.quantity}</td>
              {priced && (
                <>
                  <td>{formatMoney(line.unitPrice)}</td>
                  <td>{formatMoney(line.amount)}</td>
                </>
              )}
            </tr>
          ))}
        </Table>
      )}
      {totals && (
        <Facts
          items={amounts.map(([label, value]) => [
            label,
            value != null ? formatMoney(value) : null,
          ])}
        />
      )}
      {payment && (
        <Facts
          items={[
            [
              'Loại phiếu',
              payment.paymentType === 'REFUND'
                ? 'Hoàn tiền'
                : payment.paymentType === 'DEBT_PAYMENT'
                  ? 'Thu nợ'
                  : 'Thu tiền đơn bán',
            ],
            [
              'Hình thức thanh toán',
              paymentMethodLabels[payment.paymentMethod] ??
                payment.paymentMethod,
            ],
            [
              'Số tiền',
              formatMoney(payment.paymentType === 'REFUND' ? -payment.amount : payment.amount),
            ],
            [
              'Khách đưa',
              payment.tenderedAmount != null
                ? formatMoney(payment.tenderedAmount)
                : null,
            ],
            [
              'Tiền trả lại',
              payment.changeGiven != null
                ? formatMoney(payment.changeGiven)
                : null,
            ],
            ['Mã giao dịch', payment.transactionReference],
          ]}
        />
      )}
      {!!payment?.allocations.length && (
        <Table label="Phân bổ khoản thu" headers={['Đơn bán', 'Khoản nợ', 'Số tiền phân bổ']}>
          {payment.allocations.map((allocation) => (
            <tr key={allocation.receivableId}>
              <td>{allocation.salesOrderId ? `Đơn bán #${allocation.salesOrderId}` : '—'}</td>
              <td>#{allocation.receivableId}</td>
              <td>{formatMoney(allocation.amount)}</td>
            </tr>
          ))}
        </Table>
      )}
      {data.note && (
        <p>
          {data.documentType === 'SALES_ORDER'
            ? 'Hình thức: ' + (data.note === 'PAID' ? 'Trả đủ' : 'Ghi nợ')
            : data.documentType === 'GOODS_RECEIPT'
              ? 'Số chứng từ NCC: ' + data.note
              : 'Ghi chú: ' + data.note}
        </p>
      )}
      <div className="docs-signatures">
        <strong>Người lập</strong>
        <strong>Người giao / nhận</strong>
        <strong>Quản lý cửa hàng</strong>
      </div>
      <p className="docs-muted">
        In từ MotoFlow · {formatDateTime(data.printedAt)}
        {data.printedBy && ' · ' + data.printedBy}
      </p>
    </article>
  )
}

export default function DocumentPrintPage() {
  const { type, id } = useParams()
  const valid = isDocumentType(type) && validId(id)
  const path = valid ? documentPath(type, id!) : ''
  const [params, setParams] = useSearchParams()
  const form = params.get('form') as PrintForm | null
  const detail = useInventoryData<DocumentDetail>(path, {}, 0, valid)
  const forms = detail.data?.document.printForms ?? []
  const selected = form && forms.includes(form) ? form : forms[0]
  const print = useInventoryData<DocumentPrint>(
    path + '/print',
    { form: selected },
    0,
    !!selected,
  )
  return (
    <div className="docs-page docs-print-page">
      <PageHeader
        title="In, xuất chứng từ"
        breadcrumb={[
          { label: 'Tra cứu chứng từ', to: '/documents' },
          {
            label: detail.data?.document.number ?? 'Chi tiết',
            to: path || '/documents',
          },
          { label: 'In' },
        ]}
      />
      <Result request={detail} empty="Chứng từ không hợp lệ.">
        {() => (
          <>
            <div className="docs-print-toolbar docs-actions">
              {forms.length > 0 && (
                <label>
                  Mẫu in
                  <select
                    value={selected}
                    onChange={(event) =>
                      setParams({ form: event.target.value })
                    }
                  >
                    {forms.map((item) => (
                      <option key={item} value={item}>
                        {printForms[item]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Link className="mf-btn mf-btn--secondary" to={path}>
                Quay lại
              </Link>
              {print.data && (
                <>
                  <button className="mf-btn mf-btn--secondary" onClick={() => window.print()}>
                    In / Lưu PDF
                  </button>
                  <button
                    className="mf-btn mf-btn--primary"
                    onClick={() => {
                      const data = print.data!
                      const rows: unknown[][] = [
                        ['Số chứng từ', 'Loại', 'Ngày', 'Cửa hàng', 'Đối tượng', 'Phụ tùng', 'SKU', 'Số lượng', 'Đơn vị', 'Đơn giá', 'Thành tiền'],
                        ...data.lines.map((line) => [
                          data.number,
                          printForms[data.form],
                          data.documentDate.slice(0, 10).split('-').reverse().join('/'),
                          data.store.name,
                          data.counterpart?.name ?? '',
                          line.partName,
                          line.sku,
                          line.quantity,
                          line.baseUnit,
                          line.unitPrice,
                          line.amount,
                        ]),
                      ]
                      downloadBlob(`${data.number}.xlsx`, createXlsx([{ name: 'Chung tu', rows }]))
                    }}
                  >
                    Xuất Excel
                  </button>
                </>
              )}
            </div>
            {selected ? (
              <Result request={print}>
                {(data) => <PrintSheet data={data} />}
              </Result>
            ) : (
              <p className="docs-message">Chứng từ này chưa có mẫu in.</p>
            )}
          </>
        )}
      </Result>
    </div>
  )
}
