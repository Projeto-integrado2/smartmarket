import { type FormEvent, useState } from 'react'
import type { Product } from '@/types/product'
import type { CartItem } from './CartDrawer'
import { isChatDemoMode, sendChatMessage } from '@/services/api'
import { formatPrice } from '@/utils/format'
import { Icon } from './Icon'

type ChatMessage = { from: 'bot' | 'user'; text: string; products?: Product[] }

export function Chatbot({ openProduct, cartItems }: {
  openProduct: (product: Product) => void
  cartItems: CartItem[]
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: 'bot', text: 'Olá! Posso sugerir produtos para sua refeição, ajudar a escolher itens e consultar o que está no seu carrinho.' },
  ])

  const send = async (question: string) => {
    const clean = question.trim()
    if (!clean) return
    setMessages((current) => [...current, { from: 'user', text: clean }])
    setInput('')
    try {
      const reply = await sendChatMessage(clean, cartItems.map(({ product, quantity }) => ({
        product_id: product.id,
        quantity,
      })))
      setMessages((current) => [...current, { from: 'bot', ...reply }])
    } catch {
      setMessages((current) => [...current, { from: 'bot', text: 'Não consegui responder agora. Tente novamente em instantes.' }])
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    send(input)
  }

  return (
    <>
      {open && (
        <section className="chat-panel fixed bottom-24 right-4 z-50 flex h-[min(590px,calc(100vh-120px))] w-[calc(100vw-32px)] max-w-[380px] flex-col overflow-hidden rounded-[26px] border border-[#173f35]/10 bg-[#fffdf8] shadow-[0_25px_75px_rgba(23,63,53,.25)] sm:right-6" aria-label="Assistente de ingredientes">
          <header className="flex items-center justify-between bg-[#173f35] px-5 py-4 text-white">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#f6c453] text-[#173f35]"><Icon name="chat" size={20} /></span><div><h2 className="text-sm font-extrabold">Assistente Smart</h2><p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/60"><span className="h-1.5 w-1.5 rounded-full bg-[#79cf9a]" /> {isChatDemoMode ? 'Respostas demonstrativas' : 'Assistente da API'}</p></div></div>
            <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fechar assistente"><Icon name="close" size={18} /></button>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message, index) => <div key={`${message.from}-${index}`} className={message.from === 'user' ? 'ml-10' : 'mr-7'}>
              <div className={`rounded-[18px] px-4 py-3 text-sm leading-6 ${message.from === 'user' ? 'rounded-br-md bg-[#275947] text-white' : 'rounded-bl-md bg-[#f0eee7] text-[#47554f]'}`}>{message.text}</div>
              {message.products?.map((product) => <button key={product.id} onClick={() => { openProduct(product); setOpen(false) }} className="mt-2 flex w-full items-center gap-3 rounded-[16px] border border-[#173f35]/8 bg-white p-2.5 text-left transition hover:border-[#275947]/30">
                <img src={product.image} alt="" className="h-11 w-11 rounded-xl object-cover" /><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#173f35]">{product.name}</strong><span className="text-[11px] text-[#77807c]">{formatPrice(product.price)}</span></span><Icon name="arrow" size={16} className="text-[#275947]" />
              </button>)}
            </div>)}
          </div>
          {messages.length < 3 && <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3">{['Sugira uma refeição', 'O que combina com meu carrinho?', 'O que é lactose?'].map((prompt) => <button key={prompt} onClick={() => send(prompt)} className="shrink-0 rounded-full border border-[#173f35]/10 bg-white px-3 py-2 text-[11px] font-bold text-[#52625c]">{prompt}</button>)}</div>}
          <form onSubmit={submit} className="flex gap-2 border-t border-[#173f35]/8 bg-white p-3">
            <label className="sr-only" htmlFor="chat-question">Pergunte ao assistente</label>
            <input id="chat-question" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Peça uma sugestão ou pergunte do carrinho..." className="min-w-0 flex-1 rounded-full bg-[#f3f1eb] px-4 text-sm outline-none focus:ring-2 focus:ring-[#275947]/20" />
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f6c453] text-[#173f35] transition hover:bg-[#ffd168]" aria-label="Enviar pergunta"><Icon name="send" size={18} /></button>
          </form>
          <p className="bg-white px-4 pb-3 text-center text-[9px] leading-4 text-[#929894]">Conteúdo educativo. Não substitui orientação médica ou nutricional.</p>
        </section>
      )}
      <button onClick={() => setOpen(!open)} className="fixed bottom-5 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#f6c453] text-[#173f35] shadow-[0_12px_35px_rgba(23,63,53,.3)] transition hover:-translate-y-1 hover:bg-[#ffd168] sm:right-6" aria-label={open ? 'Fechar assistente' : 'Abrir assistente de ingredientes'}>
        <Icon name={open ? 'close' : 'chat'} size={23} strokeWidth={2} />
        {!open && <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-[3px] border-[#fbfaf6] bg-[#e27036]" />}
      </button>
    </>
  )
}
