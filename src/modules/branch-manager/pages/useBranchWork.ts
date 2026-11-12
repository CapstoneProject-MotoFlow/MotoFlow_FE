import { useInventoryData } from '../../inventory/api'
import { useAuth } from '../../../shared/hooks/useAuth'
import type { Page, StockSummary } from '../../inventory/types'
import type { CountList } from '../../inventory/countApi'
import type { SummaryDto } from '../../sales/salesApi'
import type { TransferRow, ReplenishmentRow } from '../../transfers/types'

type ReceiptRow = {
  id: number
  supplierName: string
  arrivedAt: string
  submittedAt: string | null
  status: string
  assigneeId: number | null
}
type Work = {
  key: string
  code: string
  kind: string
  title: string
  description: string
  at: string
  href: string
  action: string
}
export function useBranchWork(coordinator: boolean) {
  const { user } = useAuth()
  const sales = useInventoryData<Page<SummaryDto>>('/sales-orders', {
      view: 'OPEN',
      page: 0,
      size: 5,
    }),
    receipts = useInventoryData<Page<ReceiptRow>>('/goods-receipt-notes', {
      status: 'AWAITING_CONFIRMATION',
      page: 0,
      size: 5,
    }),
    unassigned = useInventoryData<Page<ReceiptRow>>('/goods-receipt-notes', {
      unassigned: true,
      page: 0,
      size: 5,
    }),
    transfers = useInventoryData<Page<TransferRow>>(
      '/transfer-orders',
      {
        status: 'AWAITING_DISPATCH',
        sourceStoreId: user?.storeId ?? undefined,
        page: 0,
        size: 5,
      },
      0,
      user?.storeId != null,
    ),
    drafts = useInventoryData<CountList>('/stock-counts', {
      status: 'DRAFT',
      page: 0,
      size: 5,
    }),
    counts = useInventoryData<CountList>('/stock-counts', {
      status: 'COUNTING',
      page: 0,
      size: 5,
    }),
    replenishments = useInventoryData<Page<ReplenishmentRow>>(
      '/replenishment-requests',
      { status: 'AWAITING_COORDINATION', page: 0, size: 5 },
      0,
      coordinator,
    )
  const summary = useInventoryData<StockSummary>('/inventory/stock/summary'),
    lots = useInventoryData<{ page: Page<unknown> }>('/inventory/lots', {
      tab: 'NEAR_EXPIRY',
      page: 0,
      size: 1,
    })
  const saleActions = {
    ASSIGN_PICKER: { title: 'Chưa giao việc lấy hàng', action: 'Giao việc' },
    RECORD_PICKING: { title: 'Đang chờ kết quả lấy hàng', action: 'Xem đơn' },
    CONFIRM: { title: 'Đơn lấy hàng chờ xác nhận', action: 'Xác nhận' },
    COLLECT_PAYMENT: { title: 'Đơn chờ thanh toán', action: 'Thu tiền' },
  }
  const work: Work[] = [
    ...(sales.data?.items ?? [])
      .filter((s) => s.nextAction)
      .map((s) => ({
        key: 's' + s.id,
        code: 'DB-' + String(s.id).padStart(4, '0'),
        kind: 'Đơn bán',
        title: saleActions[s.nextAction!].title,
        action: saleActions[s.nextAction!].action,
        description: s.customerName ?? 'Khách lẻ',
        at: s.createdAt,
        href: '/sales-orders/' + s.id,
      })),
    ...(receipts.data?.items ?? []).map((r) => ({
      key: 'r' + r.id,
      code: 'PN-' + String(r.id).padStart(4, '0'),
      kind: 'Phiếu nhận hàng',
      title: 'Kết quả kiểm nhận chờ xác nhận',
      description: r.supplierName,
      at: r.submittedAt ?? r.arrivedAt,
      href: '/goods-receipt-notes/' + r.id,
      action: 'Xác nhận',
    })),
    ...(unassigned.data?.items ?? []).map((r) => ({
      key: 'r' + r.id,
      code: 'PN-' + String(r.id).padStart(4, '0'),
      kind: 'Phiếu nhận hàng',
      title: 'Chưa giao việc kiểm nhận',
      description: r.supplierName,
      at: r.arrivedAt,
      href: '/goods-receipt-notes/' + r.id,
      action: 'Giao việc',
    })),
    ...(transfers.data?.items ?? []).map((t) => ({
      key: 't' + t.id,
      code: 'DC-' + String(t.id).padStart(4, '0'),
      kind: 'Điều chuyển',
      title: 'Chuẩn bị hàng, chờ xuất',
      description: t.sourceStoreName + ' đến ' + t.destStoreName,
      at: t.createdAt,
      href: '/transfer-orders/' + t.id,
      action: 'Xuất hàng',
    })),
    ...(drafts.data?.pendingRequests ?? []).map((r) => ({
      key: 'q' + r.id,
      code: 'YKK-' + String(r.id).padStart(4, '0'),
      kind: 'Yêu cầu kiểm kê',
      title: 'Owner yêu cầu kiểm kê',
      description: r.storeName + ' · ' + r.reason,
      at: r.requestedAt,
      href: '/stock-counts?action=create&requestId=' + r.id,
      action: 'Tạo phiếu',
    })),
    ...[
      ...(drafts.data?.counts.items ?? []),
      ...(counts.data?.counts.items ?? []),
    ].map((c) => ({
      key: 'c' + c.id,
      code: 'KK-' + String(c.id).padStart(4, '0'),
      kind: 'Kiểm kê',
      title:
        c.status === 'DRAFT'
          ? 'Phiếu kiểm kê chưa bắt đầu'
          : 'Kiểm kê đang đếm / chờ xác minh',
      description: c.storeName,
      at: c.createdAt,
      href: '/stock-counts/' + c.id,
      action: 'Xem phiếu',
    })),
    ...(replenishments.data?.items ?? []).map((r) => ({
      key: 'b' + r.id,
      code: 'YBS-' + String(r.id).padStart(4, '0'),
      kind: 'Yêu cầu bổ sung',
      title: 'Bổ sung hàng chờ điều phối',
      description: r.storeName,
      at: r.createdAt,
      href: '/replenishment-requests/' + r.id + '/coordinate',
      action: 'Điều phối',
    })),
  ]
  const rows = [...new Map(work.map((w) => [w.key, w])).values()].sort(
    (a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key),
  )
  const sources = [
    sales,
    receipts,
    unassigned,
    transfers,
    drafts,
    counts,
    replenishments,
  ]
  return {
    rows,
    loading: sources.some((s) => s.loading),
    error: sources.find((source) => source.error)?.error,
    retry: () => sources.forEach((source) => source.retry()),
    summary,
    lots,
    countTotal:
      drafts.data && counts.data
        ? drafts.data.counts.totalItems +
          counts.data.counts.totalItems +
          drafts.data.pendingRequests.length
        : undefined,
    countError: drafts.error || counts.error,
  }
}
