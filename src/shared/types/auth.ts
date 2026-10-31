/**
 * File: shared/types/auth.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: AuthUser và LoginResponse. Type chỉ giúp kiểm tra lúc phát triển, không tự xác minh JSON lúc chạy.
 */
export type AuthUser = {
  id?: number
  username: string
  fullName?: string
  role?: string
  storeId?: number | null
  storeName?: string
  permissions?: string[]
  mustChangePassword?: boolean
}

export type LoginResponse = {
  accessToken: string
  user: AuthUser
}
