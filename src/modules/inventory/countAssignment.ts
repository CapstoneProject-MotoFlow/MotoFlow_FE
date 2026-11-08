export type Assignment = {
  documentId: number
  canAssign: boolean
  blockedMessage: string | null
  noticeMessage: string | null
  current: { assigneeId: number; assigneeName: string } | null
  eligibleAssignees: {
    id: number
    fullName: string
    self: boolean
    openTasks: number
  }[]
  history: {
    id: number
    assigneeName: string
    assignedByName: string
    assignedAt: string
  }[]
}

export function canAssignCounter(
  data: Assignment | undefined,
  documentId: number,
  assigneeId: number | undefined,
  unavailable = false,
) {
  return (
    !unavailable &&
    Number.isSafeInteger(documentId) &&
    documentId > 0 &&
    !!data?.canAssign &&
    data.documentId === documentId &&
    Number.isSafeInteger(assigneeId) &&
    data.eligibleAssignees.some((person) => person.id === assigneeId)
  )
}
export async function submitCountAssignment(
  data: Assignment | undefined,
  documentId: number,
  assigneeId: number | undefined,
  unavailable: boolean,
  post: (payload: {
    taskType: 'COUNTING'
    documentId: number
    assigneeId: number
  }) => Promise<unknown>,
) {
  if (!canAssignCounter(data, documentId, assigneeId, unavailable))
    throw new Error(
      'Không thể giao việc với thông tin phiếu hoặc người đếm hiện tại.',
    )
  return post({ taskType: 'COUNTING', documentId, assigneeId: assigneeId! })
}
