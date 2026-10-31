/**
 * File: modules/profile/services/profileService.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Gọi API đổi mật khẩu trong luồng hồ sơ.
 */
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
