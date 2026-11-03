import { useEffect, useState } from 'react'
import { loadCategories } from '@/services/catalogCache'

export function useCategories() {
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadCategories()
      .then(setCategories)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading, error }
}
