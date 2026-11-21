import { useState } from 'react'
import axiosClient from '../../../shared/api/axiosClient'
import FormDialog from '../../../shared/ui/FormDialog'
import { inventoryError } from '../../inventory/api'
import './product-quick-view.css'

type ProductInfo = {
  sku: string
  partName: string
  categoryName?: string
  brand?: string
  baseUnit?: string
  specifications?: string | null
  barcodes?: string[]
  retailPrice?: number | null
  stock?: { availableQty: number } | null
}

export default function ProductQuickView({
  productId,
  sku,
  partName,
  blindCount = false,
}: {
  productId: number
  sku: string
  partName: string
  blindCount?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [product, setProduct] = useState<ProductInfo>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function show() {
    setOpen(true)
    if (product || loading) return
    setLoading(true)
    setError('')
    try {
      const response = await axiosClient.get<ProductInfo>(
        '/products/' + productId,
      )
      setProduct(response.data)
    } catch (failure) {
      setError(inventoryError(failure))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="product-quick-view-trigger"
        aria-label={'Xem chi tiết ' + sku + ' · ' + partName}
        onClick={() => void show()}
      >
        {partName}
      </button>
      {open && (
        <FormDialog
          title="Chi tiết phụ tùng"
          formId={'product-quick-view-' + productId}
          submitLabel="Đóng"
          hideSubmit
          onClose={() => setOpen(false)}
        >
          {error ? (
            <p role="alert">{error}</p>
          ) : loading || !product ? (
            <p role="status">Đang tải thông tin phụ tùng…</p>
          ) : (
            <dl className="product-quick-view-facts">
              <div><dt>Phụ tùng</dt><dd>{product.partName}</dd></div>
              <div><dt>Mã SKU</dt><dd>{product.sku}</dd></div>
              {product.categoryName && <div><dt>Danh mục</dt><dd>{product.categoryName}</dd></div>}
              {product.brand && <div><dt>Thương hiệu</dt><dd>{product.brand}</dd></div>}
              {product.baseUnit && <div><dt>Đơn vị</dt><dd>{product.baseUnit}</dd></div>}
              {product.specifications && <div><dt>Quy cách</dt><dd>{product.specifications}</dd></div>}
              {!!product.barcodes?.length && <div><dt>Mã vạch</dt><dd>{product.barcodes.join(' · ')}</dd></div>}
              {product.retailPrice != null && <div><dt>Giá bán lẻ</dt><dd>{product.retailPrice.toLocaleString('vi-VN')} ₫</dd></div>}
              {!blindCount && product.stock && <div><dt>Có thể bán</dt><dd>{product.stock.availableQty.toLocaleString('vi-VN')}</dd></div>}
            </dl>
          )}
        </FormDialog>
      )}
    </>
  )
}
