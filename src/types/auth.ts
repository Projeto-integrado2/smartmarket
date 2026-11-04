export type AuthUser = {
  role: 'admin' | 'customer'
  name: string
  age?: number
  address?: string
}

export type AuthSession = {
  token: string
  user: AuthUser
}

export type BranchAvailability = {
  name: string
  address: string
  distance_km: number
  stock: number
}
