import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'

export default function RequirePasswordChange({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return user?.mustChangePassword ? children : <Navigate to="/dashboard" replace />
}
