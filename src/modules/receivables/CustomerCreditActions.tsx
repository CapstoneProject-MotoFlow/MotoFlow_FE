import { useState } from 'react'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import DebtDialog from './DebtDialog'
import type { DebtDetail } from './types'
export default function CustomerCreditActions({
  id,
  onSaved,
}: {
  id: string
  onSaved: () => void
}) {
  const scope = useInventoryScope(),
    [action, setAction] = useState(''),
    [revision, setRevision] = useState(0)
  const r = useInventoryData<DebtDetail>(
    `/customers/${id}/debts`,
    {},
    revision,
    scope.owner,
  )
  if (!scope.owner) return null
  return (
    <>
      <InventoryNotice error={r.error} />
      {r.data && (
        <>
          <button
            className="cp-primary"
            onClick={() =>
              setAction(
                r.data!.creditStatus === 'ELIGIBLE' ? 'revoke' : 'grant',
              )
            }
          >
            {r.data.creditStatus === 'ELIGIBLE'
              ? 'Thu hồi quyền mua chịu'
              : 'Cấp quyền mua chịu'}
          </button>
          <button className="cp-button" onClick={() => setAction('opening')}>
            Ghi nợ đầu kỳ
          </button>
          {action && (
            <DebtDialog
              action={action}
              data={r.data}
              owner
              stores={scope.stores}
              onClose={() => setAction('')}
              onSaved={() => {
                setAction('')
                setRevision((n) => n + 1)
                onSaved()
              }}
            />
          )}
        </>
      )}
    </>
  )
}
