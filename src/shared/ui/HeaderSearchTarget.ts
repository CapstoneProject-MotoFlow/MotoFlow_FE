/**
 * File: shared/ui/HeaderSearchTarget.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Context chứa phần tử đích để HeaderSearch render qua portal.
 */
import { createContext } from 'react'
export const HeaderSearchTarget = createContext<HTMLDivElement | null>(null)
