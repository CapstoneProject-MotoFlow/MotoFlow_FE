import ReplenishmentCreatePage from './ReplenishmentCreatePage'
import TransferOrderCreatePage from './TransferOrderCreatePage'
export default function TransferCreatePage({
  replenishment = false,
}: {
  replenishment?: boolean
}) {
  return replenishment ? (
    <ReplenishmentCreatePage />
  ) : (
    <TransferOrderCreatePage />
  )
}
