import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})
const { mockAnswer } = await server.ssrLoadModule('/src/services/mockChat.ts')

after(async () => {
  await server.close()
})

test('mock chat recognizes the meal suggestion quick prompt', () => {
  const reply = mockAnswer('Sugira uma refeição', [])

  assert.ok(reply.text.length > 0)
  assert.ok(reply.products.length > 0)
  assert.ok(reply.products.every((product) => typeof product.id === 'string'))
})

test('mock chat handles an empty cart with product suggestions', () => {
  const reply = mockAnswer('O que combina com meu carrinho?', [])

  assert.match(reply.text, /carrinho está vazio/i)
  assert.ok(reply.products.length > 0)
})

test('mock chat redirects questions about prices at external stores', () => {
  const reply = mockAnswer('Qual o preço de um teclado mecânico na Amazon?', [])

  assert.match(reply.text, /não consulto preços.*lojas externas/i)
  assert.match(reply.text, /catálogo SmartMarket/i)
  assert.deepEqual(reply.products, [])
})
