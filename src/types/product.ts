export type Product = {
  id: string
  name: string
  brand: string
  category: string
  price: number
  unit: string
  image: string
  location: { sector: string; aisle: string; shelf: string }
  description: string
  tags: string[]
  allergens: string[]
  risks: { ingredient: string; level: 'Atenção' | 'Moderado'; description: string }[]
  nutrition: { label: string; value: string }[]
  stock: number
  is_active?: boolean
}
