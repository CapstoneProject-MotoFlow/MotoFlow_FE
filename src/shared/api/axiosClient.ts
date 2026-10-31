/**
 * File: shared/api/axiosClient.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Axios cấu hình /api, gửi cookie/token, gắn Authorization và xử lý 401 bằng refresh rồi thử lại request một lần. refreshClient tách riêng để không tự gọi interceptor lặp; pendingRefresh gom request trong tab, Web Locks tuần tự refresh giữa tab khi trình duyệt hỗ trợ.
 */
import axios, { type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken, setAccessToken, clearAccessToken } from './accessToken'
import type { LoginResponse } from '../types/auth'
const axiosClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})
// Separate transport avoids recursively intercepting refresh failures.
const refreshClient = axios.create({ baseURL: '/api', withCredentials: true })
let pendingRefresh: Promise<LoginResponse> | null = null
/** refreshSession: Làm mới access token qua cookie, gom request trong tab và tuần tự hóa giữa tab bằng Web Locks khi có hỗ trợ. */
export function refreshSession() {
  if (!pendingRefresh)
    pendingRefresh = Promise.resolve(
      navigator.locks
        ? navigator.locks.request('motoflow-refresh', () =>
            refreshClient.post<LoginResponse>('/auth/refresh'),
          )
        : refreshClient.post<LoginResponse>('/auth/refresh'),
    )
      .then((response) => {
        setAccessToken(response.data.accessToken)
        return response.data
      })
      .catch((error) => {
        // Network failures and server outages do not prove that the session expired.
        if (
          axios.isAxiosError(error) &&
          [401, 403].includes(error.response?.status ?? 0)
        ) {
          clearAccessToken()
          window.dispatchEvent(new Event('auth-session-expired'))
        }
        throw error
      })
      .finally(() => {
        pendingRefresh = null
      })
  return pendingRefresh
}
axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retried ||
      /\/auth\/(login|refresh|logout)(\?|$)/.test(config.url || '')
    )
      throw error
    config._retried = true
    const sent = config.headers.Authorization
    const current = getAccessToken()
    // A concurrent request may already have refreshed the token.
    const token =
      current && sent !== `Bearer ${current}`
        ? current
        : (await refreshSession()).accessToken
    config.headers.Authorization = `Bearer ${token}`
    return axiosClient(config)
  },
)
export default axiosClient
