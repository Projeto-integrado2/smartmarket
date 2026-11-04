import { useState } from 'react'
import type { Product } from '@/types/product'
import type { BranchAvailability } from '@/types/auth'
import { fetchNearbyBranches } from '@/services/api'
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
  const [branchesOpen, setBranchesOpen] = useState(false)
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [branchesError, setBranchesError] = useState('')
  const [branches, setBranches] = useState<BranchAvailability[]>([])
  const related = products.filter((item) => item.id !== product.id).slice(0, 3)
  const showBranches = async () => {
    setBranchesOpen(true)
    setBranchesLoading(true)
    setBranchesError('')
    try {
      const result = await fetchNearbyBranches(product.id)
      setBranches(result.branches)
    } catch (reason) {
      setBranchesError(reason instanceof Error ? reason.message : 'Não foi possível consultar as filiais.')
    } finally {
      setBranchesLoading(false)
    }
  }
  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8 lg:px-8 lg:py-12">
      {branchesOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setBranchesOpen(false)
      }}>
        <section role="dialog" aria-modal="true" aria-labelledby="branches-title" className="w-full max-w-[520px] rounded-[26px] bg-[#fffdf8] p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="eyebrow">Disponibilidade simulada</p><h2 id="branches-title" className="mt-1 text-2xl font-extrabold text-[#173f35]">Outras filiais</h2><p className="mt-2 text-sm text-[#68746f]">{product.name}</p></div>
            <button type="button" onClick={() => setBranchesOpen(false)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#edf3ee]"><Icon name="close" /></button>
          </div>
          <p className="mt-4 rounded-xl bg-[#fff7e5] px-4 py-3 text-xs leading-5 text-[#684410]">Filiais, distâncias e estoque abaixo são dados demonstrativos e não representam disponibilidade real.</p>
          {branchesLoading && <p role="status" className="py-8 text-center text-sm text-[#68746f]">Consultando filiais...</p>}
          {branchesError && <p role="alert" className="mt-4 text-sm text-red-700">{branchesError}</p>}
          {!branchesLoading && !branchesError && <ul className="mt-4 divide-y divide-[#173f35]/10">{branches.map((branch) => (
            <li key={branch.name} className="flex items-center justify-between gap-4 py-4">
              <div><p className="font-bold text-[#173f35]">{branch.name}</p><p className="mt-1 text-xs text-[#68746f]">{branch.address} · {branch.distance_km.toLocaleString('pt-BR')} km</p></div>
              <span className="shrink-0 rounded-full bg-[#edf3ee] px-3 py-1.5 text-xs font-bold text-[#275947]">{branch.stock} un. (simulado)</span>
            </li>
          ))}</ul>}
        </section>
      </div>}
      <button onClick={back} className="mb-8 flex items-center gap-2 text-sm font-bold text-[#52625c] hover:text-[#173f35]"><Icon name="back" size={18} /> Voltar ao catálogo</button>
      <div className="grid gap-10 lg:grid-cols-[.93fr_1.07fr] lg:gap-16">
        <div className="overflow-hidden rounded-[30px] bg-[#f1eee5]"><img src={product.image} alt={product.name} className="aspect-square h-full w-full object-cover" /></div>
        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="rounded-full bg-[#edf3ee] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#275947]">{tag}</span>)}</div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-[#8a8e8b]">{product.brand} · {product.id}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.045em] text-[#173f35] sm:text-5xl">{product.name}</h1>
          <p className="mt-5 text-3xl font-extrabold text-[#173f35]">{formatPrice(product.price)} <span className="text-sm font-medium text-[#7a827e]">/ {product.unit}</span></p>
          {product.stock > 0 ? <button
            onClick={() => onAddToCart(product)}
            className="primary-button mt-5 w-fit"
          >
            <Icon name="cart" size={18} /> Adicionar ao carrinho
          </button> : <button type="button" onClick={() => void showBranches()} className="primary-button mt-5 w-fit">
            <Icon name="pin" size={18} /> Ver lojas próximas com estoque
          </button>}
          <p className="mt-6 max-w-xl leading-7 text-[#5d6964]">{product.description}</p>
          <div className="mt-8 rounded-[22px] bg-[#173f35] p-5 text-white shadow-[0_14px_35px_rgba(23,63,53,.16)]">
            <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#f6c453] text-[#173f35]"><Icon name="pin" size={22} /></span><div><p className="text-xs font-bold uppercase tracking-[.12em] text-white/55">Localização na loja</p><p className="mt-1 text-lg font-extrabold">{product.location.aisle}</p><p className="mt-0.5 text-sm text-white/72">{product.location.sector} · {product.location.shelf}</p></div></div>
          </div>
          {product.allergens.length > 0 && <div className="mt-4 flex gap-3 rounded-[18px] border border-[#d88931]/20 bg-[#fff7e5] p-4 text-[#80501d]"><Icon name="alert" className="mt-0.5 shrink-0" /><div><p className="text-sm font-extrabold">Atenção a alergênicos</p><p className="mt-1 text-sm">{product.allergens.join(' · ')}</p></div></div>}
        </div>
      </div>
      <div className="mt-16 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[26px] border border-[#173f35]/8 bg-white p-6 sm:p-8">
          <p className="eyebrow">Valores de referência</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold tracking-[-.03em] text-[#173f35]">Informação nutricional</h2>
            <span className="rounded-full bg-[#edf3ee] px-3 py-1.5 text-xs font-extrabold text-[#173f35]">Por 100 g</span>
          </div>
          {product.nutrition.length > 0 ? (
            <table className="mt-6 w-full border-collapse text-left text-sm">
              <caption className="sr-only">Informação nutricional do produto por 100 gramas</caption>
              <tbody className="divide-y divide-[#173f35]/10">
                {product.nutrition.map((item) => (
                  <tr key={item.label}>
                    <th scope="row" className="py-3.5 pr-4 font-medium text-[#5f6c67]">{item.label}</th>
                    <td className="py-3.5 text-right font-extrabold text-[#173f35]">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-6 text-sm text-[#52625c]">Informações nutricionais não cadastradas.</p>
          )}
        </section>
        <section className="rounded-[26px] bg-[#f2efe6] p-6 sm:p-8"><p className="eyebrow">Disponibilidade</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[#173f35]">{product.stock > 0 ? 'Produto em estoque' : 'Sem estoque nesta loja'}</h2><div className="mt-6 h-2 overflow-hidden rounded-full bg-[#173f35]/10"><div className="h-full rounded-full bg-[#e99a36]" style={{ width: `${Math.min(product.stock * 2, 100)}%` }} /></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-[#5f6c67]">Disponibilidade nesta unidade</span><strong className="text-sm text-[#173f35]">{product.stock} unidades</strong></div><p className="mt-8 flex items-start gap-3 text-sm leading-6 text-[#5f6c67]"><Icon name="shield" className="mt-0.5 shrink-0 text-[#275947]" /> O preço exibido corresponde ao valor ativo no sistema desta demonstração.</p></section>
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
