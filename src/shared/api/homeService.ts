import type { AxiosResponse } from 'axios'
import axiosClient from './axiosClient'
import { getAccessToken } from './accessToken'
export type Home = {
  storeName: string | null
  shortcuts: { key: string; count: number }[]
  notifications: {
    unread: number
    latest: {
      id: number
      type: string
      message: string
      refType: string | null
      refId: number | null
      createdAt: string
    }[]
  } | null
}
let pending: Promise<AxiosResponse<Home>> | null = null
let session: string | null = null
let expires = 0
// Share simultaneous home lookups; retain no data across access-token changes.
export function getHome(): Promise<AxiosResponse<Home>> {
  const token = getAccessToken()
  if (!pending || token !== session || Date.now() >= expires) {
    session = token
    expires = Infinity
    const request = axiosClient.get<Home>('/home')
    pending = request
    request.then(
      () => {
        if (pending === request) expires = Date.now() + 1000
      },
      () => {
        if (pending === request) pending = null
      },
    )
  }
  return pending
}
