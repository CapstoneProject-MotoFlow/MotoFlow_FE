import axiosClient from '../../../shared/api/axiosClient'

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  await axiosClient.post<void>('/auth/change-password', {
    currentPassword,
    newPassword,
  })
}
