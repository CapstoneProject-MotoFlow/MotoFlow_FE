import Brand from './Brand'

const stores = ['Nga Minh Yên Viên', 'Nga Minh Long Biên', 'Nga Minh Đông Anh']

function StoreIcon() {
  return (
    <span className="store-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 10h16M5 10v9h14v-9M3.5 10l1.6-5h13.8l1.6 5M9 19v-5h6v5M8 10v2m4-2v2m4-2v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export default function BrandPanel() {
  return (
    <aside className="brand-pane">
      <div className="brand-content">
        <Brand />
        <p className="brand-description">Quản lý phụ tùng, nhập hàng và tồn kho cho<br className="desktop-break" /> chuỗi cửa hàng phụ tùng xe Nga Minh.</p>
        <ul className="store-list" aria-label="Các cửa hàng Nga Minh">
          {stores.map((store) => (
            <li className="store-item" key={store}>
              <StoreIcon />
              <span>{store}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
