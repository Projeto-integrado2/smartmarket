import type { Product } from '@/types/product'
import { mockProducts } from '@/data/mockProducts'

// Sem VITE_API_URL o app usa dados mockados (modo demonstração).
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export type ChatReply = { text: string; products?: Product[]; status?: 'erro' }
export type ChatCartItem = { product_id: string; quantity: number }
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

function mockAnswer(question: string, cartItems: ChatCartItem[]): ChatReply {
  const term = question.toLowerCase()
  const cart = cartItems.flatMap(({ product_id, quantity }) => {
    const product = mockProducts.find((item) => item.id === product_id)
    return product ? [{ product, quantity }] : []
  })
  const isCartQuestion = ['carrinho', 'no carrinho', 'do carrinho', 'coloquei'].some((word) => term.includes(word))
  if (isCartQuestion) {
    if (cart.length === 0) {
      return {
        text: 'Seu carrinho está vazio no momento. Para começar, você pode adicionar o Espaguete Grano Duro e o Tomate Italiano, que combinam para uma refeição simples.',
        products: mockProducts.filter((product) => ['SM-2087', 'SM-3091'].includes(product.id)),
      }
    }

    const summary = cart.map(({ product, quantity }) => `${quantity} × ${product.name}`).join(', ')
    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
    const complements = mockProducts.filter((product) =>
      !cart.some((item) => item.product.id === product.id) &&
      (product.id === 'SM-3091' || product.id === 'SM-1042'),
    ).slice(0, 2)
    const suggestions = complements.length
      ? ` Para complementar, considere ${complements.map((product) => product.name).join(' e ')}.`
      : ''
    return {
      text: `No seu carrinho há ${summary}. O subtotal demonstrativo desses itens é ${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.${suggestions}`,
      products: complements,
    }
  }

  const asksForSuggestions = ['sugest', 'recomend', 'combina', 'ideia', 'o que comprar', 'o que preparar', 'receita', 'jantar', 'almoço'].some((word) => term.includes(word))
  if (asksForSuggestions) {
    return {
      text: 'Para uma refeição simples, combine o Espaguete Grano Duro com Tomate Italiano e finalize com alho, azeite e manjericão. O espaguete contém glúten.',
      products: mockProducts.filter((product) => ['SM-2087', 'SM-3091'].includes(product.id)),
    }
  }

  if (term.includes('lactose') || term.includes('leite')) {
    return { text: 'A lactose é o açúcar natural do leite. Pessoas intolerantes podem sentir desconforto. Para acompanhar o leite, o Café Especial é uma opção do catálogo; confira os rótulos e respeite suas restrições.', products: [mockProducts[0], mockProducts[3]] }
  }
  if (term.includes('glúten') || term.includes('massa') || term.includes('espaguete')) {
    return { text: 'O Espaguete Grano Duro contém glúten e não é indicado para pessoas com doença celíaca. Para preparar um molho simples, combine-o com Tomate Italiano.', products: [mockProducts[1], mockProducts[2]] }
  }
  if (term.includes('café') || term.includes('cafeína')) {
    return { text: 'A cafeína pode afetar o sono quando consumida em excesso. O Café Especial do catálogo combina com Leite Integral; prefira consumir com moderação, especialmente no fim do dia.', products: [mockProducts[3], mockProducts[0]] }
  }
  if (term.includes('tomate')) {
    return { text: 'O Tomate Italiano pode ser usado em saladas ou em um molho rápido para acompanhar o Espaguete Grano Duro. Você também pode adicionar alho e manjericão.', products: [mockProducts[2], mockProducts[1]] }
  }
  return { text: 'Posso sugerir produtos para uma refeição, explicar informações do catálogo ou comentar o que está no seu carrinho. O que você está planejando preparar?', products: [] }
}

export function fetchProducts(): Promise<Product[]> {
  if (!API_URL) return Promise.resolve(mockProducts)
  return request<Product[]>('/api/products')
}

export async function sendChatMessage(message: string, cart: ChatCartItem[] = []): Promise<ChatReply> {
  if (!API_URL) return mockAnswer(message, cart)
  const response = await fetch(`${API_URL}/api/chat`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify({ message, cart, session_id: getChatSessionId() }),
  })
  const reply = await response.json() as {
    text?: string
    products?: Product[]
    product?: Product | null
    status?: 'erro'
    mensagem?: string
  }
  if (reply.status === 'erro' && reply.mensagem) {
    return { text: reply.mensagem, status: 'erro' }
  }
  if (!response.ok) throw new Error(`Erro ${response.status} em /api/chat`)
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
