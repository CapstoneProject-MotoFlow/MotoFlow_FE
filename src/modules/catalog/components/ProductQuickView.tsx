import { useState, type ReactNode } from 'react'
import axiosClient from '../../../shared/api/axiosClient'
import FormDialog from '../../../shared/ui/FormDialog'
import ImageViewer from '../../../shared/ui/ImageViewer'
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
  imageUrls?: string[]
}

export default function ProductQuickView({
  productId,
  sku,
  partName,
  blindCount = false,
  className,
  extraFacts,
}: {
  productId: number
  sku: string
  partName: string
  blindCount?: boolean
  className?: string
  /** Dòng thông tin thêm của ngữ cảnh (ví dụ Kệ, Lô gợi ý lấy), hiện đầu bảng chi tiết. */
  extraFacts?: Array<[label: string, value: ReactNode]>
}) {
  const [open, setOpen] = useState(false)
  const [product, setProduct] = useState<ProductInfo>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewingImage, setViewingImage] = useState<number | null>(null)

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
        className={['product-quick-view-trigger', className]
          .filter(Boolean)
          .join(' ')}
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
          closeLabel="Đóng"
          hideSubmit
          onClose={() => setOpen(false)}
        >
          {error ? (
            <p role="alert">{error}</p>
          ) : loading || !product ? (
            <p role="status">Đang tải thông tin phụ tùng…</p>
          ) : (
            <div className="product-quick-view-content">
              <section className="product-quick-view-gallery" aria-label="Ảnh phụ tùng">
                <h3>Ảnh phụ tùng</h3>
                {product.imageUrls?.length ? (
                  <div className="product-quick-view-images">
                    {product.imageUrls.map((url, index) => (
                      <button
                        key={url}
                        type="button"
                        aria-label={`Phóng to ảnh ${index + 1}`}
                        onClick={() => setViewingImage(index)}
                      >
                        <img src={url} alt={`${product.partName} · ảnh ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="product-quick-view-no-image">Chưa có ảnh phụ tùng.</p>
                )}
              </section>
              <dl className="product-quick-view-facts">
                {extraFacts?.map(([label, value], index) => (
                  <div key={index}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
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
              {viewingImage !== null && product.imageUrls?.length ? (
                <ImageViewer
                  images={product.imageUrls.map((src, index) => ({
                    src,
                    name: `${product.partName} · ảnh ${index + 1}`,
                  }))}
                  start={viewingImage}
                  onClose={() => setViewingImage(null)}
                />
              ) : null}
            </div>
          )}
        </FormDialog>
      )}
    </>
  )
}
