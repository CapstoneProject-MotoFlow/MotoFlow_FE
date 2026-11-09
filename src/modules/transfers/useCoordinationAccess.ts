import { useAuth } from '../../shared/hooks/useAuth'
import { useInventoryData } from '../inventory/api'
/** Availability uses the same Owner/central-BM scope as transfer coordination. */
export function useCoordinationAccess(productId: number | undefined) {
  const { user } = useAuth()
  const check = useInventoryData<unknown[]>(
    '/inventory/availability',
    { productIds: productId },
    0,
    user?.role === 'BRANCH_MANAGER' && !!productId,
  )
  return (
    user?.role === 'OWNER' || (user?.role === 'BRANCH_MANAGER' && !!check.data)
  )
}
