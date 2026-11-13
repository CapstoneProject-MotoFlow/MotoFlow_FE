import { useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import type { UnmetRow } from './salesApi'
import { documentCode } from '../../shared/utils/documentCode'
export default function DemandReplenishment({
  row,
  onClose,
}: {
  row: UnmetRow
  onClose: () => void
}) {
  const [quantity, setQuantity] = useState(String(row.missingQty)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState<number>()
  const lock = useRef(false)
  return (
    <FormDialog
      className="sales-transaction-dialog sales-demand-dialog"
      title="Yêu cầu bổ sung từ nhu cầu"
      formId="demand-replenishment"
      busy={busy}
      submitDisabled={
        busy ||
        saved != null ||
        quantity === '' ||
        !Number.isInteger(Number(quantity)) ||
        Number(quantity) < 1 ||
        Number(quantity) > 2147483647
      }
      submitLabel={
        busy
          ? 'Đang tạo…'
          : saved != null
            ? 'Đã tạo yêu cầu'
            : 'Tạo yêu cầu bổ sung'
      }
      onClose={onClose}
    >
      <form
        id="demand-replenishment"
        className="sales-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (lock.current || saved != null) return
          const qty = Number(quantity)
          if (!Number.isInteger(qty) || qty < 1 || qty > 2147483647) {
            setError('Số lượng phải là số nguyên dương.')
            return
          }
          lock.current = true
          setBusy(true)
          setError('')
          try {
            const { data } = await axiosClient.post('/replenishment-requests', {
              storeId: row.storeId,
              note: 'Nhu cầu từ đơn SO-' + row.orderId,
              lines: [{ productId: row.productId, requestedQty: qty }],
            })
            setSaved(data.id)
          } catch (error) {
            setError(inventoryError(error))
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        <div className="sales-demand-product">
          <strong>{row.partName}</strong>
          <small>{row.sku}</small>
        </div>
        <dl className="sales-demand-summary">
          <div>
            <dt>Cửa hàng nhận</dt>
            <dd>{row.storeName}</dd>
          </div>
          <div>
            <dt>Đơn gốc</dt>
            <dd>SO-{row.orderId}</dd>
          </div>
          <div>
            <dt>Nhu cầu còn thiếu</dt>
            <dd>
              {row.missingQty} {row.baseUnit}
            </dd>
          </div>
          <div>
            <dt>Còn bán được</dt>
            <dd>
              {row.sellableQty} {row.baseUnit}
            </dd>
          </div>
        </dl>
        <label>
          Số lượng cần bổ sung *
          <input
            required
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <p className="sales-demand-hint">
          Yêu cầu được gửi cho cửa hàng {row.storeName}. Việc tạo yêu cầu chưa
          thay đổi tồn kho hoặc nhu cầu của đơn gốc.
        </p>
        {error && <p role="alert">{error}</p>}
        {saved != null && (
          <p role="status">
            Đã tạo yêu cầu bổ sung {documentCode('YBS', saved)}. Nhu cầu gốc vẫn
            được tính theo đơn bán.
          </p>
        )}
      </form>
    </FormDialog>
  )
}
