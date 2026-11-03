/**
 * Carrega e atualiza os produtos usando o serviço configurado do aplicativo.
 * Não recebe parâmetros e expõe produtos, estado de carregamento e atualização.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Product } from '@/types/product'
import { loadProducts } from '@/services/catalogCache'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const refresh = useCallback(() => {
    return loadProducts(true).then((result) => {
      setProducts(result)
      setError(false)
    })
  }, [])
  useEffect(() => {
    loadProducts()
      .then(setProducts)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])
  return { products, loading, error, refresh }
}
