import type { Product } from '@/types/product'
import { formatPrice } from '@/utils/format'
import { Icon } from '@/components/Icon'
import { ProductCard } from '@/components/ProductCard'

export function ProductPage({ product, products, back, openProduct, onAddToCart }: {
  product: Product
  products: Product[]
  back: () => void
  openProduct: (product: Product) => void
  onAddToCart: (product: Product) => void
}) {
  const related = products.filter((item) => item.id !== product.id).slice(0, 3)
  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8 lg:px-8 lg:py-12">
      <button onClick={back} className="mb-8 flex items-center gap-2 text-sm font-bold text-[#52625c] hover:text-[#173f35]"><Icon name="back" size={18} /> Voltar ao catálogo</button>
      <div className="grid gap-10 lg:grid-cols-[.93fr_1.07fr] lg:gap-16">
        <div className="overflow-hidden rounded-[30px] bg-[#f1eee5]"><img src={product.image} alt={product.name} className="aspect-square h-full w-full object-cover" /></div>
        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="rounded-full bg-[#edf3ee] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#275947]">{tag}</span>)}</div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[#8a8e8b]">{product.brand} · {product.id}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.045em] text-[#173f35] sm:text-5xl">{product.name}</h1>
          <p className="mt-5 text-3xl font-extrabold text-[#173f35]">{formatPrice(product.price)} <span className="text-sm font-medium text-[#7a827e]">/ {product.unit}</span></p>
          <button
            onClick={() => onAddToCart(product)}
            disabled={product.stock <= 0}
            className="primary-button mt-5 w-fit disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="cart" size={18} /> Adicionar ao carrinho
          </button>
          <p className="mt-6 max-w-xl leading-7 text-[#5d6964]">{product.description}</p>
          <div className="mt-8 rounded-[22px] bg-[#173f35] p-5 text-white shadow-[0_14px_35px_rgba(23,63,53,.16)]">
            <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#f6c453] text-[#173f35]"><Icon name="pin" size={22} /></span><div><p className="text-xs font-bold uppercase tracking-[.12em] text-white/55">Localização na loja</p><p className="mt-1 text-lg font-extrabold">{product.location.aisle}</p><p className="mt-0.5 text-sm text-white/72">{product.location.sector} · {product.location.shelf}</p></div></div>
          </div>
          {product.allergens.length > 0 && <div className="mt-4 flex gap-3 rounded-[18px] border border-[#d88931]/20 bg-[#fff7e5] p-4 text-[#80501d]"><Icon name="alert" className="mt-0.5 shrink-0" /><div><p className="text-sm font-extrabold">Atenção a alergênicos</p><p className="mt-1 text-sm">{product.allergens.join(' · ')}</p></div></div>}
        </div>
      </div>
      <div className="mt-16 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[26px] border border-[#173f35]/8 bg-white p-6 sm:p-8"><p className="eyebrow">Porção de referência</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[#173f35]">Informação nutricional</h2><div className="mt-6 divide-y divide-[#173f35]/8">{product.nutrition.map((item) => <div key={item.label} className="flex justify-between py-3.5 text-sm"><span className="text-[#5f6c67]">{item.label}</span><strong className="text-[#173f35]">{item.value}</strong></div>)}</div></section>
        <section className="rounded-[26px] bg-[#f2efe6] p-6 sm:p-8"><p className="eyebrow">Disponibilidade</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[#173f35]">Produto em estoque</h2><div className="mt-6 h-2 overflow-hidden rounded-full bg-[#173f35]/10"><div className="h-full rounded-full bg-[#e99a36]" style={{ width: `${Math.min(product.stock * 2, 100)}%` }} /></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-[#5f6c67]">Atualizado há poucos minutos</span><strong className="text-sm text-[#173f35]">{product.stock} unidades</strong></div><p className="mt-8 flex items-start gap-3 text-sm leading-6 text-[#5f6c67]"><Icon name="shield" className="mt-0.5 shrink-0 text-[#275947]" /> O preço exibido corresponde ao valor ativo no sistema desta demonstração.</p></section>
      </div>
      <section className="risk-section mt-6 rounded-[26px] border border-[#d88931]/18 bg-[#fff8e8] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><p className="eyebrow">Consumo consciente</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[#173f35]">Possíveis riscos do consumo em excesso</h2></div>
          <span className="flex w-fit items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-bold text-[#80501d]"><Icon name="alert" size={15} /> Orientação educativa</span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#6c6559]">As informações abaixo são gerais e não substituem a avaliação de um médico ou nutricionista. Necessidades variam conforme idade, saúde e quantidade consumida.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {product.risks.map((risk) => <article key={risk.ingredient} className="rounded-[18px] border border-[#d88931]/12 bg-white/75 p-5">
            <div className="flex items-center justify-between gap-4"><h3 className="font-extrabold text-[#173f35]">{risk.ingredient}</h3><span className="rounded-full bg-[#f9e5b8] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#80501d]">{risk.level}</span></div>
            <p className="mt-3 text-sm leading-6 text-[#6c6559]">{risk.description}</p>
          </article>)}
        </div>
      </section>
      <section className="mt-20 pb-12"><div className="mb-8"><p className="eyebrow">Você também pode gostar</p><h2 className="section-title !text-3xl">Produtos relacionados</h2></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((item) => <ProductCard key={item.id} product={item} onOpen={() => openProduct(item)} onAddToCart={() => onAddToCart(item)} />)}</div></section>
    </main>
  )
}
