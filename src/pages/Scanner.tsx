import { useState } from 'react'
import type { Product } from '@/types/product'
import { Icon } from '@/components/Icon'

export function Scanner({ products, openProduct, navigate }: { products: Product[]; openProduct: (p: Product) => void; navigate: (page: string) => void }) {
  const [scanning, setScanning] = useState(false)
  const startScan = () => {
    setScanning(true)
    window.setTimeout(() => openProduct(products[0]), 1400)
  }
  return (
    <main className="mx-auto flex min-h-[72vh] max-w-[900px] flex-col items-center px-5 py-14 text-center">
      <p className="eyebrow">Leitor demonstrativo</p><h1 className="section-title mt-2">Aponte para o QR Code</h1><p className="mt-4 max-w-lg leading-7 text-[#68746f]">Posicione o código dentro da área indicada. Nesta versão frontend, o botão simula a leitura de um produto.</p>
      <div className="relative mt-10 aspect-[4/3] w-full max-w-[600px] overflow-hidden rounded-[30px] bg-[#173f35] shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.12),transparent_60%)]" />
        <div className="scan-frame absolute left-1/2 top-1/2 h-[62%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-2xl">
          {scanning && <div className="scan-line absolute left-3 right-3 h-0.5 bg-[#f6c453] shadow-[0_0_12px_#f6c453]" />}
          <Icon name="qr" size={88} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/15" strokeWidth={1.2} />
        </div>
        <p className="absolute bottom-6 left-0 right-0 text-xs font-bold uppercase tracking-[.16em] text-white/55">{scanning ? 'Identificando produto...' : 'Câmera pronta'}</p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button disabled={scanning} onClick={startScan} className="primary-button disabled:opacity-60"><Icon name="scan" /> {scanning ? 'Lendo código...' : 'Simular leitura'}</button><button onClick={() => navigate('catalog')} className="secondary-button">Buscar manualmente</button></div>
    </main>
  )
}
