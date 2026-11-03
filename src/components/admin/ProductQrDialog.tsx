/** Exibe e exporta o QR code público de um produto ativo.
 * Recebe o produto e gera uma imagem PNG, link copiável e versão para impressão.
 */
import { useEffect, useState } from 'react'
import type { Product } from '@/types/product'
import { createProductUrl } from '@/utils/productQr'

export function ProductQrDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const [qrImage, setQrImage] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const productUrl = createProductUrl(product.id)

  useEffect(() => {
    let active = true
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(productUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 360,
    })).then((image) => {
      if (active) setQrImage(image)
    }).catch(() => {
      if (active) setError('Não foi possível gerar o QR code.')
    })
    return () => { active = false }
  }, [productUrl])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl)
      setCopied(true)
      setError('')
    } catch {
      setError('Não foi possível copiar o link neste navegador.')
    }
  }

  const printQr = () => {
    if (!qrImage) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('Permita a abertura de janelas para imprimir o QR code.')
      return
    }

    const document = printWindow.document
    document.title = `QR code - ${product.name}`
    const style = document.createElement('style')
    style.textContent = 'body{font-family:Arial,sans-serif;text-align:center;padding:24px}img{width:320px;height:320px}h1{font-size:20px}p{font-size:14px}'
    const heading = document.createElement('h1')
    heading.textContent = product.name
    const image = document.createElement('img')
    image.src = qrImage
    image.alt = `QR code do produto ${product.name}`
    const id = document.createElement('p')
    id.textContent = product.id
    document.head.append(style)
    document.body.replaceChildren(heading, image, id)
    image.onload = () => {
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10221c]/55 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="product-qr-title" className="w-full max-w-md rounded-[26px] bg-white p-6 text-center shadow-2xl">
        <div className="flex items-start justify-between gap-4 text-left">
          <div>
            <p className="eyebrow">Etiqueta do produto</p>
            <h2 id="product-qr-title" className="mt-1 text-xl font-extrabold text-[#173f35]">{product.name}</h2>
            <p className="mt-1 text-xs text-[#68746f]">{product.id}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#edf3ee]" aria-label="Fechar QR code">×</button>
        </div>

        {qrImage ? <img src={qrImage} alt={`QR code do produto ${product.name}`} className="mx-auto mt-5 h-64 w-64" /> : <p className="py-24 text-sm text-[#68746f]">Gerando QR code...</p>}
        <p className="break-all text-xs text-[#68746f]">{productUrl}</p>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <a
            href={qrImage || undefined}
            download={`smartmarket-${product.id}-qr.png`}
            className={`secondary-button justify-center px-2 ${!qrImage ? 'pointer-events-none opacity-50' : ''}`}
          >Baixar PNG</a>
          <button onClick={() => void copyLink()} className="secondary-button justify-center px-2">{copied ? 'Copiado!' : 'Copiar link'}</button>
          <button onClick={printQr} disabled={!qrImage} className="primary-button justify-center px-2 disabled:opacity-50">Imprimir</button>
        </div>
        <p className="mt-4 text-left text-xs leading-5 text-[#68746f]">O QR code abre os dados atuais do produto. Se o produto for arquivado, o link deixa de ficar disponível.</p>
      </section>
    </div>
  )
}
