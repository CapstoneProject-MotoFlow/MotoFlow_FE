/**
 * File: shared/api/accessToken.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Giữ/đọc/xóa access token trong bộ nhớ FE; không phải bảng database hoặc nơi lưu user.
 */
let accessToken: string | null = null

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string) {
  accessToken = token
}

export function clearAccessToken() {
  accessToken = null
}
