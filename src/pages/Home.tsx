import { useState } from 'react'
import type { Product } from '@/types/product'
import type { CartItem } from '@/components/CartDrawer'
import { Icon } from '@/components/Icon'
import { ProductCard } from '@/components/ProductCard'
import { CartDrawer } from '@/components/CartDrawer'

export function Home({ products, navigate, openProduct, onAddToCart, cartItems, onChangeCartQuantity, onClearCart }: {
  products: Product[]
  navigate: (page: string) => void
  openProduct: (product: Product) => void
  onAddToCart: (product: Product) => void
  cartItems: CartItem[]
  onChangeCartQuantity: (product: Product, quantity: number) => void
  onClearCart: () => void
}) {
  const [cartOpen, setCartOpen] = useState(false)
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)

  return (
    <main>
      <section className="relative overflow-hidden bg-[#eef3eb]">
        <div className="hero-grid absolute inset-0 opacity-45" />
        <button
          onClick={() => setCartOpen(true)}
          className="absolute right-5 top-5 z-10 flex h-12 items-center gap-2 rounded-full bg-[#173f35] px-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#275947] lg:right-[max(calc((100vw-1120px)/2),32px)]"
          aria-label={`Abrir carrinho com ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}
        >
          <span className="relative">
            <Icon name="cart" size={20} />
            {cartCount > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#f6c453] px-1 text-[10px] font-extrabold text-[#173f35]">{cartCount}</span>}
          </span>
          <span>Carrinho</span>
        </button>
        <div className="relative mx-auto grid min-h-[590px] max-w-[1180px] items-center gap-10 px-5 pb-16 pt-24 sm:py-16 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:py-12">
          <div className="max-w-[610px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#275947]/15 bg-white/70 px-3.5 py-2 text-xs font-bold uppercase tracking-[.1em] text-[#275947] backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[#e99a36]" /> Sua compra, mais inteligente
            </div>
            <h1 className="max-w-[650px] text-[44px] font-extrabold leading-[.98] tracking-[-.055em] text-[#173f35] sm:text-[60px] lg:text-[72px]">
              Encontre. Entenda. <span className="font-serif italic font-medium text-[#e99a36]">Escolha melhor.</span>
            </h1>
            <p className="mt-7 max-w-[540px] text-base leading-7 text-[#56635e] sm:text-lg">
              Escaneie o QR Code na prateleira e acesse preço, informações nutricionais e a localização exata de cada produto.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => navigate('scan')} className="primary-button"><Icon name="scan" size={20} /> Escanear um produto</button>
              <button onClick={() => navigate('catalog')} className="secondary-button">Explorar catálogo <Icon name="arrow" size={18} /></button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-[#52625c]">
              <span className="flex items-center gap-2"><Icon name="check" size={17} className="text-[#d4872b]" /> Sem baixar aplicativo</span>
              <span className="flex items-center gap-2"><Icon name="check" size={17} className="text-[#d4872b]" /> Informação em segundos</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[510px] lg:ml-auto">
            <div className="absolute -left-6 top-14 h-40 w-40 rounded-full bg-[#f6c453]/50 blur-2xl" />
            <div className="phone-card relative mx-auto w-[82%] max-w-[350px] rotate-[2deg] rounded-[38px] border-[8px] border-[#173f35] bg-white p-3 shadow-[0_32px_80px_rgba(23,63,53,.23)]">
              <div className="mx-auto mb-3 h-5 w-24 rounded-b-xl bg-[#173f35]" />
              <img src={products[0].image} alt="Leite integral na página do SmartMarket" className="aspect-[1.08] w-full rounded-[22px] object-cover" />
              <div className="px-2 pb-4 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#7b837f]">Fazenda Clara</p>
                <p className="mt-1 text-xl font-extrabold tracking-[-.03em] text-[#173f35]">Leite Integral</p>
                <p className="mt-1 text-2xl font-extrabold text-[#173f35]">R$ 5,49</p>
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#eef3eb] p-3 text-[#275947]">
                  <Icon name="pin" size={19} /><div><p className="text-[10px] font-bold uppercase tracking-wider">Encontre em</p><p className="text-xs font-extrabold">Corredor 04 · Gôndola B</p></div>
                </div>
              </div>
            </div>
            <div className="float-card absolute -left-1 bottom-14 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl sm:left-0">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fdf1d2] text-[#c87920]"><Icon name="qr" /></span>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#8a8e8b]">Leitura concluída</p><p className="text-sm font-extrabold text-[#173f35]">Produto encontrado</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 py-20 lg:px-8 lg:py-28">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div><p className="eyebrow">Destaques da loja</p><h2 className="section-title">Escolhas para hoje</h2></div>
          <button onClick={() => navigate('catalog')} className="hidden items-center gap-2 text-sm font-bold text-[#275947] sm:flex">Ver todo o catálogo <Icon name="arrow" size={17} /></button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} onOpen={() => openProduct(product)} onAddToCart={() => onAddToCart(product)} />)}</div>
      </section>

      <section className="bg-[#173f35] text-white">
        <div className="mx-auto max-w-[1180px] px-5 py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div><p className="eyebrow !text-[#f6c453]">Como funciona</p><h2 className="mt-3 text-4xl font-extrabold tracking-[-.045em] sm:text-5xl">Da prateleira à informação em três passos.</h2></div>
            <div className="grid gap-5 sm:grid-cols-3">
              {[['01', 'Encontre o código', 'Localize o QR Code junto ao produto ou na etiqueta da prateleira.'], ['02', 'Aponte a câmera', 'Use a câmera do seu smartphone. Nenhum aplicativo é necessário.'], ['03', 'Decida melhor', 'Veja preço, composição, alertas e onde encontrar o produto.']].map(([number, title, body]) => (
                <div key={number} className="border-t border-white/20 pt-5"><span className="font-serif text-3xl italic text-[#f6c453]">{number}</span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{body}</p></div>
              ))}
            </div>
          </div>
        </div>
      </section>
      {cartOpen && (
        <CartDrawer
          items={cartItems}
          onClose={() => setCartOpen(false)}
          onChangeQuantity={onChangeCartQuantity}
          onClear={onClearCart}
          onBrowse={() => {
            setCartOpen(false)
            navigate('catalog')
          }}
        />
      )}
    </main>
  )
}
