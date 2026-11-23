/**
 * File: modules/transfers/ReceiverMiscountAction.tsx
 * Loại: THÀNH PHẦN — nút "Bên nhận kiểm sai" của Owner trên bảng Sai lệch của lệnh điều chuyển.
 * Công dụng: PM 23/11 (plan bản 2, B-5). Owner thấy kho nhận ghi sai số kiểm nhận của một dòng: ghi lý do (bắt buộc,
 * MSG343), kho nhận có đủ số đã xuất (hàng đi đường và hàng hỏng đã xóa sổ cộng lại đúng lô), hàng thừa chờ, phiếu
 * nhận hàng giao sai chờ Owner và quyết định Nhận sau / Không cần giao bù của dòng bị hủy. Kho gửi không đổi, phiếu
 * kiểm nhận của Staff giữ nguyên số đã ghi. Dòng đã có phần không đảo được thì BE chặn (MSG344, MSG29).
 */
import { useState } from 'react'
import FieldError from '../../shared/ui/FieldError'
import TransferAction from './TransferAction'
import type { PartLine } from './types'

export default function ReceiverMiscountAction({
  orderId,
  caseId,
  line,
  onSaved,
}: {
  orderId: number
  caseId: number
  line: PartLine
  onSaved: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const dispatched = line.dispatchedQty ?? 0
  const missing = reason.trim() === ''
  return (
    <>
      <button
        type="button"
        className="mf-btn mf-btn--sm mf-btn--secondary"
        onClick={() => {
          setReason('')
          setTouched(false)
          setOpen(true)
        }}
      >
        Bên nhận kiểm sai
      </button>
      {open && (
        <TransferAction
          title={'Bên nhận kiểm sai · ' + line.sku}
          path={
            '/transfer-orders/' +
            orderId +
            '/discrepancies/' +
            caseId +
            '/receiver-miscount'
          }
          disabled={missing}
          payload={() => ({ reason: reason.trim() })}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            onSaved(
              'Đã sửa ' +
                line.sku +
                ' theo "Bên nhận kiểm sai": kho nhận có đủ ' +
                dispatched +
                '.',
            )
          }}
        >
          <p className="tf-note">
            Kho nhận sẽ có đủ {dispatched} {line.sku}; hủy hàng thừa, giao sai
            và quyết định Nhận sau / Không cần giao bù của dòng. Kho gửi không
            đổi. Phiếu kiểm nhận của nhân viên vẫn giữ số đã ghi.
          </p>
          <label>
            Lý do *
            <textarea
              required
              maxLength={255}
              aria-label="Lý do bên nhận kiểm sai"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setTouched(true)
              }}
            />
            <FieldError
              message={
                touched && missing
                  ? 'Vui lòng nhập lý do bên nhận kiểm sai.'
                  : undefined
              }
            />
          </label>
        </TransferAction>
      )}
    </>
  )
}
