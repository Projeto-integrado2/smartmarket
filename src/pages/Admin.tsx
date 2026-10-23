import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { Product } from '@/types/product'
import {
  adminLogin,
  fetchAdminProducts,
  isApiConfigured,
  saveAdminProduct,
  setProductArchived,
  updateAdminStock,
  validateAdminToken,
  type AdminProductInput,
} from '@/services/api'
import { formatPrice } from '@/utils/format'
import { Icon } from '@/components/Icon'

type ProductDraft = {
  name: string
  brand: string
  category: string
  price: string
  unit: string
  image: string
  sector: string
  aisle: string
  shelf: string
  description: string
  stock: string
  tags: string
  allergens: string
  risks: string
  nutrition: string
}

const emptyDraft: ProductDraft = {
  name: '', brand: '', category: '', price: '', unit: '', image: '',
  sector: '', aisle: '', shelf: '', description: '', stock: '0',
  tags: '', allergens: '', risks: '[]', nutrition: '[]',
}

const inputClass = 'w-full rounded-xl border border-[#173f35]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2d6a57] focus:ring-2 focus:ring-[#2d6a57]/10'
const labelClass = 'mb-1.5 block text-xs font-bold text-[#52625c]'

function draftFromProduct(product: Product): ProductDraft {
  return {
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: String(product.price),
    unit: product.unit,
    image: product.image,
    sector: product.location.sector,
    aisle: product.location.aisle,
    shelf: product.location.shelf,
    description: product.description,
    stock: String(product.stock),
    tags: product.tags.join(', '),
    allergens: product.allergens.join(', '),
    risks: JSON.stringify(product.risks, null, 2),
    nutrition: JSON.stringify(product.nutrition, null, 2),
  }
}

function toProductInput(draft: ProductDraft): AdminProductInput {
  return {
    name: draft.name,
    brand: draft.brand,
    category: draft.category,
    price: Number(draft.price),
    unit: draft.unit,
    image: draft.image,
    location: { sector: draft.sector, aisle: draft.aisle, shelf: draft.shelf },
    description: draft.description,
    stock: Number(draft.stock),
    tags: draft.tags.split(',').map((value) => value.trim()).filter(Boolean),
    allergens: draft.allergens.split(',').map((value) => value.trim()).filter(Boolean),
    risks: JSON.parse(draft.risks),
    nutrition: JSON.parse(draft.nutrition),
  }
}

export function Admin({
  openProduct,
  onProductsChanged,
}: {
  openProduct: (product: Product) => void
  onProductsChanged: () => Promise<void>
}) {
  const [token, setToken] = useState(() => window.sessionStorage.getItem('smartmarket-admin-token'))
  const [authReady, setAuthReady] = useState(!token)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft)
  const [lowStockThreshold, setLowStockThreshold] = useState(10)

  const loadProducts = async (currentToken: string) => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchAdminProducts(currentToken, true)
      setProducts(result.products)
      setLowStockThreshold(result.low_stock_threshold)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível carregar os produtos.'
      setError(message)
      if (message.includes('expirou') || message.includes('inválido') || message.includes('necessária')) {
        window.sessionStorage.removeItem('smartmarket-admin-token')
        setToken(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    let cancelled = false
    validateAdminToken(token)
      .then(() => {
        if (!cancelled) void loadProducts(token)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        window.sessionStorage.removeItem('smartmarket-admin-token')
        setToken(null)
        setError(reason instanceof Error ? reason.message : 'Sua sessão expirou. Entre novamente.')
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })
    return () => { cancelled = true }
  }, [token])

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    return products
      .filter((product) => showArchived || product.is_active !== false)
      .filter((product) => !categoryFilter || product.category === categoryFilter)
      .filter((product) => !term || `${product.name} ${product.brand} ${product.id} ${product.category}`.toLocaleLowerCase('pt-BR').includes(term))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }, [products, query, categoryFilter, showArchived])
  const categories = [...new Set(products.map((product) => product.category))].sort((left, right) => left.localeCompare(right, 'pt-BR'))
  const activeProducts = products.filter((product) => product.is_active !== false)
  const archivedCount = products.length - activeProducts.length
  const lowStockCount = activeProducts.filter((product) => product.stock < lowStockThreshold).length

  const refreshProducts = async () => {
    if (!token) return
    await loadProducts(token)
    await onProductsChanged()
  }

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await adminLogin(username, password)
      window.sessionStorage.setItem('smartmarket-admin-token', result.token)
      setToken(result.token)
      setPassword('')
      setAuthReady(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível autenticar.')
    } finally {
      setSaving(false)
    }
  }

  const signOut = () => {
    window.sessionStorage.removeItem('smartmarket-admin-token')
    setToken(null)
    setProducts([])
    setError('')
    setAuthReady(true)
  }

  const startCreate = () => {
    setEditing(null)
    setDraft(emptyDraft)
    setFormOpen(true)
    setError('')
  }

  const startEdit = (product: Product) => {
    setEditing(product)
    setDraft(draftFromProduct(product))
    setFormOpen(true)
    setError('')
  }

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    try {
      const input = toProductInput(draft)
      await saveAdminProduct(token, input, editing?.id)
      setNotice(editing ? 'Produto atualizado.' : 'Produto cadastrado.')
      setFormOpen(false)
      await refreshProducts()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o produto.')
    } finally {
      setSaving(false)
    }
  }

  const changeStock = async (product: Product, amount: number) => {
    if (!token || amount < 0) return
    setError('')
    try {
      await updateAdminStock(token, product.id, amount)
      await refreshProducts()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o estoque.')
    }
  }

  const toggleArchive = async (product: Product) => {
    if (!token) return
    const archived = product.is_active !== false
    if (archived && !window.confirm(`Arquivar ${product.name}? O produto deixará de aparecer no catálogo.`)) return
    setError('')
    try {
      await setProductArchived(token, product.id, archived)
      setNotice(archived ? 'Produto arquivado.' : 'Produto restaurado.')
      await refreshProducts()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível alterar o status do produto.')
    }
  }

  if (!isApiConfigured()) {
    return (
      <main className="mx-auto min-h-[65vh] max-w-[680px] px-5 py-16">
        <p className="eyebrow">Área administrativa</p>
        <h1 className="section-title">Conecte a API</h1>
        <p className="mt-4 text-sm leading-6 text-[#68746f]">Configure <code>VITE_API_URL</code> para acessar o painel. No modo de demonstração, alterações não são persistidas.</p>
      </main>
    )
  }

  if (!authReady) {
    return <main className="mx-auto min-h-[65vh] max-w-[680px] px-5 py-24 text-center text-[#68746f]">Verificando acesso...</main>
  }

  if (!token) {
    return (
      <main className="mx-auto min-h-[75vh] max-w-[480px] px-5 py-16">
        <p className="eyebrow">Área administrativa</p>
        <h1 className="section-title">Entrar no painel</h1>
        <p className="mt-3 text-sm text-[#68746f]">Entre com uma conta administrativa para gerenciar o catálogo.</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <form onSubmit={signIn} className="mt-7 space-y-4 rounded-3xl border border-[#173f35]/10 bg-white p-6 shadow-sm">
          <label className="block"><span className={labelClass}>Usuário</span><input className={inputClass} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label className="block"><span className={labelClass}>Senha</span><input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="primary-button w-full" disabled={saving}>{saving ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-[75vh] max-w-[1180px] px-5 py-12 lg:px-8">
      {notice && <div role="status" className="fixed right-5 top-24 z-50 flex items-center gap-3 rounded-2xl bg-[#173f35] px-5 py-4 text-sm font-bold text-white shadow-2xl"><Icon name="check" className="text-[#f6c453]" />{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')} className="ml-2"><Icon name="close" size={16} /></button></div>}
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div><p className="eyebrow">Área administrativa</p><h1 className="section-title">Gestão de produtos</h1><p className="mt-3 text-sm text-[#68746f]">Alterações persistidas no catálogo da API.</p></div>
        <div className="flex gap-3"><button onClick={signOut} className="secondary-button">Sair</button><button onClick={startCreate} className="primary-button"><Icon name="plus" size={19} /> Novo produto</button></div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ['Produtos ativos', activeProducts.length, 'grid'],
          [`Estoque baixo (< ${lowStockThreshold})`, lowStockCount, 'alert'],
          ['Produtos arquivados', archivedCount, 'qr'],
        ].map(([label, value, icon]) => <div key={String(label)} className="rounded-[22px] border border-[#173f35]/8 bg-white p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#edf3ee] text-[#275947]"><Icon name={String(icon)} size={19} /></span><span className="text-3xl font-extrabold tracking-[-.04em] text-[#173f35]">{value}</span></div><p className="mt-5 text-sm font-semibold text-[#65706c]">{label}</p></div>)}
      </div>

      {formOpen && (
        <form onSubmit={submitProduct} className="mt-8 rounded-[26px] border border-[#173f35]/10 bg-white p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{editing ? 'Editar cadastro' : 'Novo cadastro'}</p><h2 className="mt-1 text-xl font-extrabold text-[#173f35]">{editing ? editing.name : 'Dados do produto'}</h2>{editing && <p className="mt-1 text-xs text-[#68746f]">Código: {editing.id}</p>}</div><button type="button" className="secondary-button min-h-10 px-4" onClick={() => setFormOpen(false)}>Cancelar</button></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ['name', 'Nome'], ['brand', 'Marca'], ['category', 'Categoria'],
              ['price', 'Preço (R$)'], ['unit', 'Unidade'], ['stock', 'Estoque'],
              ['image', 'URL da imagem'], ['sector', 'Setor'], ['aisle', 'Corredor'],
              ['shelf', 'Prateleira'],
            ] as const).map(([key, label]) => <label key={key} className="block"><span className={labelClass}>{label}</span><input className={inputClass} type={key === 'price' || key === 'stock' ? 'number' : 'text'} min={key === 'stock' ? 0 : key === 'price' ? 0.01 : undefined} step={key === 'price' ? '0.01' : key === 'stock' ? '1' : undefined} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} required /></label>)}
          </div>
          <label className="mt-4 block"><span className={labelClass}>Descrição</span><textarea className={inputClass} rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} required /></label>
          <details className="mt-5 rounded-2xl bg-[#f8f8f4] p-4">
            <summary className="cursor-pointer text-sm font-extrabold text-[#173f35]">Informações complementares</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className={labelClass}>Tags (separadas por vírgula)</span><input className={inputClass} value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} /></label>
              <label className="block"><span className={labelClass}>Alergênicos (separados por vírgula)</span><input className={inputClass} value={draft.allergens} onChange={(event) => setDraft((current) => ({ ...current, allergens: event.target.value }))} /></label>
              <label className="block"><span className={labelClass}>Riscos (JSON)</span><textarea className={`${inputClass} font-mono text-xs`} rows={6} value={draft.risks} onChange={(event) => setDraft((current) => ({ ...current, risks: event.target.value }))} /></label>
              <label className="block"><span className={labelClass}>Nutrição (JSON)</span><textarea className={`${inputClass} font-mono text-xs`} rows={6} value={draft.nutrition} onChange={(event) => setDraft((current) => ({ ...current, nutrition: event.target.value }))} /></label>
            </div>
            <p className="mt-3 text-xs text-[#68746f]">Riscos: lista com ingredient, level (Atenção ou Moderado) e description. Nutrição: lista com label e value.</p>
          </details>
          <div className="mt-5 flex justify-end"><button className="primary-button" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar produto'}</button></div>
        </form>
      )}

      <section className="mt-8 overflow-hidden rounded-[26px] border border-[#173f35]/8 bg-white">
        <div className="flex flex-col gap-4 border-b border-[#173f35]/8 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><h2 className="font-extrabold text-[#173f35]">Catálogo</h2><p className="mt-1 text-xs text-[#8a8e8b]">{visibleProducts.length} produto(s)</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input aria-label="Buscar no catálogo administrativo" className={`${inputClass} sm:w-64`} placeholder="Buscar nome, código ou categoria" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select aria-label="Filtrar por categoria" className={`${inputClass} sm:w-44`} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Todas as categorias</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#52625c]"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Mostrar arquivados</label>
          </div>
        </div>
        {loading ? <p className="px-6 py-10 text-center text-sm text-[#68746f]">Carregando catálogo...</p> : visibleProducts.length === 0 ? <p className="px-6 py-10 text-center text-sm text-[#68746f]">Nenhum produto encontrado.</p> : (
          <div className="divide-y divide-[#173f35]/8">
            {visibleProducts.map((product) => <div key={product.id} className={`grid gap-4 px-4 py-4 sm:grid-cols-[64px_1.5fr_1fr_1fr_auto] sm:items-center sm:px-6 ${product.is_active === false ? 'bg-[#f8f8f4]' : ''}`}>
              <img src={product.image} alt="" className="h-12 w-12 rounded-xl object-cover sm:h-14 sm:w-14" />
              <div><button onClick={() => openProduct(product)} className="text-left text-sm font-extrabold text-[#173f35] hover:underline">{product.name}</button><p className="mt-1 text-xs text-[#8a8e8b]">{product.id} · {product.category}</p>{product.is_active === false && <span className="mt-1 inline-block text-xs font-bold text-[#8a5c32]">Arquivado</span>}</div>
              <div className="text-sm text-[#64706b]">{product.location.aisle} · {product.location.shelf}</div>
              <div><strong className="text-sm text-[#173f35]">{formatPrice(product.price)}</strong><div className="mt-1 flex items-center gap-2"><button aria-label={`Diminuir estoque de ${product.name}`} className="grid h-6 w-6 place-items-center rounded-full border border-[#173f35]/15" disabled={product.stock <= 0 || product.is_active === false} onClick={() => void changeStock(product, product.stock - 1)}><Icon name="minus" size={13} /></button><span className={`text-xs font-semibold ${product.stock < lowStockThreshold ? 'text-[#c06d20]' : 'text-[#6b7772]'}`}>{product.stock} em estoque</span><button aria-label={`Aumentar estoque de ${product.name}`} className="grid h-6 w-6 place-items-center rounded-full border border-[#173f35]/15" disabled={product.is_active === false} onClick={() => void changeStock(product, product.stock + 1)}><Icon name="plus" size={13} /></button></div></div>
              <div className="flex gap-2"><button onClick={() => startEdit(product)} className="grid h-9 w-9 place-items-center rounded-full border border-[#173f35]/10 text-[#52625c] hover:bg-[#edf3ee]" aria-label={`Editar ${product.name}`}><Icon name="edit" size={17} /></button><button onClick={() => void toggleArchive(product)} className="rounded-full border border-[#173f35]/10 px-3 text-xs font-bold text-[#52625c] hover:bg-[#edf3ee]">{product.is_active === false ? 'Restaurar' : 'Arquivar'}</button></div>
            </div>)}
          </div>
        )}
      </section>
    </main>
  )
}
