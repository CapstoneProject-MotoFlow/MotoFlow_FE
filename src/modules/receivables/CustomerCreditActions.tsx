import { useState } from 'react'
import { useInventoryScope } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import DebtDialog from './DebtDialog'
import type { DebtDetail } from './types'
export default function CustomerCreditActions({
  data,
  error,
  onSaved,
}: {
  data?: DebtDetail
  error?: string
  onSaved: () => void
}) {
  const scope = useInventoryScope(),
    [action, setAction] = useState('')
  if (!scope.owner) return null
  return (
    <>
      <InventoryNotice error={error} />
      {data && (
        <>
          <button
            className="cp-primary"
            onClick={() =>
              setAction(data!.creditStatus === 'ELIGIBLE' ? 'revoke' : 'grant')
            }
          >
            {data.creditStatus === 'ELIGIBLE'
              ? 'Thu hồi quyền mua chịu'
              : 'Cấp quyền mua chịu'}
          </button>
          <button className="cp-button" onClick={() => setAction('opening')}>
            Ghi nợ đầu kỳ
          </button>
          {action && (
            <DebtDialog
              action={action}
              data={data}
              owner
              stores={scope.stores}
              onClose={() => setAction('')}
              onSaved={() => {
                setAction('')
                onSaved()
              }}
            />
          )}
        </>
      )}
    </>
  )
}
