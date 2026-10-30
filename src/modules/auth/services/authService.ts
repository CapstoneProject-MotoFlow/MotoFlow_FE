import axiosClient from '../../../shared/api/axiosClient'
import { clearAccessToken, setAccessToken } from '../../../shared/api/accessToken'
import type { LoginResponse } from '../../../shared/types/auth'

export async function login(username: string, password: string) {
  const response = await axiosClient.post<LoginResponse>('/auth/login', { username: username.trim(), password })
  setAccessToken(response.data.accessToken)
  return response.data.user
}

export async function logout() {
  try { await axiosClient.post('/auth/logout') } finally { clearAccessToken() }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await axiosClient.post<void>('/auth/change-password', { currentPassword, newPassword })
}

// Share one request across StrictMode mounts: refresh tokens rotate on use.
let restoreRequest: Promise<import('../../../shared/types/auth').AuthUser> | null = null
export function restoreSession() {
  if (!restoreRequest) {
    restoreRequest = axiosClient.post<LoginResponse>('/auth/refresh').then(response => {
      setAccessToken(response.data.accessToken)
      return response.data.user
    }).catch(error => {
      clearAccessToken()
      throw error
    }).finally(() => { restoreRequest = null })
  }
  return restoreRequest
}
