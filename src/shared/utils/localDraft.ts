/**
 * File: shared/utils/localDraft.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Lưu nháp (DRAFT) phiếu đang soạn trên trình duyệt của máy đang dùng, theo từng tài khoản.
 * BE chưa có trạng thái DRAFT cho yêu cầu nhập hàng / yêu cầu bổ sung nên nháp chỉ nằm trên máy này;
 * gửi phiếu thành công thì nháp tự xóa.
 */
import type { AuthUser } from '../types/auth'

export type SavedDraft<T> = { data: T; savedAt: string }

export function draftKey(
  name: string,
  user:
    | (Pick<AuthUser, 'username' | 'role' | 'storeId'> & { id?: number })
    | null
    | undefined,
) {
  return user
    ? `motoflow:draft:${name}:${JSON.stringify([user.id ?? user.username, user.role, user.storeId ?? null])}`
    : undefined
}

export function readDraft<T>(
  key: string | undefined,
): SavedDraft<T> | undefined {
  if (!key) return undefined
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as SavedDraft<T> | null
    return parsed && typeof parsed === 'object' && 'data' in parsed
      ? parsed
      : undefined
  } catch {
    return undefined
  }
}

export function writeDraft<T>(key: string | undefined, data: T) {
  if (!key) return undefined
  try {
    const saved: SavedDraft<T> = { data, savedAt: new Date().toISOString() }
    localStorage.setItem(key, JSON.stringify(saved))
    return saved
  } catch {
    return undefined
  }
}

export function clearDraft(key: string | undefined) {
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {
    // Trình duyệt không cho dùng bộ nhớ: không có nháp để xóa.
  }
}
