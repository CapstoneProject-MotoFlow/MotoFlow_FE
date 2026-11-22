import { Link, type To } from 'react-router-dom'
import { useBackClick } from '../hooks/useBackClick'
import Icon from './Icon'
import './page-back-link.css'

/** Quay lại trang trước trong ứng dụng; không có trang trước thì đi tới `to`. */
export default function PageBackLink({ to }: { to: To }) {
  const onClick = useBackClick()
  return (
    <Link className="page-back-link" to={to} onClick={onClick}>
      <Icon name="chevron-left" />
      Quay lại
    </Link>
  )
}
