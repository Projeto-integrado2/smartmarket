import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { Icon } from '@/components/Icon'
import { getProductIdFromQr } from '@/utils/productQr'

export function Scanner({ openProductById, navigate }: {
  openProductById: (id: string) => void
  navigate: (page: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const mountedRef = useRef(true)
  const scanRunRef = useRef(0)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      scanRunRef.current += 1
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [])

  const stopScan = () => {
    scanRunRef.current += 1
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
  }

  const startScan = async () => {
    if (!videoRef.current || scanning) return
    if (!window.isSecureContext) {
      setError('A câmera exige uma conexão HTTPS ou localhost.')
      return
    }

    setError('')
    setScanning(true)
    const scanRun = ++scanRunRef.current
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      if (!mountedRef.current || scanRun !== scanRunRef.current) return
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, _decodeError, scanControls) => {
          if (!result || scanRun !== scanRunRef.current) return
          scanRunRef.current += 1
          scanControls.stop()
          controlsRef.current = null
          setScanning(false)
          const productId = getProductIdFromQr(result.getText())
          if (!productId) {
            setError('Este QR code não contém um link de produto SmartMarket válido.')
            return
          }
          openProductById(productId)
        },
      )
      if (!mountedRef.current || scanRun !== scanRunRef.current) {
        controls.stop()
        return
      }
      controlsRef.current = controls
    } catch (reason) {
      if (!mountedRef.current || scanRun !== scanRunRef.current) return
      setScanning(false)
      setError(reason instanceof Error && reason.name === 'NotAllowedError'
        ? 'Permita o acesso à câmera para ler o QR code.'
        : 'Não foi possível iniciar a câmera. Verifique a permissão e tente novamente.')
    }
  }

  return (
    <main className="mx-auto flex min-h-[72vh] max-w-[900px] flex-col items-center px-5 py-14 text-center">
      <p className="eyebrow">Leitor de QR code</p>
      <h1 className="section-title mt-2">Aponte para o código do produto</h1>
      <p className="mt-4 max-w-lg leading-7 text-[#68746f]">Autorize o uso da câmera e enquadre um QR code gerado pelo painel SmartMarket.</p>
      <div className="relative mt-10 aspect-[4/3] w-full max-w-[600px] overflow-hidden rounded-[30px] bg-[#173f35] shadow-2xl">
        <video ref={videoRef} className={`h-full w-full object-cover ${scanning ? '' : 'hidden'}`} muted playsInline />
        {!scanning && (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,.12),transparent_60%)]">
            <div className="scan-frame grid h-[62%] w-[52%] place-items-center rounded-2xl">
              <Icon name="qr" size={88} className="text-white/30" strokeWidth={1.2} />
            </div>
          </div>
        )}
        {scanning && <div className="scan-frame pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-2xl"><div className="scan-line absolute left-3 right-3 h-0.5 bg-[#f6c453] shadow-[0_0_12px_#f6c453]" /></div>}
        <p className="absolute bottom-6 left-0 right-0 text-xs font-bold uppercase tracking-[.16em] text-white/75">{scanning ? 'Procurando QR code...' : 'Câmera desligada'}</p>
      </div>
      {error && <p role="alert" className="mt-4 max-w-lg text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {scanning
          ? <button onClick={stopScan} className="secondary-button"><Icon name="close" /> Parar câmera</button>
          : <button onClick={() => void startScan()} className="primary-button"><Icon name="scan" /> Abrir câmera</button>}
        <button onClick={() => navigate('catalog')} className="secondary-button">Buscar manualmente</button>
      </div>
    </main>
  )
}
