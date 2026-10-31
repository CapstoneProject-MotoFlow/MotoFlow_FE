/**
 * File: modules/auth/services/authService.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Gọi API login, logout, refresh/restore session và change-password; cập nhật token dùng cho request.
 */
import axiosClient, { refreshSession } from '../../../shared/api/axiosClient'
import {
  clearAccessToken,
  setAccessToken,
} from '../../../shared/api/accessToken'
import type { LoginResponse } from '../../../shared/types/auth'

export async function login(username: string, password: string) {
  const response = await axiosClient.post<LoginResponse>('/auth/login', {
    username: username.trim(),
    password,
  })
  setAccessToken(response.data.accessToken)
  return response.data.user
}

export async function logout() {
  try {
    await axiosClient.post('/auth/logout')
  } finally {
    clearAccessToken()
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  await axiosClient.post<void>('/auth/change-password', {
    currentPassword,
    newPassword,
  })
}

export async function restoreSession() {
  return (await refreshSession()).user
}
