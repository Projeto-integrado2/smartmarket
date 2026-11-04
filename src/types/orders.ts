export type SimulatedPaymentMethod = 'pix' | 'card'

export type SimulatedOrderRequest = {
  items: { product_id: string; quantity: number }[]
  payment_method: SimulatedPaymentMethod
  delivery_requested?: boolean
}

export type SimulatedOrder = {
  order_id: string
  status: 'simulated'
  payment_method: SimulatedPaymentMethod
  subtotal: number
  original_subtotal: number
  discount_total: number
  delivery_requested: boolean
  items: {
    product_id: string
    name: string
    quantity: number
    unit: string
    unit_price: number
    discounted_unit_price: number
    discount_percent: number
    original_line_total: number
    line_total: number
  }[]
}
