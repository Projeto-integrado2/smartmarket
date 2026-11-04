/**
 * Coordena os serviços de produtos e as chamadas HTTP/mock do aplicativo.
 * Recebe filtros, IDs ou mensagens e retorna os dados normalizados da API.
 */
import type { Product } from '@/types/product'
import type { ChatCartItem, ChatReply } from '@/types/chat'
import type { ChatRequest, ChatResponse } from '@/types/api'
import type { SimulatedOrder, SimulatedOrderRequest } from '@/types/orders'
import type { AuthSession, AuthUser, BranchAvailability } from '@/types/auth'
import type { ProductService } from '@/services/types'
import { mockProducts } from '@/data/mockProducts'
import { demoProductCategories } from '@/data/categories'
import { mockAnswer } from '@/services/mockChat'

// Sem VITE_API_URL o app usa dados mockados (modo demonstração).
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export type { ChatCartItem, ChatReply } from '@/types/chat'
export type AdminProductList = { products: Product[]; low_stock_threshold: number }
export type AdminStaff = { id: number; name: string; cpf: string; is_active: boolean }
export type ClubSettings = { club_discount_percent: number }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export type AdminProductInput = Omit<Product, 'id' | 'is_active'> & {
  location: { sector: string; aisle: string; shelf: string }
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  if (!API_URL) throw new Error('Configure VITE_API_URL para usar o painel administrativo.')
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new ApiError(body?.error ?? `Erro ${response.status} em ${path}`, response.status)
  }
  return response.json() as Promise<T>
}

export function isApiConfigured(): boolean {
  return Boolean(API_URL)
}

export async function lookupAccount(cpf: string): Promise<boolean> {
  try {
    await request<{ requires_pin: boolean }>('/api/auth/lookup', {
      method: 'POST',
      body: JSON.stringify({ cpf }),
    })
    return true
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 404) return false
    throw reason
  }
}

export function loginWithCpf(cpf: string, pin: string): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ cpf, pin }),
  })
}

export function registerCustomer(input: {
  cpf: string
  name: string
  age: number
  address: string
  pin: string
}): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteCustomerAccount(token: string): Promise<{ status: 'deleted' }> {
  return request('/api/auth/me', { method: 'DELETE' }, token)
}

export function fetchClubSettings(): Promise<ClubSettings> {
  if (!API_URL) return Promise.resolve({ club_discount_percent: 10 })
  return request<ClubSettings>('/api/settings/club')
}

export function fetchAdminClubSettings(token: string): Promise<ClubSettings> {
  return request<ClubSettings>('/api/admin/settings', undefined, token)
}

export function updateAdminClubSettings(token: string, club_discount_percent: number): Promise<ClubSettings> {
  return request<ClubSettings>('/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify({ club_discount_percent }),
  }, token)
}

export function fetchAdminStaff(token: string): Promise<{ staff: AdminStaff[] }> {
  return request('/api/admin/staff', undefined, token)
}

export function createAdminStaff(token: string, input: { cpf: string; name: string; pin: string }): Promise<AdminStaff> {
  return request('/api/admin/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  }, token)
}

export function deactivateAdminStaff(token: string, staffId: number): Promise<void> {
  return request<void>(`/api/admin/staff/${staffId}`, { method: 'DELETE' }, token)
}

export function restoreAdminStaff(token: string, staffId: number): Promise<void> {
  return request<void>(`/api/admin/staff/${staffId}/restore`, { method: 'POST' }, token)
}

export function fetchNearbyBranches(productId: string): Promise<{ demo: boolean; branches: BranchAvailability[] }> {
  if (!API_URL) {
    return Promise.resolve({
      demo: true,
      branches: [
        { name: 'Filial Centro (simulada)', distance_km: 1.2, address: 'Endereço demonstrativo — Centro', stock: 3 },
        { name: 'Filial Norte (simulada)', distance_km: 3.8, address: 'Endereço demonstrativo — Zona Norte', stock: 4 },
        { name: 'Filial Sul (simulada)', distance_km: 5.4, address: 'Endereço demonstrativo — Zona Sul', stock: 5 },
      ],
    })
  }
  return request<{ demo: boolean; branches: BranchAvailability[] }>(`/api/branches/${encodeURIComponent(productId)}`)
}

export function fetchRepurchaseProducts(token: string): Promise<{ products: Product[] }> {
  return request('/api/orders/rebuy', undefined, token)
}

export function adminLogin(username: string, password: string): Promise<{ token: string; expires_in: number; username: string }> {
  return request('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function validateAdminToken(token: string): Promise<{ username: string }> {
  return request('/api/admin/auth/me', undefined, token)
}

export function fetchAdminProducts(token: string, includeArchived: boolean): Promise<AdminProductList> {
  const query = includeArchived ? '?include_archived=true' : ''
  return request(`/api/admin/products${query}`, undefined, token)
}

export function saveAdminProduct(token: string, product: AdminProductInput, id?: string): Promise<Product> {
  return request(id ? `/api/admin/products/${encodeURIComponent(id)}` : '/api/admin/products', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(product),
  }, token)
}

export function updateAdminStock(token: string, id: string, stock: number): Promise<Product> {
  return request(`/api/admin/products/${encodeURIComponent(id)}/stock`, {
    method: 'PATCH',
    body: JSON.stringify({ stock }),
  }, token)
}

export function setProductArchived(token: string, id: string, archived: boolean): Promise<Product> {
  return request(`/api/admin/products/${encodeURIComponent(id)}/${archived ? 'archive' : 'restore'}`, {
    method: 'POST',
  }, token)
}

export async function placeSimulatedOrder(order: SimulatedOrderRequest, token?: string): Promise<SimulatedOrder> {
  if (API_URL) {
    return request<SimulatedOrder>('/api/orders/simulated', {
      method: 'POST',
      body: JSON.stringify(order),
    }, token)
  }

  const quantities = new Map<string, number>()
  for (const item of order.items) {
    quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity)
  }

  const products = [...quantities.entries()].map(([id, quantity]) => {
    const product = mockProducts.find((item) => item.id === id)
    if (!product || product.stock < quantity) {
      throw new Error(`Estoque insuficiente para ${product?.name ?? 'um produto'}. Atualize o carrinho.`)
    }
    return { product, quantity }
  })

  const items = products.map(({ product, quantity }) => ({
    product_id: product.id,
    name: product.name,
    quantity,
    unit: product.unit,
    unit_price: product.price,
    discounted_unit_price: product.price,
    discount_percent: 0,
    original_line_total: Number((product.price * quantity).toFixed(2)),
    line_total: Number((product.price * quantity).toFixed(2)),
  }))
  const subtotal = Number(items.reduce((total, item) => total + item.line_total, 0).toFixed(2))

  products.forEach(({ product, quantity }) => {
    product.stock -= quantity
  })

  return {
    order_id: `SM-SIM-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
    status: 'simulated',
    payment_method: order.payment_method,
    subtotal,
    original_subtotal: subtotal,
    discount_total: 0,
    delivery_requested: order.delivery_requested ?? false,
    items,
  }
}

const mockProductService: ProductService = {
  list(params) {
    const category = params?.category
    const term = params?.q?.trim().toLowerCase() ?? ''
    if ((!category || category === 'Todos') && !term) {
      return Promise.resolve(mockProducts)
    }

    return Promise.resolve(mockProducts.filter((product) => {
      const matchesCategory = !category || category === 'Todos' || product.categories.includes(category)
      const matchesTerm = !term || `${product.name} ${product.brand} ${product.categories.join(' ')}`.toLowerCase().includes(term)
      return matchesCategory && matchesTerm
    }))
  },
  get(id) {
    const product = mockProducts.find((item) => item.id === id)
    if (!product) return Promise.reject(new Error('Produto não encontrado'))
    return Promise.resolve(product)
  },
}

const httpProductService: ProductService = {
  list(params) {
    const query = new URLSearchParams()
    if (params?.category) query.set('category', params.category)
    if (params?.q !== undefined) query.set('q', params.q)
    const suffix = query.toString()
    return request<Product[]>(`/api/products${suffix ? `?${suffix}` : ''}`)
  },
  get(id) {
    return request<Product>(`/api/products/${encodeURIComponent(id)}`)
  },
}

export const productService: ProductService = API_URL ? httpProductService : mockProductService

export function fetchCategories(): Promise<string[]> {
  if (!API_URL) return Promise.resolve([...demoProductCategories])
  return request<string[]>('/api/categories')
}

export async function sendChatMessage(message: string, cart: ChatCartItem[] = []): Promise<ChatReply> {
  if (!API_URL) return mockAnswer(message, cart)
  const payload: ChatRequest = { message, cart, session_id: getChatSessionId() }
  const response = await fetch(`${API_URL}/api/chat`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const reply = await response.json() as ChatResponse
  if ('status' in reply && reply.status === 'erro' && 'mensagem' in reply && reply.mensagem) {
    return { text: reply.mensagem, status: 'erro' }
  }
  if (!response.ok) throw new Error(`Erro ${response.status} em /api/chat`)
  if (!('text' in reply)) return { text: '', products: [] }
  return {
    text: reply.text ?? '',
    products: reply.products ?? (reply.product ? [reply.product] : []),
  }
}

function getChatSessionId(): string {
  const storageKey = 'smartmarket-chat-session-id'
  let sessionId = sessionStorage.getItem(storageKey)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem(storageKey, sessionId)
  }
  return sessionId
}

export const isChatDemoMode = !API_URL
