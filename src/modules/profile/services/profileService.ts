/**
 * File: modules/profile/services/profileService.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Gọi API đổi mật khẩu và thiết bị đang đăng nhập của chính mình trong luồng hồ sơ.
 */
import axiosClient from '../../../shared/api/axiosClient'
import type { Session } from '../../../shared/types/session'

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  await axiosClient.post<void>('/auth/change-password', {
    currentPassword,
    newPassword,
  })
}

/** Các thiết bị mình đang đăng nhập, mới nhất trước; current là thiết bị này. */
export async function listMySessions() {
  return (await axiosClient.get<Session[]>('/auth/sessions')).data
}

/** Đăng xuất một thiết bị khác của mình; phiên đã kết thúc trả MSG75. */
export async function signOutMySession(sessionId: number) {
  await axiosClient.delete<void>(`/auth/sessions/${sessionId}`)
}

/** Đăng xuất mọi thiết bị khác của mình trong một lần, giữ thiết bị này. */
export async function signOutOtherSessions() {
  await axiosClient.post<void>('/auth/sessions/sign-out-others')
}
