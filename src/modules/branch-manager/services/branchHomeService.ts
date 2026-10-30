import axiosClient from '../../../shared/api/axiosClient'
export type BranchHome = { storeName: string | null; shortcuts: { key: string; count: number }[] }
export async function loadBranchHome() { return (await axiosClient.get<BranchHome>('/home')).data }
