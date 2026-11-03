import { type FormEvent, useState } from 'react'
import type { CartItem } from '@/types/cart'
import type { SimulatedOrder, SimulatedPaymentMethod } from '@/types/orders'
import { placeSimulatedOrder } from '@/services/api'
import { formatPrice } from '@/utils/format'
import { Icon } from '@/components/Icon'

const paymentOptions: {
  value: SimulatedPaymentMethod
  title: string
  description: string
}[] = [
  { value: 'pix', title: 'Pix', description: 'Nenhum QR Code ou transferência será gerado.' },
  { value: 'card', title: 'Cartão', description: 'Não solicitamos nem armazenamos dados do cartão.' },
  { value: 'cash', title: 'Dinheiro', description: 'Opção registrada apenas para esta demonstração.' },
]

const paymentLabels: Record<SimulatedPaymentMethod, string> = {
  pix: 'Pix',
  card: 'Cartão',
  cash: 'Dinheiro',
}

export function Checkout({
  items,
  onBackToCart,
  onContinueShopping,
  onOrderComplete,
}: {
  items: CartItem[]
  onBackToCart: () => void
  onContinueShopping: () => void
  onOrderComplete: (order: SimulatedOrder) => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<SimulatedPaymentMethod>('pix')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<SimulatedOrder | null>(null)
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || items.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      const result = await placeSimulatedOrder({
        items: items.map(({ product, quantity }) => ({
          product_id: product.id,
          quantity,
        })),
        payment_method: paymentMethod,
      })
      setOrder(result)
      onOrderComplete(result)
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : 'Não foi possível registrar a compra simulada. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-[75vh] max-w-[820px] px-5 py-10 lg:px-8">
      {order ? (
        <section className="rounded-[28px] border border-[#173f35]/10 bg-white p-6 sm:p-9">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#edf3ee] text-[#173f35]">
            <Icon name="check" size={28} />
          </div>
          <p className="eyebrow mt-5 text-center">Simulação concluída</p>
          <h1 className="mt-2 text-center text-3xl font-extrabold tracking-[-.04em] text-[#173f35]">Compra simulada registrada</h1>
          <div className="mt-6 rounded-2xl border border-[#d88931]/25 bg-[#fff7e5] p-4 text-sm leading-6 text-[#684410]" role="status">
            Nenhum pagamento foi processado. Este pedido é acadêmico; o estoque cadastrado no catálogo foi reduzido apenas para representar a venda simulada.
          </div>
          <dl className="mt-6 grid gap-3 rounded-2xl bg-[#f8f8f4] p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#52625c]">Número do pedido simulado</dt>
              <dd className="mt-1 break-all font-extrabold text-[#173f35]">{order.order_id}</dd>
            </div>
            <div>
              <dt className="text-[#52625c]">Pagamento escolhido</dt>
              <dd className="mt-1 font-extrabold text-[#173f35]">{paymentLabels[order.payment_method]}</dd>
            </div>
          </dl>
          <ul className="mt-5 divide-y divide-[#173f35]/10">
            {order.items.map((item) => (
              <li key={item.product_id} className="flex justify-between gap-4 py-3 text-sm">
                <span className="text-[#52625c]">{item.quantity} × {item.name}</span>
                <strong className="shrink-0 text-[#173f35]">{formatPrice(item.line_total)}</strong>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between border-t border-[#173f35]/10 pt-4 text-lg font-extrabold text-[#173f35]">
            <span>Total simulado</span><span>{formatPrice(order.subtotal)}</span>
          </p>
          <button onClick={onContinueShopping} className="primary-button mt-7 w-full">Voltar à loja</button>
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-[28px] border border-[#173f35]/10 bg-white p-8 text-center">
          <h1 className="text-2xl font-extrabold text-[#173f35]">Seu carrinho está vazio</h1>
          <p className="mt-2 text-sm text-[#52625c]">Adicione produtos antes de iniciar a finalização.</p>
          <button onClick={onContinueShopping} className="primary-button mt-6">Voltar à loja</button>
        </section>
      ) : (
        <>
          <button type="button" onClick={onBackToCart} className="mb-6 flex items-center gap-2 text-sm font-bold text-[#52625c] hover:text-[#173f35]">
            <Icon name="back" size={18} /> Voltar ao carrinho
          </button>
          <p className="eyebrow">Etapa final · demonstração acadêmica</p>
          <h1 className="section-title !text-4xl">Revisar compra</h1>
          <p className="mt-3 text-sm leading-6 text-[#52625c]">
            Confira os itens e selecione uma forma de pagamento fictícia. Não há cobrança nem coleta de dados financeiros.
          </p>

          <section className="mt-7 rounded-[24px] border border-[#173f35]/10 bg-white p-5 sm:p-7" aria-labelledby="checkout-items-title">
            <h2 id="checkout-items-title" className="text-lg font-extrabold text-[#173f35]">Itens do pedido</h2>
            <ul className="mt-3 divide-y divide-[#173f35]/10">
              {items.map(({ product, quantity }) => (
                <li key={product.id} className="flex justify-between gap-4 py-3 text-sm">
                  <span className="text-[#52625c]">{quantity} × {product.name} <span className="text-xs">({product.unit})</span></span>
                  <strong className="shrink-0 text-[#173f35]">{formatPrice(product.price * quantity)}</strong>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-[#173f35]/10 pt-4 font-extrabold text-[#173f35]">
              <span>Total estimado</span><span>{formatPrice(subtotal)}</span>
            </p>
            <p className="mt-2 text-xs leading-5 text-[#52625c]">O servidor confirma preço e estoque atuais antes de registrar a simulação.</p>
          </section>

          <form onSubmit={submit} className="mt-6 rounded-[24px] border border-[#173f35]/10 bg-white p-5 sm:p-7">
            <fieldset>
              <legend className="text-lg font-extrabold text-[#173f35]">Forma de pagamento</legend>
              <div className="mt-4 space-y-3">
                {paymentOptions.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#173f35]/10 p-4 has-[:checked]:border-[#173f35] has-[:checked]:bg-[#f4f7f3]">
                    <input
                      className="mt-1 accent-[#173f35]"
                      type="radio"
                      name="payment-method"
                      value={option.value}
                      checked={paymentMethod === option.value}
                      onChange={() => setPaymentMethod(option.value)}
                    />
                    <span>
                      <strong className="block text-sm text-[#173f35]">{option.title}</strong>
                      <span className="mt-1 block text-xs leading-5 text-[#52625c]">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="mt-5 rounded-xl bg-[#fff7e5] px-4 py-3 text-xs leading-5 text-[#684410]">
              Ao confirmar, o estoque cadastrado no catálogo será reduzido apenas para representar a venda simulada. Nenhum pagamento será efetuado.
            </p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}
            <button type="submit" disabled={submitting} className="primary-button mt-5 w-full disabled:cursor-wait disabled:opacity-60">
              {submitting ? 'Registrando simulação...' : 'Confirmar compra'}
            </button>
          </form>
        </>
      )}
    </main>
  )
}
