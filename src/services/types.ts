/**
 * Define o contrato de consulta de produtos para os serviços HTTP e mock.
 * Recebe filtros opcionais ou um ID e retorna produtos do catálogo.
 */
import type { Product } from '@/types/product'

export interface ProductService {
  list(params?: { category?: string; q?: string }): Promise<Product[]>
  get(id: string): Promise<Product>
}
