import { Link, type To } from 'react-router-dom'
import './page-back-link.css'

export default function PageBackLink({ to }: { to: To }) {
  return (
    <Link className="page-back-link" to={to}>
      <span aria-hidden="true">←</span> Quay lại
    </Link>
  )
}
