/** Gera e valida os links públicos de produto usados nos QR codes.
 * Recebe um ID ou conteúdo lido; retorna URL compartilhável ou ID válido.
 */
export function createProductUrl(productId: string): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin)
  url.searchParams.set('produto', productId)
  return url.toString()
}

export function getProductIdFromQr(value: string): string | null {
  const text = value.trim()
  if (/^[A-Za-z0-9_-]{1,20}$/.test(text)) return text

  try {
    const url = new URL(text)
    if (url.origin !== window.location.origin) return null
    const productId = url.searchParams.get('produto')
    return productId && /^[A-Za-z0-9_-]{1,20}$/.test(productId) ? productId : null
  } catch {
    return null
  }
}
