/**
 * Descreve os produtos, requisições e respostas expostos pela API Flask.
 * Recebe os formatos JSON da API e representa respostas de sucesso ou erro.
 */
import type { Product as CatalogProduct } from './product'

export type Product = Omit<CatalogProduct, 'is_active'> & { is_active: boolean }

export type ChatRequest = {
  message: string
  cart?: { product_id: string; quantity: number }[]
  session_id: string
}

export type ChatResponse =
  | { text: string; products: Product[]; product: Product | null }
  | { status: 'erro'; mensagem: string }
  | { error: string }
