import assert from 'node:assert/strict'
import os from 'node:os'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({
  envDir: os.tmpdir(),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})
const { placeSimulatedOrder, productService } = await server.ssrLoadModule('/src/services/api.ts')

after(async () => {
  await server.close()
})

test('mock checkout returns an order and reduces catalog stock', async () => {
  const product = await productService.get('SM-1042')
  const initialStock = product.stock
  const order = await placeSimulatedOrder({
    payment_method: 'pix',
    items: [{ product_id: product.id, quantity: 2 }],
  })

  assert.equal(order.status, 'simulated')
  assert.equal(order.items[0].quantity, 2)
  assert.equal(order.subtotal, Number((product.price * 2).toFixed(2)))
  assert.equal((await productService.get(product.id)).stock, initialStock - 2)
})

test('mock checkout rejects insufficient stock without partially reducing other items', async () => {
  const milk = await productService.get('SM-1042')
  const pasta = await productService.get('SM-2087')
  const initialMilkStock = milk.stock
  const initialPastaStock = pasta.stock

  await assert.rejects(
    placeSimulatedOrder({
      payment_method: 'card',
      items: [
        { product_id: milk.id, quantity: 1 },
        { product_id: pasta.id, quantity: pasta.stock + 1 },
      ],
    }),
    /Estoque insuficiente/,
  )

  assert.equal((await productService.get(milk.id)).stock, initialMilkStock)
  assert.equal((await productService.get(pasta.id)).stock, initialPastaStock)
})
