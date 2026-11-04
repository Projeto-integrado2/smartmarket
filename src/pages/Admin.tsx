import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { Product } from '@/types/product'
import type { AuthUser } from '@/types/auth'
import {
  createAdminStaff,
  deactivateAdminStaff,
  fetchAdminClubSettings,
  fetchAdminProducts,
  fetchAdminStaff,
  isApiConfigured,
  restoreAdminStaff,
  saveAdminProduct,
  setProductArchived,
  updateAdminStock,
  updateAdminClubSettings,
  validateAdminToken,
  type AdminStaff,
} from '@/services/api'
import { formatPrice } from '@/utils/format'
import { Icon } from '@/components/Icon'
import {
  draftFromProduct,
  emptyDraft,
  ProductEditorForm,
  toProductInput,
  type ProductDraft,
} from '@/components/admin/ProductEditorForm'
import { ProductQrDialog } from '@/components/admin/ProductQrDialog'

const inputClass = 'w-full rounded-xl border border-[#173f35]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2d6a57] focus:ring-2 focus:ring-[#2d6a57]/10'
const labelClass = 'mb-1.5 block text-xs font-bold text-[#52625c]'

export function Admin({
  token,
  user,
  categories,
  openProduct,
  onProductsChanged,
  onClubSettingsChanged,
  onRequestAuth,
  onSignOut,
}: {
  token: string | null
  user: AuthUser | null
  categories: string[]
  openProduct: (product: Product) => void
  onProductsChanged: () => Promise<void>
  onClubSettingsChanged: () => Promise<void>
  onRequestAuth: () => void
  onSignOut: () => void
}) {
  const [authReady, setAuthReady] = useState(!token)
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
  const [qrProduct, setQrProduct] = useState<Product | null>(null)
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft)
  const [lowStockThreshold, setLowStockThreshold] = useState(10)
  const [activeTab, setActiveTab] = useState<'products' | 'staff'>('products')
  const [clubDiscountPercent, setClubDiscountPercent] = useState(10)
  const [staff, setStaff] = useState<AdminStaff[]>([])
  const [staffName, setStaffName] = useState('')
  const [staffCpf, setStaffCpf] = useState('')
  const [staffPin, setStaffPin] = useState('')

  useEffect(() => {
    window.sessionStorage.removeItem('smartmarket-admin-token')
  }, [])

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
        onSignOut()
      }
    } finally {
      setLoading(false)
    }
  }

  const loadAdminData = async (currentToken: string) => {
    try {
      const [settings, staffList] = await Promise.all([
        fetchAdminClubSettings(currentToken),
        fetchAdminStaff(currentToken),
      ])
      setClubDiscountPercent(settings.club_discount_percent)
      setStaff(staffList.staff)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as configurações administrativas.')
    }
  }

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setAuthReady(true)
      return
    }
    let cancelled = false
    validateAdminToken(token)
      .then(() => {
        if (cancelled) return
        void loadProducts(token)
        void loadAdminData(token)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        onSignOut()
        setError(reason instanceof Error ? reason.message : 'Sua sessão expirou. Entre novamente.')
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })
    return () => { cancelled = true }
  }, [token, user?.role])

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    return products
      .filter((product) => showArchived || product.is_active !== false)
      .filter((product) => !categoryFilter || product.categories.includes(categoryFilter))
      .filter((product) => !term || `${product.name} ${product.brand} ${product.id} ${product.categories.join(' ')}`.toLocaleLowerCase('pt-BR').includes(term))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }, [products, query, categoryFilter, showArchived])
  const activeProducts = products.filter((product) => product.is_active !== false)
  const archivedCount = products.length - activeProducts.length
  const lowStockCount = activeProducts.filter((product) => product.stock < lowStockThreshold).length

  const refreshProducts = async () => {
    if (!token) return
    await loadProducts(token)
    await onProductsChanged()
  }

  const startCreate = () => {
    setEditing(null)
    setDraft(emptyDraft)
    setFormOpen(true)
    setError('')
  }

  const startEdit = (product: Product) => {
    setEditing(product)
    setDraft(draftFromProduct(product, categories))
    setFormOpen(true)
    setError('')
  }

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    if (draft.categories.length === 0) {
      setError('Selecione pelo menos uma categoria.')
      return
    }
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

  const saveClubDiscount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !Number.isInteger(clubDiscountPercent) || clubDiscountPercent < 1 || clubDiscountPercent > 90) {
      setError('O desconto deve ser um número inteiro entre 1 e 90.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const settings = await updateAdminClubSettings(token, clubDiscountPercent)
      setClubDiscountPercent(settings.club_discount_percent)
      await onClubSettingsChanged()
      setNotice('Desconto Clube atualizado.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o desconto.')
    } finally {
      setSaving(false)
    }
  }

  const addStaffMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    try {
      await createAdminStaff(token, { cpf: staffCpf, name: staffName, pin: staffPin })
      setStaffName('')
      setStaffCpf('')
      setStaffPin('')
      setNotice('Funcionário cadastrado. Compartilhe o acesso de forma segura.')
      await loadAdminData(token)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar o funcionário.')
    } finally {
      setSaving(false)
    }
  }

  const removeStaffMember = async (member: AdminStaff) => {
    if (!token || !window.confirm(`Desativar o acesso administrativo de ${member.name}?`)) return
    setError('')
    try {
      await deactivateAdminStaff(token, member.id)
      setNotice('Acesso do funcionário desativado.')
      await loadAdminData(token)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível desativar o funcionário.')
    }
  }

  const restoreStaffMember = async (member: AdminStaff) => {
    if (!token) return
    setError('')
    try {
      await restoreAdminStaff(token, member.id)
      setNotice('Acesso do funcionário reativado.')
      await loadAdminData(token)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível reativar o funcionário.')
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

  if (!token || user?.role !== 'admin') {
    return (
      <main className="mx-auto min-h-[75vh] max-w-[480px] px-5 py-16">
        <p className="eyebrow">Área administrativa</p>
        <h1 className="section-title">Acesso restrito</h1>
        <p className="mt-3 text-sm text-[#68746f]">Entre com um CPF autorizado por um administrador para acessar o painel.</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <button type="button" onClick={onRequestAuth} className="primary-button mt-6">Entrar com CPF</button>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-[75vh] max-w-[1180px] px-5 py-12 lg:px-8">
      {qrProduct && <ProductQrDialog product={qrProduct} onClose={() => setQrProduct(null)} />}
      {notice && <div role="status" className="fixed right-5 top-24 z-50 flex items-center gap-3 rounded-2xl bg-[#173f35] px-5 py-4 text-sm font-bold text-white shadow-2xl"><Icon name="check" className="text-[#f6c453]" />{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')} className="ml-2"><Icon name="close" size={16} /></button></div>}
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div><p className="eyebrow">Área administrativa · {user.name}</p><h1 className="section-title">Painel de gestão</h1><p className="mt-3 text-sm text-[#68746f]">Catálogo, benefícios do clube e acessos de funcionários.</p></div>
        {activeTab === 'products' && <button onClick={startCreate} className="primary-button"><Icon name="plus" size={19} /> Novo produto</button>}
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <nav className="mt-7 flex gap-2 border-b border-[#173f35]/10" aria-label="Seções administrativas">
        <button type="button" onClick={() => setActiveTab('products')} className={`px-4 py-3 text-sm font-bold ${activeTab === 'products' ? 'border-b-2 border-[#275947] text-[#173f35]' : 'text-[#68746f]'}`}>Produtos e descontos</button>
        <button type="button" onClick={() => setActiveTab('staff')} className={`px-4 py-3 text-sm font-bold ${activeTab === 'staff' ? 'border-b-2 border-[#275947] text-[#173f35]' : 'text-[#68746f]'}`}>Funcionários</button>
      </nav>

      <form onSubmit={saveClubDiscount} className="mt-6 flex flex-col gap-4 rounded-[22px] border border-[#173f35]/10 bg-white p-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-extrabold text-[#173f35]">Desconto Clube</p><p className="mt-1 text-xs text-[#68746f]">Aplicado aos produtos com a tag exata “Desconto Clube”.</p></div>
        <div className="flex items-end gap-3">
          <label><span className={labelClass}>Percentual (1–90%)</span><input className={inputClass} type="number" min={1} max={90} step={1} value={clubDiscountPercent} onChange={(event) => setClubDiscountPercent(Number(event.target.value))} /></label>
          <button type="submit" className="secondary-button min-h-[42px]" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>

      {activeTab === 'staff' ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <form onSubmit={addStaffMember} className="h-fit rounded-[24px] border border-[#173f35]/10 bg-white p-5">
            <h2 className="text-lg font-extrabold text-[#173f35]">Adicionar funcionário</h2>
            <p className="mt-2 text-xs leading-5 text-[#68746f]">Funcionários cadastrados recebem acesso administrativo. Entregue o PIN diretamente e com segurança.</p>
            <label className="mt-4 block"><span className={labelClass}>Nome</span><input className={inputClass} value={staffName} onChange={(event) => setStaffName(event.target.value)} maxLength={120} required /></label>
            <label className="mt-4 block"><span className={labelClass}>CPF</span><input className={inputClass} value={staffCpf} onChange={(event) => setStaffCpf(event.target.value)} inputMode="numeric" maxLength={14} required /></label>
            <label className="mt-4 block"><span className={labelClass}>PIN inicial de 6 dígitos</span><input className={inputClass} type="password" value={staffPin} onChange={(event) => setStaffPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" minLength={6} maxLength={6} required /></label>
            <button type="submit" className="primary-button mt-5 w-full" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar funcionário'}</button>
          </form>
          <div className="overflow-hidden rounded-[24px] border border-[#173f35]/10 bg-white">
            <h2 className="border-b border-[#173f35]/10 px-5 py-4 font-extrabold text-[#173f35]">Contas de funcionários</h2>
            {staff.length === 0 ? <p className="p-5 text-sm text-[#68746f]">Nenhum funcionário cadastrado pelo painel.</p> : <ul className="divide-y divide-[#173f35]/10">
              {staff.map((member) => <li key={member.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <span><strong className="block text-sm text-[#173f35]">{member.name}</strong><span className="text-xs text-[#68746f]">{member.cpf} · {member.is_active ? 'Ativo' : 'Desativado'}</span></span>
                {member.is_active
                  ? <button type="button" onClick={() => void removeStaffMember(member)} className="text-xs font-bold text-red-700 underline underline-offset-2">Desativar</button>
                  : <button type="button" onClick={() => void restoreStaffMember(member)} className="text-xs font-bold text-[#275947] underline underline-offset-2">Reativar</button>}
              </li>)}
            </ul>}
          </div>
        </section>
      ) : <>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ['Produtos ativos', activeProducts.length, 'grid'],
          [`Estoque baixo (< ${lowStockThreshold})`, lowStockCount, 'alert'],
          ['Produtos arquivados', archivedCount, 'qr'],
        ].map(([label, value, icon]) => <div key={String(label)} className="rounded-[22px] border border-[#173f35]/8 bg-white p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#edf3ee] text-[#275947]"><Icon name={String(icon)} size={19} /></span><span className="text-3xl font-extrabold tracking-[-.04em] text-[#173f35]">{value}</span></div><p className="mt-5 text-sm font-semibold text-[#65706c]">{label}</p></div>)}
      </div>

      {formOpen && (
        <ProductEditorForm
          categories={categories}
          draft={draft}
          editing={editing}
          saving={saving}
          setDraft={setDraft}
          onCancel={() => setFormOpen(false)}
          onSubmit={submitProduct}
        />
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
              <div><button onClick={() => openProduct(product)} className="text-left text-sm font-extrabold text-[#173f35] hover:underline">{product.name}</button><p className="mt-1 text-xs text-[#8a8e8b]">{product.id} · {product.categories.join(', ')}</p>{product.is_active === false && <span className="mt-1 inline-block text-xs font-bold text-[#8a5c32]">Arquivado</span>}</div>
              <div className="text-sm text-[#64706b]">{product.location.aisle} · {product.location.shelf}</div>
              <div><strong className="text-sm text-[#173f35]">{formatPrice(product.price)}</strong><div className="mt-1 flex items-center gap-2"><button aria-label={`Diminuir estoque de ${product.name}`} className="grid h-6 w-6 place-items-center rounded-full border border-[#173f35]/15" disabled={product.stock <= 0 || product.is_active === false} onClick={() => void changeStock(product, product.stock - 1)}><Icon name="minus" size={13} /></button><span className={`text-xs font-semibold ${product.stock < lowStockThreshold ? 'text-[#c06d20]' : 'text-[#6b7772]'}`}>{product.stock} em estoque</span><button aria-label={`Aumentar estoque de ${product.name}`} className="grid h-6 w-6 place-items-center rounded-full border border-[#173f35]/15" disabled={product.is_active === false} onClick={() => void changeStock(product, product.stock + 1)}><Icon name="plus" size={13} /></button></div></div>
              <div className="flex gap-2"><button onClick={() => setQrProduct(product)} disabled={product.is_active === false} className="grid h-9 w-9 place-items-center rounded-full border border-[#173f35]/10 text-[#52625c] hover:bg-[#edf3ee] disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Gerar QR code de ${product.name}`} title="Gerar QR code"><Icon name="qr" size={17} /></button><button onClick={() => startEdit(product)} className="grid h-9 w-9 place-items-center rounded-full border border-[#173f35]/10 text-[#52625c] hover:bg-[#edf3ee]" aria-label={`Editar ${product.name}`}><Icon name="edit" size={17} /></button><button onClick={() => void toggleArchive(product)} className="rounded-full border border-[#173f35]/10 px-3 text-xs font-bold text-[#52625c] hover:bg-[#edf3ee]">{product.is_active === false ? 'Restaurar' : 'Arquivar'}</button></div>
            </div>)}
          </div>
        )}
      </section>
      </>}
    </main>
  )
}
