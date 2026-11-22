import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import type { Page } from '../inventory/types'
import PageHeader from '../../shared/ui/PageHeader'
import { useSearchBox } from '../../shared/hooks/useSearchBox'
import { formatDateTime, formatMoney } from '../../shared/utils/format'
import { Card, Pager, Result, Status, Table } from './DocumentUi'
import {
  dateWindow,
  documentPath,
  documentStatus,
  documentTypes,
  isDocumentType,
  pageIndex,
} from './model'
import type { DocumentRow } from './types'

export default function DocumentSearchPage() {
  const {
    params,
    filter,
    setParams,
    owner,
    stores,
    storeId,
    warehouse,
    storesError,
  } = useInventoryScope()
  const defaults = dateWindow(7)
  const q = params.get('q') ?? ''
  const search = useSearchBox(q, (value) => filter({ q: value }, true))
  const numberSearch = /^#?\d+$/.test(q.trim())
  const rawType = params.get('type') ?? ''
  const type = isDocumentType(rawType) ? rawType : ''
  const from = params.get('from') ?? defaults.from
  const to = params.get('to') ?? defaults.to
  const dateError = from > to
  const ready = !!(q.trim() || type)
  const results = useInventoryData<Page<DocumentRow>>(
    '/documents',
    {
      q: q.trim(),
      type,
      from: numberSearch ? undefined : from,
      to: numberSearch ? undefined : to,
      storeId,
      page: pageIndex(params.get('page')),
      size: 20,
    },
    0,
    ready && !dateError,
  )
  return (
    <div className="docs-page">
      <PageHeader
        title="Tra cứu chứng từ"
        breadcrumb={[{ label: 'Chứng từ' }, { label: 'Tra cứu chứng từ' }]}
      />
      <Card title={owner ? 'Chứng từ của chuỗi' : 'Chứng từ · ' + warehouse}>
        <div className="docs-filters">
          <label className="docs-search">
            Số chứng từ hoặc đối tượng
            <input
              type="search"
              placeholder="Số chứng từ, tên khách hoặc nhà cung cấp"
              {...search}
            />
          </label>
          <label>
            Loại chứng từ
            <select
              value={type}
              onChange={(e) => filter({ type: e.target.value })}
            >
              <option value="">Mọi loại chứng từ</option>
              {Object.entries(documentTypes).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {owner && (
            <label>
              Cửa hàng
              <select
                value={storeId}
                onChange={(e) => filter({ storeId: e.target.value })}
              >
                <option value="">Mọi cửa hàng</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Từ ngày
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => filter({ from: e.target.value })}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => filter({ to: e.target.value })}
            />
          </label>
          <div className="docs-actions" aria-label="Khoảng ngày nhanh">
            {[
              [1, 'Hôm nay'],
              [7, '7 ngày'],
              [30, '30 ngày'],
            ].map(([days, label]) => {
              const range = dateWindow(Number(days))
              return (
                <button
                  type="button"
                  className="mf-btn mf-btn--secondary"
                  key={days}
                  aria-pressed={range.from === from && range.to === to}
                  onClick={() => filter(range)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        {numberSearch && q.trim() && (
          <p className="docs-note" role="status">
            Đang tìm theo số, bỏ qua khoảng ngày.
          </p>
        )}
        {storesError && (
          <p role="alert" className="docs-muted">
            Không tải được danh sách cửa hàng.
          </p>
        )}
        {dateError && !numberSearch ? (
          <p className="docs-alert" role="alert">
            Từ ngày phải trước hoặc bằng đến ngày.
          </p>
        ) : !ready ? (
          <p className="docs-message">
            Gõ số chứng từ hoặc chọn một loại chứng từ để tra cứu.
          </p>
        ) : (
          <Result request={results}>
            {(data) => (
              <>
                {data.items.length ? (
                  <Table
                    label="Kết quả tra cứu chứng từ"
                    headers={[
                      'Số chứng từ',
                      'Ngày',
                      ...(owner ? ['Cửa hàng'] : []),
                      'Đối tượng',
                      'Giá trị',
                      'Trạng thái',
                      'Thao tác',
                    ]}
                  >
                    {data.items.map((row) => (
                      <tr key={row.type + row.id}>
                        <td>
                          <Link to={documentPath(row.type, row.id)}>
                            {row.number}
                          </Link>
                          <small>{documentTypes[row.type]}</small>
                        </td>
                        <td>{formatDateTime(row.documentDate)}</td>
                        {owner && <td>{row.storeName}</td>}
                        <td>{row.partnerName || row.otherStoreName}</td>
                        <td>
                          {row.value != null ? formatMoney(row.value) : ''}
                        </td>
                        <td>
                          <Status
                            value={row.status}
                            label={documentStatus(row.type, row.status)}
                          />
                        </td>
                        <td>
                          {row.printForms.length > 0 && (
                            <Link
                              className="mf-btn mf-btn--secondary"
                              aria-label={'In ' + row.number}
                              to={documentPath(row.type, row.id) + '/print'}
                            >
                              In
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <p className="docs-message">Không có chứng từ phù hợp.</p>
                )}
                <Pager
                  page={data}
                  noun="chứng từ"
                  onPage={(page) =>
                    setParams((previous) => {
                      const next = new URLSearchParams(previous)
                      next.set('page', String(page))
                      return next
                    })
                  }
                />
              </>
            )}
          </Result>
        )}
      </Card>
    </div>
  )
}
