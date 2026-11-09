import { unplannedQuantity } from './transferRules'
import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import {
  useInventoryData,
  useInventoryScope,
  inventoryError,
} from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { DashboardStore } from '../../shared/types/store'
import type { Replenishment, Transfer } from './types'
import { PartChoice } from './ReplenishmentCreatePage'
import { transferQuantitiesValid } from './transferRules'
import './transfers.css'
type Row = {
  key: number
  productId: number
  sku: string
  partName: string
  qty: number
  makeupForCaseId?: number
}
export default function TransferOrderCreatePage() {
  const [originalId, setOriginalId] = useState('')
  const scope = useInventoryScope(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    [source, setSource] = useState(''),
    [dest, setDest] = useState(''),
    [rows, setRows] = useState<Row[]>([
      { key: 1, productId: 0, sku: '', partName: '', qty: 1 },
    ]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const counter = useRef(1),
    lock = useRef(false),
    origin = useInventoryData<Transfer>(
      '/transfer-orders/' + originalId,
      {},
      0,
      !!originalId && /^\d+$/.test(originalId),
    ),
    requestId = params.get('requestId'),
    request = useInventoryData<Replenishment>(
      '/replenishment-requests/' + requestId,
      {},
      0,
      !!requestId,
    ),
    stores = useInventoryData<DashboardStore[]>('/stores', {}, 0, scope.owner),
    availability = useInventoryData<
      {
        productId: number
        storeId: number
        storeName: string
        sellableQty: number
      }[]
    >(
      '/inventory/availability',
      {
        productIds: rows
          .filter((r) => r.productId > 0)
          .map((r) => r.productId)
          .join(','),
      },
      0,
      rows.some((r) => r.productId > 0),
    ),
    destination = request.data ? String(request.data.requestingStoreId) : dest,
    options = stores.data ?? [
      ...new Map(
        (availability.data ?? []).map((s) => [
          s.storeId,
          { id: s.storeId, storeName: s.storeName },
        ]),
      ).values(),
      ...(request.data
        ? [
            {
              id: request.data.requestingStoreId,
              storeName: request.data.storeName,
            },
          ]
        : []),
    ],
    valid =
      !!source &&
      !!destination &&
      source !== destination &&
      transferQuantitiesValid(
        rows.map((r) => ({ productId: r.productId, quantity: r.qty })),
      ) &&
      (!requestId || !!request.data) &&
      rows.every(
        (r) =>
          !request.data ||
          !!r.makeupForCaseId ||
          r.qty <=
            unplannedQuantity(
              request.data.lines.find((l) => l.productId === r.productId),
            ),
      )
  async function save() {
    if (lock.current || !valid) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const r = await axiosClient.post<{ id: number }>('/transfer-orders', {
        sourceStoreId: Number(source),
        destStoreId: Number(destination),
        replenishmentRequestId: request.data?.id,
        lines: rows.map((l) => ({
          productId: l.productId,
          plannedQty: l.qty,
          makeupForCaseId: l.makeupForCaseId,
        })),
      })
      navigate('/transfer-orders/' + r.data.id)
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <main className="dashboard-content tf-page tf-repl-create tf-order-create">
      <header>
        <h1>Tạo lệnh điều chuyển</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> ›{' '}
          <Link to="/transfer-orders">Lệnh điều chuyển</Link> › Tạo mới
        </nav>
      </header>
      <InventoryNotice error={error || request.error || stores.error} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <fieldset disabled={busy}>
          <div className="tf-create-top">
            <section>
              <h2>Thông tin lệnh</h2>
              <div className="tf-general-grid">
                <label>
                  Từ kho <span>*</span>
                  <select
                    required
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="">Chọn kho nguồn</option>
                    {options
                      .filter(
                        (s) =>
                          String(s.id) !== destination &&
                          (!('status' in s) || s.status === 'ACTIVE'),
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.storeName}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Tới kho <span>*</span>
                  <select
                    required
                    disabled={!!requestId}
                    value={destination}
                    onChange={(e) => setDest(e.target.value)}
                  >
                    <option value="">Chọn kho đích</option>
                    {options
                      .filter(
                        (s) =>
                          String(s.id) !== source &&
                          (!('status' in s) ||
                            s.status === 'ACTIVE' ||
                            (scope.owner && s.status === 'PLANNED')),
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.storeName}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="tf-full tf-origin-note">
                  {requestId ? (
                    <>
                      <Link to={'/replenishment-requests/' + requestId}>
                        Yêu cầu YBS-{requestId?.padStart(4, '0')}
                      </Link>
                      <p>Kho nhận và nhu cầu còn lại lấy từ yêu cầu bổ sung.</p>
                      <button
                        type="button"
                        disabled={!request.data}
                        onClick={() =>
                          setRows(
                            request
                              .data!.lines.filter(
                                (l) => unplannedQuantity(l) > 0,
                              )
                              .map((l) => ({
                                key: ++counter.current,
                                productId: l.productId,
                                sku: l.sku,
                                partName: l.partName,
                                qty: unplannedQuantity(l),
                              })),
                          )
                        }
                      >
                        Điền phần còn thiếu
                      </button>
                    </>
                  ) : (
                    <p>
                      Lập lệnh trực tiếp giữa hai kho. Chưa giữ tồn cho đến khi
                      xác nhận xuất.
                    </p>
                  )}
                </div>
              </div>
            </section>
            <section className="tf-create-summary">
              <h2>Tóm tắt</h2>
              <dl>
                <div>
                  <dt>Số dòng</dt>
                  <dd>{rows.filter((r) => r.productId > 0).length}</dd>
                </div>
                <div>
                  <dt>Tổng số lượng</dt>
                  <dd>
                    {rows
                      .filter((r) => r.productId > 0)
                      .reduce((sum, r) => sum + r.qty, 0)}
                  </dd>
                </div>
              </dl>
              <button className="tf-primary" disabled={!valid || busy}>
                ✓ Tạo lệnh điều chuyển
              </button>
              <Link className="tf-cancel" to="/transfer-orders">
                Hủy
              </Link>
            </section>
          </div>
          <section>
            <h2>Phụ tùng điều chuyển</h2>
            <div className="tf-note">
              <label>
                Lệnh gốc cần bù thiếu (tùy chọn)
                <input
                  type="number"
                  min={1}
                  value={originalId}
                  onChange={(e) => {
                    setOriginalId(e.target.value)
                    setRows((old) =>
                      old.map((r) => ({ ...r, makeupForCaseId: undefined })),
                    )
                  }}
                />
              </label>
              <InventoryNotice loading={origin.loading} error={origin.error} />
            </div>
            <InventoryNotice
              loading={availability.loading}
              error={availability.error}
            />
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Bán được ở kho nguồn</th>
                    <th>Số lượng</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <PartChoice
                          row={row}
                          excluded={rows
                            .filter((r) => r.key !== row.key)
                            .map((r) => r.productId)}
                          onChange={(p) =>
                            setRows(
                              rows.map((r) =>
                                r.key === row.key
                                  ? { ...r, ...p, makeupForCaseId: undefined }
                                  : r,
                              ),
                            )
                          }
                        />
                        {origin.data && (
                          <select
                            aria-label={'Bù sai lệch ' + row.sku}
                            value={row.makeupForCaseId ?? ''}
                            onChange={(e) =>
                              setRows(
                                rows.map((r) =>
                                  r.key === row.key
                                    ? {
                                        ...r,
                                        makeupForCaseId: e.target.value
                                          ? Number(e.target.value)
                                          : undefined,
                                      }
                                    : r,
                                ),
                              )
                            }
                          >
                            <option value="">Không liên kết bù thiếu</option>
                            {origin.data.discrepancies
                              .filter(
                                (c) =>
                                  c.productId === row.productId &&
                                  c.status !== 'CLOSED' &&
                                  c.status !== 'RESOLVED',
                              )
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  Sai lệch #{c.id} · thiếu {c.shortQty}
                                </option>
                              ))}
                          </select>
                        )}
                        {request.data && row.productId > 0 && (
                          <small>
                            Còn cần:{' '}
                            {unplannedQuantity(
                              request.data.lines.find(
                                (l) => l.productId === row.productId,
                              ),
                            )}
                          </small>
                        )}
                      </td>
                      <td>
                        {!source
                          ? 'Chọn kho nguồn'
                          : !row.productId
                            ? 'Chọn phụ tùng'
                            : availability.loading
                              ? 'Đang tải…'
                              : availability.error
                                ? 'Không tải được'
                                : (availability.data?.find(
                                    (s) =>
                                      s.productId === row.productId &&
                                      String(s.storeId) === source,
                                  )?.sellableQty ?? 0)}
                      </td>
                      <td>
                        <input
                          aria-label={'Số lượng dòng ' + row.key}
                          required
                          type="number"
                          min={1}
                          max={
                            request.data && !row.makeupForCaseId
                              ? unplannedQuantity(
                                  request.data.lines.find(
                                    (l) => l.productId === row.productId,
                                  ),
                                )
                              : 2147483647
                          }
                          value={row.qty}
                          onChange={(e) =>
                            setRows(
                              rows.map((r) =>
                                r.key === row.key
                                  ? { ...r, qty: Number(e.target.value) }
                                  : r,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setRows(rows.filter((r) => r.key !== row.key))
                          }
                        >
                          Bỏ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tf-add-row">
              <button
                type="button"
                disabled={rows.length >= 200}
                onClick={() =>
                  setRows([
                    ...rows,
                    {
                      key: ++counter.current,
                      productId: 0,
                      sku: '',
                      partName: '',
                      qty: 1,
                    },
                  ])
                }
              >
                ＋ Thêm dòng
              </button>
            </div>
          </section>
        </fieldset>
      </form>
    </main>
  )
}
