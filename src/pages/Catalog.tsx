import { useMemo, useState } from 'react'
import type { Product } from '@/types/product'
import { Icon } from '@/components/Icon'
import { ProductCard } from '@/components/ProductCard'

export function Catalog({ products, query, openProduct, onAddToCart }: {
  products: Product[]
  query: string
  openProduct: (product: Product) => void
  onAddToCart: (product: Product) => void
}) {
  const [category, setCategory] = useState('Todos')
  const [search, setSearch] = useState(query)
  const categories = useMemo(() => ['Todos', ...Array.from(new Set(products.map((product) => product.category)))], [products])
  const filtered = useMemo(() => products.filter((product) => {
    const matchesCategory = category === 'Todos' || product.category === category
    const term = search.toLowerCase()
    return matchesCategory && `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(term)
  }), [products, category, search])
  return (
    <main className="mx-auto min-h-[75vh] max-w-[1180px] px-5 py-12 lg:px-8 lg:py-16">
      <p className="eyebrow">Catálogo da loja</p>
      <div className="mt-2 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div><h1 className="section-title">Encontre seu produto</h1><p className="mt-3 text-[#68746f]">{filtered.length} produtos disponíveis nesta demonstração</p></div>
        <div className="relative w-full md:max-w-sm"><Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#68746f]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no catálogo" className="h-12 w-full rounded-full border border-[#173f35]/10 bg-white pl-12 pr-5 text-sm outline-none focus:border-[#275947] focus:ring-4 focus:ring-[#275947]/8" /></div>
      </div>
      <div className="scrollbar-none mt-10 flex gap-2 overflow-x-auto pb-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-bold transition ${category === item ? 'bg-[#173f35] text-white' : 'border border-[#173f35]/10 bg-white text-[#56635e] hover:border-[#173f35]/30'}`}>{item}</button>)}</div>
      {filtered.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{filtered.map((product) => <ProductCard key={product.id} product={product} onOpen={() => openProduct(product)} onAddToCart={() => onAddToCart(product)} />)}</div> : <div className="mt-16 rounded-[28px] border border-dashed border-[#173f35]/20 bg-white p-12 text-center"><p className="text-xl font-extrabold text-[#173f35]">Nenhum produto encontrado</p><p className="mt-2 text-sm text-[#68746f]">Tente outro termo ou selecione uma categoria diferente.</p></div>}
    </main>
  )
}
