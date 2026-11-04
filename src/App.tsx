import { useEffect, useRef, useState } from 'react'
import type { Product } from '@/types/product'
import { productService } from '@/services/api'
import { getProductIdFromQr } from '@/utils/productQr'
import { useTheme } from '@/hooks/useTheme'
import { useCart } from '@/hooks/useCart'
import { useProducts } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Chatbot } from '@/components/Chatbot'
import { Home } from '@/pages/Home'
import { Catalog } from '@/pages/Catalog'
import { ProductPage } from '@/pages/ProductPage'
import { Scanner } from '@/pages/Scanner'
import { Admin } from '@/pages/Admin'
import { Icon } from '@/components/Icon'
import { CartDrawer } from '@/components/CartDrawer'
import { Checkout } from '@/pages/Checkout'
import type { SimulatedOrder } from '@/types/orders'
import type { AuthSession } from '@/types/auth'
import { AccountDialog } from '@/components/AccountDialog'
import { deleteCustomerAccount, fetchClubSettings, fetchRepurchaseProducts } from '@/services/api'

export default function App() {
  const [initialProductId] = useState(() => getProductIdFromQr(window.location.href))
  const [page, setPage] = useState(initialProductId ? 'product' : 'home')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productLoading, setProductLoading] = useState(Boolean(initialProductId))
  const [productError, setProductError] = useState('')
  const productRequestId = useRef(0)
  const [productRequest, setProductRequest] = useState<{ id: string; requestId: number } | null>(
    initialProductId ? { id: initialProductId, requestId: 0 } : null,
  )
  const [query, setQuery] = useState('')
  const { items: cartItems, add: addToCart, changeQuantity: changeCartQuantity, clear: clearCart } = useCart()
  const { dark, toggleDark } = useTheme()
  const [cartNotice, setCartNotice] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutReturnPage, setCheckoutReturnPage] = useState('home')
  const [authSession, setAuthSession] = useState<AuthSession | null>(null)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [clubDiscountPercent, setClubDiscountPercent] = useState<number | null>(null)
  const [clubSettingsError, setClubSettingsError] = useState('')
  const [repurchaseProducts, setRepurchaseProducts] = useState<Product[]>([])
  const [repurchaseError, setRepurchaseError] = useState('')
  const cartNoticeTimer = useRef<number | null>(null)
  const { products, loading, error, refresh: refreshProducts } = useProducts()
  const { categories, loading: categoriesLoading, error: categoriesError } = useCategories()

  useEffect(() => {
    let active = true
    fetchClubSettings()
      .then(({ club_discount_percent }) => {
        if (active) setClubDiscountPercent(club_discount_percent)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setClubSettingsError(reason instanceof Error ? reason.message : 'Não foi possível carregar o desconto Clube.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!authSession || authSession.user.role !== 'customer') {
      setRepurchaseProducts([])
      setRepurchaseError('')
      return
    }
    let active = true
    fetchRepurchaseProducts(authSession.token)
      .then(({ products: recent }) => {
        if (active) setRepurchaseProducts(recent)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setRepurchaseError(reason instanceof Error ? reason.message : 'Não foi possível carregar compras anteriores.')
      })
    return () => { active = false }
  }, [authSession])

  useEffect(() => () => {
    if (cartNoticeTimer.current !== null) window.clearTimeout(cartNoticeTimer.current)
  }, [])

  const handleAddToCart = (product: Product) => {
    const currentQuantity = cartItems.find((item) => item.product.id === product.id)?.quantity ?? 0
    const message = currentQuantity >= product.stock
      ? `Você já adicionou todo o estoque disponível de ${product.name}.`
      : `${product.name} adicionado ao carrinho.`
    if (currentQuantity < product.stock) addToCart(product)
    setCartNotice(message)
    if (cartNoticeTimer.current !== null) window.clearTimeout(cartNoticeTimer.current)
    cartNoticeTimer.current = window.setTimeout(() => setCartNotice(''), 2600)
  }
  useEffect(() => {
    if (!productRequest) return
    let active = true
    setProductLoading(true)
    setProductError('')
    productService.get(productRequest.id)
      .then((product) => {
        if (active) setSelectedProduct(product)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setSelectedProduct(null)
        setProductError(reason instanceof Error ? reason.message : 'Não foi possível carregar este produto.')
      })
      .finally(() => {
        if (active) setProductLoading(false)
      })
    return () => { active = false }
  }, [productRequest])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const productId = getProductIdFromQr(window.location.href)
      if (productId) {
        setPage('product')
        setSelectedProduct(null)
        setProductLoading(true)
        setProductError('')
        setProductRequest({ id: productId, requestId: ++productRequestId.current })
        return
      }

      setPage(typeof event.state?.page === 'string' ? event.state.page : 'home')
      setSelectedProduct(null)
      setProductRequest(null)
      setProductLoading(false)
      setProductError('')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (next: string) => {
    const url = new URL(window.location.href)
    url.searchParams.delete('produto')
    window.history.pushState({ page: next }, '', `${url.pathname}${url.search}${url.hash}`)
    productRequestId.current += 1
    setPage(next)
    setSelectedProduct(null)
    setProductRequest(null)
    setProductLoading(false)
    setProductError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openProductById = (id: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('produto', id)
    window.history.pushState({ page: 'product', productId: id }, '', `${url.pathname}${url.search}${url.hash}`)
    setPage('product')
    setSelectedProduct(null)
    setProductLoading(true)
    setProductError('')
    setProductRequest({ id, requestId: ++productRequestId.current })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openProduct = (product: Product) => openProductById(product.id)
  const openCheckout = () => {
    if (cartItems.length === 0) return
    setCheckoutReturnPage(page)
    const url = new URL(window.location.href)
    url.searchParams.delete('produto')
    window.history.pushState({ page: 'checkout' }, '', `${url.pathname}${url.search}${url.hash}`)
    setCartOpen(false)
    setPage('checkout')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const backToCart = () => {
    const url = new URL(window.location.href)
    window.history.pushState(
      { page: checkoutReturnPage },
      '',
      `${url.pathname}${url.search}${url.hash}`,
    )
    setPage(checkoutReturnPage)
    setCartOpen(true)
  }
  const handleOrderComplete = (_order: SimulatedOrder) => {
    clearCart()
    setCartNotice('')
    void refreshProducts().catch(() => {
      setCartNotice('Compra simulada registrada; não foi possível atualizar o catálogo. Recarregue a página.')
    })
    if (authSession?.user.role === 'customer') {
      void fetchRepurchaseProducts(authSession.token)
        .then(({ products: recent }) => {
          setRepurchaseProducts(recent)
          setRepurchaseError('')
        })
        .catch((reason: unknown) => {
          setRepurchaseError(reason instanceof Error ? reason.message : 'Não foi possível carregar compras anteriores.')
        })
    }
  }
  const refreshClubSettings = async () => {
    try {
      const settings = await fetchClubSettings()
      setClubDiscountPercent(settings.club_discount_percent)
      setClubSettingsError('')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível carregar o desconto Clube.'
      setClubSettingsError(message)
      throw reason
    }
  }
  const onSearch = (value: string) => { setQuery(value); navigate('catalog') }
  const catalogReady = !loading && !categoriesLoading && !error && !categoriesError
  return (
    <div className="min-h-screen bg-[#fbfaf6] text-[#24332e]">
      <Header
        navigate={navigate}
        onSearch={onSearch}
        dark={dark}
        toggleDark={toggleDark}
        cartCount={cartItems.reduce((total, item) => total + item.quantity, 0)}
        openCart={() => setCartOpen(true)}
        user={authSession?.user ?? null}
        onOpenAccount={() => setAccountDialogOpen(true)}
        onSignOut={() => {
          setAuthSession(null)
          if (page === 'admin') navigate('home')
        }}
        onDeleteAccount={() => {
          if (!authSession || authSession.user.role !== 'customer') return
          const confirmed = window.confirm('Excluir sua conta? Seu perfil será apagado e o histórico de pedidos deixará de ficar vinculado ao CPF.')
          if (!confirmed) return
          void deleteCustomerAccount(authSession.token)
            .then(() => {
              setAuthSession(null)
              setCartNotice('Conta excluída; o histórico foi desvinculado do cadastro.')
            })
            .catch((reason: unknown) => {
              setCartNotice(reason instanceof Error ? reason.message : 'Não foi possível excluir a conta.')
            })
        }}
      />
      <AccountDialog
        open={accountDialogOpen}
        onClose={() => setAccountDialogOpen(false)}
        onAuthenticated={setAuthSession}
      />
      {cartNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-5 z-[70] flex max-w-[calc(100vw-40px)] items-center gap-3 rounded-2xl bg-[#173f35] px-4 py-3 text-sm font-bold text-white shadow-2xl"
        >
          <Icon name={cartNotice.includes('adicionado') ? 'check' : 'alert'} className="shrink-0 text-[#f6c453]" />
          <span>{cartNotice}</span>
        </div>
      )}
      {page !== 'product' && (loading || categoriesLoading) && <p className="py-32 text-center text-[#68746f]">Carregando catálogo...</p>}
      {page !== 'product' && (error || categoriesError) && <p className="py-32 text-center text-[#68746f]">Não foi possível carregar o catálogo. Verifique se a API está no ar.</p>}
      {page === 'product' && productLoading && <p className="py-32 text-center text-[#68746f]">Carregando produto...</p>}
      {page === 'product' && productError && <main className="mx-auto min-h-[65vh] max-w-[680px] px-5 py-24 text-center"><p role="alert" className="text-sm text-[#68746f]">{productError}</p><button onClick={() => navigate('catalog')} className="primary-button mt-6">Voltar ao catálogo</button></main>}
      {page === 'product' && selectedProduct && <ProductPage product={selectedProduct} products={products} back={() => navigate('catalog')} openProduct={openProduct} onAddToCart={handleAddToCart} />}
      {cartOpen && (
        <CartDrawer
          items={cartItems}
          onClose={() => setCartOpen(false)}
          onChangeQuantity={changeCartQuantity}
          onClear={clearCart}
          onBrowse={() => {
            setCartOpen(false)
            navigate('catalog')
          }}
          onCheckout={openCheckout}
        />
      )}
      {page === 'checkout' && (
        <Checkout
          items={cartItems}
          user={authSession?.user ?? null}
          token={authSession?.token}
          clubDiscountPercent={clubDiscountPercent}
          clubSettingsError={clubSettingsError}
          onRequestAuth={() => setAccountDialogOpen(true)}
          onBackToCart={backToCart}
          onContinueShopping={() => navigate('catalog')}
          onOrderComplete={handleOrderComplete}
        />
      )}
      {catalogReady && page !== 'product' && <>
      {page === 'home' && (
        <Home
          products={products}
          repurchaseProducts={repurchaseProducts}
          repurchaseError={repurchaseError}
          navigate={navigate}
          openProduct={openProduct}
          onAddToCart={handleAddToCart}
        />
      )}
      {page === 'catalog' && <Catalog products={products} categories={categories} query={query} onQueryChange={setQuery} openProduct={openProduct} onAddToCart={handleAddToCart} />}
      {page === 'scan' && <Scanner navigate={navigate} openProductById={openProductById} />}
      {page === 'admin' && <Admin
        token={authSession?.token ?? null}
        user={authSession?.user ?? null}
        categories={categories}
        openProduct={openProduct}
        onProductsChanged={refreshProducts}
        onClubSettingsChanged={refreshClubSettings}
        onRequestAuth={() => setAccountDialogOpen(true)}
        onSignOut={() => {
          setAuthSession(null)
          navigate('home')
        }}
      />}
      </>}
      <Footer navigate={navigate} />
      <Chatbot openProduct={openProduct} cartItems={cartItems} />
    </div>
  )
}
