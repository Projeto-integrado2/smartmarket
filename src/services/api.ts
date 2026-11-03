/**
 * Coordena os serviços de produtos e as chamadas HTTP/mock do aplicativo.
 * Recebe filtros, IDs ou mensagens e retorna os dados normalizados da API.
 */
import type { Product } from '@/types/product'
import type { ChatCartItem, ChatReply } from '@/types/chat'
import type { ChatRequest, ChatResponse } from '@/types/api'
import type { SimulatedOrder, SimulatedOrderRequest } from '@/types/orders'
import type { ProductService } from '@/services/types'
import { mockProducts } from '@/data/mockProducts'
import { demoProductCategories } from '@/data/categories'
import { mockAnswer } from '@/services/mockChat'

// Sem VITE_API_URL o app usa dados mockados (modo demonstração).
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export type { ChatCartItem, ChatReply } from '@/types/chat'
export type AdminProductList = { products: Product[]; low_stock_threshold: number }

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
    throw new Error(body?.error ?? `Erro ${response.status} em ${path}`)
  }
  return response.json() as Promise<T>
}

export function isApiConfigured(): boolean {
  return Boolean(API_URL)
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

export async function placeSimulatedOrder(order: SimulatedOrderRequest): Promise<SimulatedOrder> {
  if (API_URL) {
    return request<SimulatedOrder>('/api/orders/simulated', {
      method: 'POST',
      body: JSON.stringify(order),
    })
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
