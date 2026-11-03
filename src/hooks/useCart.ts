import { useState } from 'react'
import type { Product } from '@/types/product'
import type { CartItem } from '@/types/cart'

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])

  const add = (product: Product) => {
    if (product.stock <= 0) return
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (!existing) return [...current, { product, quantity: 1 }]
      return current.map((item) => item.product.id === product.id
        ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
        : item)
    })
  }

  const changeQuantity = (product: Product, quantity: number) => {
    setItems((current) => quantity <= 0
      ? current.filter((item) => item.product.id !== product.id)
      : current.map((item) => item.product.id === product.id
        ? { ...item, quantity: Math.min(quantity, product.stock) }
        : item))
  }

  const clear = () => setItems([])

  return { items, add, changeQuantity, clear }
}
