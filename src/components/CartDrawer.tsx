import type { Product } from '@/types/product'
import { formatPrice } from '@/utils/format'
import { Icon } from './Icon'

export type CartItem = { product: Product; quantity: number }

export function CartDrawer({
  items,
  onClose,
  onChangeQuantity,
  onClear,
  onBrowse,
}: {
  items: CartItem[]
  onClose: () => void
  onChangeQuantity: (product: Product, quantity: number) => void
  onClear: () => void
  onBrowse: () => void
}) {
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0)

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button className="absolute inset-0 bg-[#10221c]/45" onClick={onClose} aria-label="Fechar carrinho" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="relative flex h-full w-full max-w-md flex-col bg-[#fffdf8] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#173f35]/10 px-6 py-5">
          <div>
            <h2 id="cart-title" className="text-xl font-extrabold text-[#173f35]">Meu carrinho</h2>
            <p className="mt-1 text-sm text-[#68746f]">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</p>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#eef3ef]" aria-label="Fechar carrinho">
            <Icon name="close" />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[#eef3ef] text-[#275947]"><Icon name="cart" size={28} /></span>
            <h3 className="mt-5 text-lg font-extrabold text-[#173f35]">Seu carrinho está vazio</h3>
            <p className="mt-2 text-sm leading-6 text-[#68746f]">Explore o catálogo e adicione os produtos que deseja levar.</p>
            <button onClick={onBrowse} className="primary-button mt-6">Explorar catálogo</button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {items.map(({ product, quantity }) => (
                <li key={product.id} className="flex gap-4 border-b border-[#173f35]/8 pb-4">
                  <img src={product.image} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold text-[#173f35]">{product.name}</p>
                    <p className="mt-1 text-sm text-[#68746f]">{formatPrice(product.price)} / {product.unit}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => onChangeQuantity(product, quantity - 1)}
                        className="grid h-8 w-8 place-items-center rounded-full border border-[#173f35]/10"
                        aria-label={`Diminuir quantidade de ${product.name}`}
                      ><Icon name="minus" size={15} /></button>
                      <span className="min-w-5 text-center text-sm font-bold" aria-live="polite">{quantity}</span>
                      <button
                        onClick={() => onChangeQuantity(product, quantity + 1)}
                        disabled={quantity >= product.stock}
                        className="grid h-8 w-8 place-items-center rounded-full border border-[#173f35]/10 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Aumentar quantidade de ${product.name}`}
                      ><Icon name="plus" size={15} /></button>
                      <span className="ml-auto font-extrabold text-[#173f35]">{formatPrice(product.price * quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="border-t border-[#173f35]/10 px-6 py-5">
              <div className="flex justify-between text-base font-extrabold text-[#173f35]">
                <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#68746f]">Valores demonstrativos; o subtotal não inclui possíveis taxas ou descontos.</p>
              <div className="mt-5 flex gap-3">
                <button onClick={onClear} className="secondary-button flex-1">Limpar</button>
                <button onClick={onClose} className="primary-button flex-1">Continuar comprando</button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
