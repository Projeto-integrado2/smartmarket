import type { Product } from '@/types/product'
import { fetchCategories, productService } from '@/services/api'

let products: Product[] | null = null
let productsRequest: Promise<Product[]> | null = null
let categories: string[] | null = null
let categoriesRequest: Promise<string[]> | null = null

export function loadProducts(forceRefresh = false): Promise<Product[]> {
  if (!forceRefresh && products) return Promise.resolve(products)
  if (productsRequest) return productsRequest

  const request = productService.list()
    .then((result) => {
      products = result
      return result
    })
    .finally(() => {
      productsRequest = null
    })
  productsRequest = request
  return request
}

export function loadCategories(): Promise<string[]> {
  if (categories) return Promise.resolve(categories)
  if (categoriesRequest) return categoriesRequest

  const request = fetchCategories()
    .then((result) => {
      categories = result
      return result
    })
    .finally(() => {
      categoriesRequest = null
    })
  categoriesRequest = request
  return request
}
