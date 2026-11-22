import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useInventoryData } from '../inventory/api'
import PageHeader from '../../shared/ui/PageHeader'
import { Result } from './DocumentUi'
import {
  documentPath,
  isDocumentType,
  printForms,
  validId,
  type PrintForm,
} from './model'
import PrintSheetLarge from './print/PrintSheetLarge'
import PrintSheetSmall from './print/PrintSheetSmall'
import PrintSheetStandard from './print/PrintSheetStandard'
import {
  pageCss,
  parseLayout,
  printLayouts,
  printParams,
} from './print/printLayout'
import type { DocumentDetail, DocumentPrint, PrintLayout } from './types'
import { createXlsx, downloadBlob } from '../../shared/utils/xlsx'

function PrintBody({ data }: { data: DocumentPrint }) {
  const ref = useRef<HTMLDivElement>(null)
  const [heightMm, setHeightMm] = useState<number>()
  // Chrome ignores `size: 80mm auto`, so the 80 mm page gets the sheet's real height.
  useLayoutEffect(() => {
    if (data.layout !== 'SMALL') return
    const sheet = ref.current?.querySelector<HTMLElement>('.print-small')
    if (sheet) setHeightMm((sheet.getBoundingClientRect().height * 25.4) / 96)
  }, [data])
  const sheet =
    data.form === 'SALES_INVOICE' && data.layout === 'SMALL' ? (
      <PrintSheetSmall data={data} />
    ) : data.form === 'SALES_INVOICE' && data.layout === 'LARGE' ? (
      <PrintSheetLarge data={data} />
    ) : (
      <PrintSheetStandard data={data} />
    )
  return data.layout ? (
    <>
      <style>{pageCss(data.layout, heightMm)}</style>
      <div ref={ref}>{sheet}</div>
    </>
  ) : (
    sheet
  )
}

export default function DocumentPrintPage() {
  const { type, id } = useParams()
  const valid = isDocumentType(type) && validId(id)
  const path = valid ? documentPath(type, id!) : ''
  const [params, setParams] = useSearchParams()
  const form = params.get('form') as PrintForm | null
  const requestedLayout = parseLayout(params.get('layout'))
  const detail = useInventoryData<DocumentDetail>(path, {}, 0, valid)
  const forms = detail.data?.document.printForms ?? []
  const selected = form && forms.includes(form) ? form : forms[0]
  const print = useInventoryData<DocumentPrint>(
    path + '/print',
    printParams(selected, requestedLayout),
    0,
    !!selected,
  )
  // Keep the select mounted while a refetch runs: prefer the URL, then the last loaded layout.
  const layoutValue = requestedLayout ?? print.data?.layout ?? null
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
              {selected === 'SALES_INVOICE' && layoutValue && (
                <label>
                  Khổ giấy
                  <select
                    value={layoutValue}
                    onChange={(event) =>
                      setParams({
                        form: selected,
                        layout: event.target.value,
                      })
                    }
                  >
                    {(Object.keys(printLayouts) as PrintLayout[]).map((item) => (
                      <option key={item} value={item}>
                        {printLayouts[item]}
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
                {(data) => <PrintBody data={data} />}
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
