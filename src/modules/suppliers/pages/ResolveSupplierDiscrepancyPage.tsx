import { useSearchParams } from 'react-router-dom'
import PageBackLink from '../../../shared/ui/PageBackLink'
import CaseListView from '../discrepancy/CaseListView'
import ReceiptHandlingView from '../discrepancy/ReceiptHandlingView'
import '../supplier-discrepancy.css'

/**
 * Sai lệch nhà cung cấp (UC-46). Không có ?receipt: danh sách hồ sơ theo phụ tùng. Có ?receipt: xử lý mọi hồ sơ
 * của một phiếu nhập (hướng xử lý, trả hàng, giao bù, nhận hàng lỗi / giao sai).
 */
export default function ResolveSupplierDiscrepancyPage() {
  const [params] = useSearchParams()
  const receiptId = params.get('receipt') ?? ''
  const valid = /^[1-9]\d*$/.test(receiptId)
  return (
    <main className="dashboard-content supplier-discrepancy-page">
      <PageBackLink to="/purchase-orders" />
      {receiptId && !valid && (
        <p className="sd-alert" role="alert">
          Mã phiếu nhập không hợp lệ.
        </p>
      )}
      {valid ? (
        <ReceiptHandlingView key={receiptId} receiptId={receiptId} />
      ) : (
        <CaseListView initialPurchaseOrder={params.get('purchaseOrder') ?? ''} />
      )}
    </main>
  )
}
