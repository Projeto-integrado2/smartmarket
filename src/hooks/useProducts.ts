import { useCallback, useEffect, useState } from 'react'
import type { Product } from '@/types/product'
import { fetchProducts } from '@/services/api'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const refresh = useCallback(() => {
    return fetchProducts()
      .then(setProducts)
  }, [])
  useEffect(() => {
    refresh()
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [refresh])
  return { products, loading, error, refresh }
}
