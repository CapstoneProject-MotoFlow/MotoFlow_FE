import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import FormDialog from '../../shared/ui/FormDialog'
import PageHeader from '../../shared/ui/PageHeader'
import { formatDateTime } from '../../shared/utils/format'
import { inventoryError, useInventoryData } from '../inventory/api'
import AdjustmentEffects from './AdjustmentEffects'
import {
  Card,
  EvidenceList,
  Facts,
  History,
  Result,
  Status,
} from './DocumentUi'
import {
  adjustmentStatuses,
  adjustmentTypes,
  documentPath,
  isDocumentType,
  validId,
} from './model'
import type { AdjustmentDetail } from './types'

const decisions = {
  approve: {
    label: 'Duyệt',
    title: 'Duyệt yêu cầu',
    description:
      'Khi duyệt, hệ thống áp dụng điều chỉnh vào ngày ghi sổ trong kỳ đang mở.',
  },
  reject: {
    label: 'Từ chối',
    title: 'Từ chối yêu cầu',
    description: 'Lý do từ chối sẽ được gửi cho người đề nghị.',
  },
  apply: {
    label: 'Áp dụng lại',
    title: 'Áp dụng lại yêu cầu',
    description:
      'Hệ thống kiểm tra lại dữ liệu và kỳ đang mở trước khi ghi sổ.',
  },
  withdraw: {
    label: 'Rút yêu cầu',
    title: 'Rút yêu cầu',
    description: 'Sau khi rút, yêu cầu sẽ rời hàng đợi chờ duyệt.',
  },
}

type Decision = keyof typeof decisions

function AdjustmentReview({
  data,
  path,
  onUpdate,
  onReload,
}: {
  data: AdjustmentDetail
  path: string
  onUpdate: (data: AdjustmentDetail) => void
  onReload: (message: string) => void
}) {
  const { user } = useAuth()
  const owner = user?.role === 'OWNER'
  const [decision, setDecision] = useState<Decision>()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const modal = decision && decisions[decision]
  const sourceType =
    data.source?.type === 'GOODS_RECEIPT_NOTE'
      ? 'GOODS_RECEIPT'
      : data.source?.type
  const source =
    data.source &&
    (isDocumentType(sourceType) ? (
      <Link to={documentPath(sourceType, data.source.id)}>
        {data.source.number}
      </Link>
    ) : (
      data.source.number
    ))
  const actions: [Decision, boolean][] = [
    ['reject', owner && data.actions.canReject],
    ['approve', owner && data.actions.canApprove],
    ['apply', owner && data.actions.canApply],
    ['withdraw', data.actions.canWithdraw],
  ]

  function open(action: Decision) {
    setReason('')
    setError('')
    setDecision(action)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !decision ||
      busy ||
      !actions.some(([action, allowed]) => action === decision && allowed)
    )
      return
    if (decision === 'reject' && !reason.trim()) {
      setError('Vui lòng nhập lý do từ chối.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { data: next } = await axiosClient.post<AdjustmentDetail>(
        path + '/' + decision,
        decision === 'reject' ? { reason: reason.trim() } : undefined,
      )
      onUpdate(next)
      setDecision(undefined)
    } catch (failure) {
      const message = inventoryError(failure)
      if (decision === 'reject') setError(message)
      else onReload(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="docs-split">
        <div className="docs-stack">
          <Card
            title={
              <>
                {data.number}{' '}
                <Status
                  value={data.status}
                  label={adjustmentStatuses[data.status] ?? data.status}
                />
              </>
            }
            actions={
              <div className="docs-actions">
                {actions
                  .filter(([, allowed]) => allowed)
                  .map(([action]) => (
                    <button
                      type="button"
                      key={action}
                      className={
                        action === 'approve' || action === 'apply'
                          ? 'mf-btn mf-btn--primary'
                          : 'mf-btn mf-btn--secondary'
                      }
                      onClick={() => open(action)}
                    >
                      {decisions[action].label}
                    </button>
                  ))}
              </div>
            }
          >
            {data.status === 'PENDING' && !owner && (
              <p className="docs-note">
                Đang chờ Owner duyệt từ {formatDateTime(data.submittedAt)}.
              </p>
            )}
            {data.appliedAt && (
              <p className="docs-note">
                Đã ghi điều chỉnh vào ngày {formatDateTime(data.appliedAt)}.
              </p>
            )}
            {data.decisionReason && (
              <p className="docs-note">
                Lý do quyết định: {data.decisionReason}
              </p>
            )}
            <Facts
              items={[
                [
                  'Loại yêu cầu',
                  adjustmentTypes[data.adjustmentType] ?? data.adjustmentType,
                ],
                ['Cửa hàng', data.storeName],
                ['Người đề nghị', data.requestedBy?.fullName],
                [
                  'Ngày gửi',
                  data.submittedAt && formatDateTime(data.submittedAt),
                ],
                ['Chứng từ gốc', source],
                ['Mô tả sự việc', data.reason],
              ]}
            />
          </Card>
          <Card
            title={
              data.appliedAt ? 'Nội dung đã điều chỉnh' : 'Ảnh hưởng dự kiến'
            }
          >
            <AdjustmentEffects data={data} />
          </Card>
          <Card title="Chứng cứ">
            <EvidenceList files={data.evidence} />
          </Card>
        </div>
        <div>
          <Card title="Lịch sử">
            <History items={data.history} />
          </Card>
        </div>
      </div>
      {modal && (
        <FormDialog
          title={modal.title + ' ' + data.number}
          formId="adjustment-decision"
          submitLabel={modal.label}
          onClose={() => setDecision(undefined)}
          busy={busy}
          submitDisabled={decision === 'reject' && !reason.trim()}
        >
          <form
            id="adjustment-decision"
            onSubmit={submit}
            className="docs-form"
          >
            <p>{modal.description}</p>
            <Facts
              items={[
                ['Cửa hàng', data.storeName],
                ['Người đề nghị', data.requestedBy?.fullName],
                ['Chứng từ gốc', source],
                [
                  'Ngày ghi sổ dự kiến',
                  (decision === 'approve' || decision === 'apply') &&
                  data.postingDate
                    ? formatDateTime(data.postingDate)
                    : null,
                ],
                ['Lý do', data.reason],
              ]}
            />
            {(decision === 'approve' || decision === 'apply') && (
              <>
                <AdjustmentEffects data={data} />
                <EvidenceList files={data.evidence} />
              </>
            )}
            {decision === 'reject' && (
              <label>
                Lý do từ chối
                <textarea
                  required
                  maxLength={255}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="docs-alert">
                {error}
              </p>
            )}
          </form>
        </FormDialog>
      )}
    </>
  )
}

export default function AdjustmentDetailPage() {
  const { id } = useParams()
  const valid = validId(id)
  const path = '/adjustment-requests/' + id
  const [reload, setReload] = useState<{
    id?: string
    message: string
    revision: number
  }>()
  const request = useInventoryData<AdjustmentDetail>(
    path,
    {},
    reload?.revision ?? 0,
    valid,
  )
  const data = request.data
  return (
    <div className="docs-page">
      <PageHeader
        title={
          data
            ? 'Yêu cầu điều chỉnh ' + data.number
            : 'Chi tiết yêu cầu điều chỉnh'
        }
      />
      {reload?.id === id && reload?.message && (
        <p className="docs-alert" role="alert">
          {reload.message}
        </p>
      )}
      <Result request={request} empty="Yêu cầu điều chỉnh không hợp lệ.">
        {(detail) => (
          <AdjustmentReview
            key={id}
            data={detail}
            path={path}
            onUpdate={(next) => {
              setReload((previous) => previous && { ...previous, message: '' })
              request.updateData(() => next)
            }}
            onReload={(message) =>
              setReload((previous) => ({
                id,
                message,
                revision: (previous?.revision ?? 0) + 1,
              }))
            }
          />
        )}
      </Result>
    </div>
  )
}
