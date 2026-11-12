import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import axiosClient from '../../../shared/api/axiosClient'
import ConfirmDialog from '../../../shared/ui/ConfirmDialog'
import RowMenu from '../../../shared/ui/RowMenu'

export default function ProductRowActions({
  id,
  name,
  status,
  onChanged,
  editHref,
}: {
  editHref: string
  id: number
  name: string
  status: string
  onChanged: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const active = status === 'ACTIVE'
  async function changeStatus() {
    setError('')
    try {
      await axiosClient.post(
        '/products/' + id + '/' + (active ? 'discontinue' : 'reactivate'),
      )
      setConfirming(false)
      onChanged()
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : undefined
      setError(
        typeof message === 'string'
          ? message
          : 'Không cập nhật được trạng thái. Vui lòng thử lại.',
      )
    }
  }
  return (
    <>
      {/* Review T4: "Ngừng kinh doanh" (nguy hiểm) không nằm sẵn trên mọi dòng, đưa vào menu "Khác". */}
      <div className="parts-row-actions">
        <Link
          className="mf-btn mf-btn--secondary mf-btn--sm"
          to={editHref}
          aria-label={'Sửa ' + name}
        >
          Sửa
        </Link>
        <RowMenu
          ariaLabel={'Thao tác khác với ' + name}
          items={[
            {
              label: active ? 'Ngừng kinh doanh' : 'Mở lại kinh doanh',
              danger: active,
              onSelect: () => {
                setError('')
                setConfirming(true)
              },
            },
          ]}
        />
      </div>
      {confirming && (
        <ConfirmDialog
          title={active ? 'Ngừng kinh doanh phụ tùng?' : 'Mở lại kinh doanh?'}
          message={
            <>
              <p>{name}</p>
              <p>
                {active
                  ? 'Phụ tùng sẽ không được bán hoặc nhập mới. Lịch sử giao dịch được giữ lại.'
                  : 'Phụ tùng sẽ được phép bán và nhập mới.'}
              </p>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
            </>
          }
          danger={active}
          onCancel={() => setConfirming(false)}
          onConfirm={changeStatus}
        />
      )}
    </>
  )
}
