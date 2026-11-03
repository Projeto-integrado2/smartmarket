export type SimulatedPaymentMethod = 'pix' | 'card' | 'cash'

export type SimulatedOrderRequest = {
  items: { product_id: string; quantity: number }[]
  payment_method: SimulatedPaymentMethod
}

export type SimulatedOrder = {
  order_id: string
  status: 'simulated'
  payment_method: SimulatedPaymentMethod
  subtotal: number
  items: {
    product_id: string
    name: string
    quantity: number
    unit: string
    unit_price: number
    line_total: number
  }[]
}
