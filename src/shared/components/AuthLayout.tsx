import type { ReactNode } from 'react'
import BrandPanel from './BrandPanel'

type AuthLayoutProps = {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="login-layout">
      <section className="login-pane">{children}</section>
      <BrandPanel />
    </main>
  )
}
