export type AuthUser = {
  id?: number
  username: string
  fullName?: string
  role?: string
  storeId?: number | null
  storeName?: string
  mustChangePassword?: boolean
}

export type LoginResponse = {
  accessToken: string
  user: AuthUser
}
