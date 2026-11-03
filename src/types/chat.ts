import type { Product } from './product'

export type ChatReply = { text: string; products?: Product[]; status?: 'erro' }
export type ChatCartItem = { product_id: string; quantity: number }
