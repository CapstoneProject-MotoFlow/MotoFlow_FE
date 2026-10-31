import './layouts.css'
import { Outlet } from 'react-router-dom'
import BrandPanel from '../../shared/ui/BrandPanel'

export default function AuthLayout() {
  return (
    <main className="login-layout">
      <section className="login-pane">
        <Outlet />
      </section>
      <BrandPanel />
    </main>
  )
}
