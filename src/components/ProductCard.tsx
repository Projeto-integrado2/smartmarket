import type { Product } from '@/types/product'
import { formatPrice } from '@/utils/format'
import { Icon } from './Icon'

export function ProductCard({ product, onOpen, onAddToCart }: {
  product: Product
  onOpen: () => void
  onAddToCart: () => void
}) {
  const badge = product.tags.includes('Desconto Clube')
    ? 'Desconto Clube'
    : product.tags[0]
  return (
    <article className="product-card group overflow-hidden rounded-[24px] border border-[#173f35]/8 bg-white">
      <div className="relative aspect-[1.12] overflow-hidden bg-[#f3f0e7]">
        <button type="button" onClick={onOpen} className="block h-full w-full" aria-label={`Ver detalhes de ${product.name}`}>
          <img src={product.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        </button>
        {badge && <span className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] backdrop-blur ${badge === 'Desconto Clube' ? 'bg-[#f6c453] text-[#173f35]' : 'bg-[#fffdf8]/92 text-[#275947]'}`}>{badge}</span>}
      </div>
      <div className="p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[.1em] text-[#7a827e]">{product.brand}</p>
        <h3 className="text-lg font-extrabold tracking-[-.03em] text-[#173f35]">
          <button type="button" onClick={onOpen} className="text-left">{product.name}</button>
        </h3>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div><span className="text-xl font-extrabold text-[#173f35]">{formatPrice(product.price)}</span><span className="ml-1 text-xs text-[#7a827e]">/ {product.unit}</span></div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAddToCart}
              disabled={product.stock <= 0}
              className="grid h-9 w-9 place-items-center rounded-full bg-[#fdf1d2] text-[#80501d] transition hover:bg-[#f6c453] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Adicionar ${product.name} ao carrinho`}
              title="Adicionar ao carrinho"
            ><Icon name="cart" size={17} /></button>
            <button type="button" onClick={onOpen} className="grid h-9 w-9 place-items-center rounded-full bg-[#eef3ef] text-[#275947] transition group-hover:bg-[#275947] group-hover:text-white" aria-label={`Ver ${product.name}`}><Icon name="arrow" size={17} /></button>
          </div>
        </div>
      </div>
    </article>
  )
}
