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
      <h2>{printForms[data.form]}</h2>
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
              'Hình thức thanh toán',
              paymentMethodLabels[payment.paymentMethod] ??
                payment.paymentMethod,
            ],
            ['Số tiền', formatMoney(payment.amount)],
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
      {data.note && <p>{data.note}</p>}
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
                <button
                  className="mf-btn mf-btn--primary"
                  onClick={() => window.print()}
                >
                  In / Lưu PDF
                </button>
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
