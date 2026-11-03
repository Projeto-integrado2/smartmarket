import { mockProducts } from '@/data/mockProducts'
import type { ChatCartItem, ChatReply } from '@/types/chat'
import type { Product } from '@/types/product'

type MockChatContext = {
  term: string
  cart: { product: Product; quantity: number }[]
}

interface ChatResponseStrategy {
  matches(context: MockChatContext): boolean
  respond(context: MockChatContext): ChatReply
}

const cartStrategy: ChatResponseStrategy = {
  matches: ({ term }) => ['carrinho', 'no carrinho', 'do carrinho', 'coloquei']
    .some((word) => term.includes(word)),
  respond: ({ cart }) => {
    if (cart.length === 0) {
      return {
        text: 'Seu carrinho está vazio no momento. Para começar, você pode adicionar o Espaguete Grano Duro e o Tomate Italiano, que combinam para uma refeição simples.',
        products: mockProducts.filter((product) => ['SM-2087', 'SM-3091'].includes(product.id)),
      }
    }

    const summary = cart.map(({ product, quantity }) => `${quantity} × ${product.name}`).join(', ')
    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
    const complements = mockProducts.filter((product) =>
      !cart.some((item) => item.product.id === product.id) &&
      (product.id === 'SM-3091' || product.id === 'SM-1042'),
    ).slice(0, 2)
    const suggestions = complements.length
      ? ` Para complementar, considere ${complements.map((product) => product.name).join(' e ')}.`
      : ''
    return {
      text: `No seu carrinho há ${summary}. O subtotal demonstrativo desses itens é ${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.${suggestions}`,
      products: complements,
    }
  },
}

const externalStoreStrategy: ChatResponseStrategy = {
  matches: ({ term }) => [
    'amazon', 'mercado livre', 'shopee', 'aliexpress', 'magalu', 'americanas',
    'ebay', 'walmart',
  ].some((store) => term.includes(store)),
  respond: () => ({
    text: 'Não consulto preços ou informações de lojas externas, como a Amazon. Posso ajudar a encontrar produtos ou alternativas no catálogo SmartMarket.',
    products: [],
  }),
}

const suggestionStrategy: ChatResponseStrategy = {
  matches: ({ term }) => [
    'sugest', 'sugir', 'recomend', 'combina', 'ideia', 'o que comprar',
    'o que preparar', 'receita', 'jantar', 'almoço',
  ].some((word) => term.includes(word)),
  respond: () => ({
    text: 'Para uma refeição simples, combine o Espaguete Grano Duro com Tomate Italiano e finalize com alho, azeite e manjericão. O espaguete contém glúten.',
    products: mockProducts.filter((product) => ['SM-2087', 'SM-3091'].includes(product.id)),
  }),
}

const lactoseStrategy: ChatResponseStrategy = {
  matches: ({ term }) => term.includes('lactose') || term.includes('leite'),
  respond: () => ({
    text: 'A lactose é o açúcar natural do leite. Pessoas intolerantes podem sentir desconforto. Para acompanhar o leite, o Café Especial é uma opção do catálogo; confira os rótulos e respeite suas restrições.',
    products: [mockProducts[0], mockProducts[3]],
  }),
}

const glutenStrategy: ChatResponseStrategy = {
  matches: ({ term }) => term.includes('glúten') || term.includes('massa') || term.includes('espaguete'),
  respond: () => ({
    text: 'O Espaguete Grano Duro contém glúten e não é indicado para pessoas com doença celíaca. Para preparar um molho simples, combine-o com Tomate Italiano.',
    products: [mockProducts[1], mockProducts[2]],
  }),
}

const coffeeStrategy: ChatResponseStrategy = {
  matches: ({ term }) => term.includes('café') || term.includes('cafeína'),
  respond: () => ({
    text: 'A cafeína pode afetar o sono quando consumida em excesso. O Café Especial do catálogo combina com Leite Integral; prefira consumir com moderação, especialmente no fim do dia.',
    products: [mockProducts[3], mockProducts[0]],
  }),
}

const tomatoStrategy: ChatResponseStrategy = {
  matches: ({ term }) => term.includes('tomate'),
  respond: () => ({
    text: 'O Tomate Italiano pode ser usado em saladas ou em um molho rápido para acompanhar o Espaguete Grano Duro. Você também pode adicionar alho e manjericão.',
    products: [mockProducts[2], mockProducts[1]],
  }),
}

const defaultStrategy: ChatResponseStrategy = {
  matches: () => true,
  respond: () => ({
    text: 'Sou o assistente do SmartMarket e posso ajudar com produtos, compras, receitas ou seu carrinho. O que você procura?',
    products: [],
  }),
}

const responseStrategies = [
  externalStoreStrategy,
  cartStrategy,
  suggestionStrategy,
  lactoseStrategy,
  glutenStrategy,
  coffeeStrategy,
  tomatoStrategy,
  defaultStrategy,
]

export function mockAnswer(question: string, cartItems: ChatCartItem[]): ChatReply {
  const context: MockChatContext = {
    term: question.toLowerCase(),
    cart: cartItems.flatMap(({ product_id, quantity }) => {
      const product = mockProducts.find((item) => item.id === product_id)
      return product ? [{ product, quantity }] : []
    }),
  }
  const strategy = responseStrategies.find((candidate) => candidate.matches(context))
  if (!strategy) {
    throw new Error('Nenhuma estratégia de resposta do chat está configurada.')
  }
  return strategy.respond(context)
}
