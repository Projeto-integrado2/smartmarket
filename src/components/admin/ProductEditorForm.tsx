import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { Product } from '@/types/product'
import type { AdminProductInput } from '@/services/api'

export type ProductDraft = {
  name: string
  brand: string
  categories: string[]
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
  risks: Product['risks']
  nutrition: Product['nutrition']
}

export const emptyDraft: ProductDraft = {
  name: '', brand: '', categories: [], price: '', unit: '', image: '',
  sector: '', aisle: '', shelf: '', description: '', stock: '0',
  tags: '', allergens: '', risks: [], nutrition: [],
}

const inputClass = 'w-full rounded-xl border border-[#173f35]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2d6a57] focus:ring-2 focus:ring-[#2d6a57]/10'
const labelClass = 'mb-1.5 block text-xs font-bold text-[#52625c]'

export function draftFromProduct(product: Product, availableCategories: string[]): ProductDraft {
  return {
    name: product.name,
    brand: product.brand,
    categories: product.categories.filter((category) => availableCategories.includes(category)),
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
    risks: product.risks,
    nutrition: product.nutrition,
  }
}

export function toProductInput(draft: ProductDraft): AdminProductInput {
  return {
    name: draft.name,
    brand: draft.brand,
    category: draft.categories[0] ?? '',
    categories: draft.categories,
    price: Number(draft.price),
    unit: draft.unit,
    image: draft.image,
    location: { sector: draft.sector, aisle: draft.aisle, shelf: draft.shelf },
    description: draft.description,
    stock: Number(draft.stock),
    tags: draft.tags.split(',').map((value) => value.trim()).filter(Boolean),
    allergens: draft.allergens.split(',').map((value) => value.trim()).filter(Boolean),
    risks: draft.risks,
    nutrition: draft.nutrition,
  }
}

type ProductEditorFormProps = {
  categories: string[]
  draft: ProductDraft
  editing: Product | null
  saving: boolean
  setDraft: Dispatch<SetStateAction<ProductDraft>>
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

const productFields = [
  ['name', 'Nome'],
  ['brand', 'Marca'],
  ['price', 'Preço (R$)'],
  ['unit', 'Unidade'],
  ['stock', 'Estoque'],
  ['image', 'URL da imagem'],
  ['sector', 'Setor'],
  ['aisle', 'Corredor'],
  ['shelf', 'Prateleira'],
] as const

export function ProductEditorForm({
  categories,
  draft,
  editing,
  saving,
  setDraft,
  onCancel,
  onSubmit,
}: ProductEditorFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-8 rounded-[26px] border border-[#173f35]/10 bg-white p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{editing ? 'Editar cadastro' : 'Novo cadastro'}</p>
          <h2 className="mt-1 text-xl font-extrabold text-[#173f35]">
            {editing ? editing.name : 'Dados do produto'}
          </h2>
          {editing && <p className="mt-1 text-xs text-[#68746f]">Código: {editing.id}</p>}
        </div>
        <button type="button" className="secondary-button min-h-10 px-4" onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {productFields.map(([key, label]) => (
          <label key={key} className="block">
            <span className={labelClass}>{label}</span>
            <input
              className={inputClass}
              type={key === 'price' || key === 'stock' ? 'number' : 'text'}
              min={key === 'stock' ? 0 : key === 'price' ? 0.01 : undefined}
              step={key === 'price' ? '0.01' : key === 'stock' ? '1' : undefined}
              value={draft[key]}
              onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
              required
            />
          </label>
        ))}
      </div>

      <fieldset className="mt-4">
        <legend className={labelClass}>Categorias (selecione uma ou mais)</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <label key={category} className="flex items-center gap-2 rounded-xl border border-[#173f35]/10 bg-white px-3 py-2.5 text-sm text-[#52625c]">
              <input
                type="checkbox"
                checked={draft.categories.includes(category)}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  categories: event.target.checked
                    ? [...current.categories, category]
                    : current.categories.filter((item) => item !== category),
                }))}
              />
              {category}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className={labelClass}>Descrição</span>
        <textarea
          className={inputClass}
          rows={3}
          value={draft.description}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          required
        />
      </label>

      <details open className="mt-5 rounded-2xl bg-[#f8f8f4] p-4">
        <summary className="cursor-pointer text-sm font-extrabold text-[#173f35]">
          Informações complementares
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Tags (separadas por vírgula)</span>
            <input
              className={inputClass}
              value={draft.tags}
              onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Alergênicos (separados por vírgula)</span>
            <input
              className={inputClass}
              value={draft.allergens}
              onChange={(event) => setDraft((current) => ({ ...current, allergens: event.target.value }))}
            />
          </label>
          <fieldset className="rounded-xl border border-[#173f35]/10 bg-white p-3 sm:col-span-2">
            <legend className={`${labelClass} px-1`}>Riscos de consumo</legend>
            <p className="mb-3 text-xs leading-5 text-[#52625c]">Cadastre cada risco separadamente. Use descrições claras e informativas, sem afirmar diagnóstico.</p>
            <div className="space-y-3">
              {draft.risks.map((risk, index) => (
                <div key={index} className="grid gap-3 rounded-xl bg-[#f8f8f4] p-3 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>Ingrediente ou fator</span>
                    <input
                      className={inputClass}
                      value={risk.ingredient}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        risks: current.risks.map((item, itemIndex) => itemIndex === index
                          ? { ...item, ingredient: event.target.value }
                          : item),
                      }))}
                      required
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Nível de atenção</span>
                    <select
                      className={inputClass}
                      value={risk.level}
                      onChange={(event) => {
                        const level = event.currentTarget.value === 'Moderado' ? 'Moderado' : 'Atenção'
                        setDraft((current) => ({
                          ...current,
                          risks: current.risks.map((item, itemIndex) => itemIndex === index
                            ? { ...item, level }
                            : item),
                        }))
                      }}
                    >
                      <option value="Atenção">Atenção</option>
                      <option value="Moderado">Moderado</option>
                    </select>
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Descrição</span>
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={risk.description}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        risks: current.risks.map((item, itemIndex) => itemIndex === index
                          ? { ...item, description: event.target.value }
                          : item),
                      }))}
                      required
                    />
                  </label>
                  <button
                    type="button"
                    className="justify-self-start text-xs font-bold text-red-700 underline decoration-transparent underline-offset-2 hover:decoration-current sm:col-span-2"
                    onClick={() => setDraft((current) => ({
                      ...current,
                      risks: current.risks.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                  >
                    Remover risco
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button mt-3 min-h-10 px-4 text-xs"
              onClick={() => setDraft((current) => ({
                ...current,
                risks: [...current.risks, { ingredient: '', level: 'Atenção', description: '' }],
              }))}
            >
              Adicionar risco
            </button>
          </fieldset>

          <fieldset className="rounded-xl border border-[#173f35]/10 bg-white p-3 sm:col-span-2">
            <legend className={`${labelClass} px-1`}>Informação nutricional — por 100 g</legend>
            <p className="mb-3 text-xs leading-5 text-[#52625c]">
              Informe todos os nutrientes com valores correspondentes a 100 g do produto. Confira os dados na embalagem.
            </p>
            <div className="space-y-3">
              {draft.nutrition.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-xl bg-[#f8f8f4] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label>
                    <span className={labelClass}>Nutriente</span>
                    <input
                      className={inputClass}
                      placeholder="Ex.: Valor energético"
                      value={item.label}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        nutrition: current.nutrition.map((nutrient, itemIndex) => itemIndex === index
                          ? { ...nutrient, label: event.target.value }
                          : nutrient),
                      }))}
                      required
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Quantidade em 100 g</span>
                    <input
                      className={inputClass}
                      placeholder="Ex.: 12 g ou 350 kcal"
                      value={item.value}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        nutrition: current.nutrition.map((nutrient, itemIndex) => itemIndex === index
                          ? { ...nutrient, value: event.target.value }
                          : nutrient),
                      }))}
                      required
                    />
                  </label>
                  <button
                    type="button"
                    className="justify-self-start text-xs font-bold text-red-700 underline decoration-transparent underline-offset-2 hover:decoration-current sm:mb-2"
                    onClick={() => setDraft((current) => ({
                      ...current,
                      nutrition: current.nutrition.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button mt-3 min-h-10 px-4 text-xs"
              onClick={() => setDraft((current) => ({
                ...current,
                nutrition: [...current.nutrition, { label: '', value: '' }],
              }))}
            >
              Adicionar nutriente
            </button>
          </fieldset>
        </div>
      </details>

      <div className="mt-5 flex justify-end">
        <button className="primary-button" disabled={saving}>
          {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar produto'}
        </button>
      </div>
    </form>
  )
}
