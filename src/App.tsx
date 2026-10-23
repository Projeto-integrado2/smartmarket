import { useState } from 'react'
import type { Product } from '@/types/product'
import type { CartItem } from '@/components/CartDrawer'
import { useTheme } from '@/hooks/useTheme'
import { useProducts } from '@/hooks/useProducts'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Chatbot } from '@/components/Chatbot'
import { Home } from '@/pages/Home'
import { Catalog } from '@/pages/Catalog'
import { ProductPage } from '@/pages/ProductPage'
import { Scanner } from '@/pages/Scanner'
import { Admin } from '@/pages/Admin'

export default function App() {
  const [page, setPage] = useState('home')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [query, setQuery] = useState('')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const { dark, toggleDark } = useTheme()
  const { products, loading, error, refresh: refreshProducts } = useProducts()
  const navigate = (next: string) => { setPage(next); setSelectedProduct(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const openProduct = (product: Product) => { setSelectedProduct(product); setPage('product'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const onSearch = (value: string) => { setQuery(value); navigate('catalog') }
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return
    setCartItems((items) => {
      const existing = items.find((item) => item.product.id === product.id)
      if (!existing) return [...items, { product, quantity: 1 }]
      return items.map((item) => item.product.id === product.id
        ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
        : item)
    })
  }
  const changeCartQuantity = (product: Product, quantity: number) => {
    setCartItems((items) => quantity <= 0
      ? items.filter((item) => item.product.id !== product.id)
      : items.map((item) => item.product.id === product.id
        ? { ...item, quantity: Math.min(quantity, product.stock) }
        : item))
  }
  return (
    <div className="min-h-screen bg-[#fbfaf6] text-[#24332e]">
      <Header navigate={navigate} onSearch={onSearch} dark={dark} toggleDark={toggleDark} />
      {loading && <p className="py-32 text-center text-[#68746f]">Carregando produtos...</p>}
      {error && <p className="py-32 text-center text-[#68746f]">Não foi possível carregar os produtos. Verifique se a API está no ar.</p>}
      {!loading && !error && <>
      {page === 'home' && (
        <Home
          products={products}
          navigate={navigate}
          openProduct={openProduct}
          onAddToCart={addToCart}
          cartItems={cartItems}
          onChangeCartQuantity={changeCartQuantity}
          onClearCart={() => setCartItems([])}
        />
      )}
      {page === 'catalog' && <Catalog products={products} query={query} openProduct={openProduct} onAddToCart={addToCart} />}
      {page === 'product' && selectedProduct && <ProductPage product={selectedProduct} products={products} back={() => navigate('catalog')} openProduct={openProduct} onAddToCart={addToCart} />}
      {page === 'scan' && <Scanner products={products} navigate={navigate} openProduct={openProduct} />}
      {page === 'admin' && <Admin openProduct={openProduct} onProductsChanged={refreshProducts} />}
      </>}
      <Footer navigate={navigate} />
      <Chatbot openProduct={openProduct} cartItems={cartItems} />
    </div>
  )
}
