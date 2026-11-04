import { type FormEvent, useEffect, useState } from 'react'
import type { AuthSession } from '@/types/auth'
import { loginWithCpf, lookupAccount, registerCustomer } from '@/services/api'
import { Icon } from './Icon'

type Stage = 'cpf' | 'pin' | 'register'

const inputClass = 'w-full rounded-xl border border-[#173f35]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2d6a57] focus:ring-2 focus:ring-[#2d6a57]/10'
const labelClass = 'mb-1.5 block text-xs font-bold text-[#52625c]'

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function AccountDialog({
  open,
  onClose,
  onAuthenticated,
}: {
  open: boolean
  onClose: () => void
  onAuthenticated: (session: AuthSession) => void
}) {
  const [stage, setStage] = useState<Stage>('cpf')
  const [cpf, setCpf] = useState('')
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [address, setAddress] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setStage('cpf')
    setCpf('')
    setName('')
    setAge('')
    setAddress('')
    setPin('')
    setError('')
  }, [open])

  if (!open) return null

  const normalizedCpf = cpf.replace(/\D/g, '')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (stage === 'cpf') {
        const found = await lookupAccount(normalizedCpf)
        setStage(found ? 'pin' : 'register')
        return
      }
      if (stage === 'pin') {
        const session = await loginWithCpf(normalizedCpf, pin)
        onAuthenticated(session)
        onClose()
        return
      }
      const session = await registerCustomer({
        cpf: normalizedCpf,
        name,
        age: Number(age),
        address,
        pin,
      })
      onAuthenticated(session)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir o acesso.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-[26px] bg-[#fffdf8] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{stage === 'register' ? 'Criar cadastro' : 'Acesso opcional'}</p>
            <h2 id="account-dialog-title" className="mt-1 text-2xl font-extrabold tracking-[-.03em] text-[#173f35]">
              {stage === 'register' ? 'Seja bem-vindo' : stage === 'pin' ? 'Entre na sua conta' : 'Identifique-se com CPF'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#68746f]">
              {stage === 'register'
                ? 'Seus dados ficam associados ao cadastro para descontos e histórico de compras.'
                : stage === 'pin'
                  ? 'Informe seu PIN de 6 dígitos para continuar.'
                  : 'Entrar é opcional. Você pode continuar navegando sem cadastro.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-[#edf3ee]" aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {stage === 'cpf' && (
            <label className="block">
              <span className={labelClass}>CPF</span>
              <input className={inputClass} value={formatCpf(cpf)} onChange={(event) => setCpf(event.target.value)} inputMode="numeric" autoComplete="username" maxLength={14} required />
            </label>
          )}
          {stage === 'pin' && (
            <>
              <p className="rounded-xl bg-[#edf3ee] px-4 py-3 text-sm text-[#52625c]">CPF: <strong>{formatCpf(cpf)}</strong></p>
              <label className="block">
                <span className={labelClass}>PIN (6 dígitos)</span>
                <input className={inputClass} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="current-password" minLength={6} maxLength={6} required />
              </label>
            </>
          )}
          {stage === 'register' && (
            <>
              <p className="rounded-xl bg-[#edf3ee] px-4 py-3 text-sm text-[#52625c]">CPF: <strong>{formatCpf(cpf)}</strong></p>
              <label className="block"><span className={labelClass}>Nome</span><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} required /></label>
              <label className="block"><span className={labelClass}>Idade</span><input className={inputClass} type="number" value={age} onChange={(event) => setAge(event.target.value)} min={0} max={120} required /></label>
              <label className="block"><span className={labelClass}>Endereço</span><textarea className={inputClass} value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" maxLength={300} rows={2} required /></label>
              <label className="block"><span className={labelClass}>Crie um PIN de 6 dígitos</span><input className={inputClass} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={6} required /></label>
            </>
          )}
          <button type="submit" className="primary-button w-full" disabled={busy || (stage === 'cpf' && normalizedCpf.length !== 11)}>
            {busy ? 'Aguarde...' : stage === 'cpf' ? 'Continuar' : stage === 'pin' ? 'Entrar' : 'Criar conta'}
          </button>
          {stage !== 'cpf' && <button type="button" onClick={() => { setStage('cpf'); setPin(''); setError('') }} className="w-full py-2 text-sm font-bold text-[#52625c] hover:text-[#173f35]">Voltar</button>}
        </form>

        <button type="button" onClick={onClose} className="mt-4 w-full py-2 text-sm font-bold text-[#52625c] underline underline-offset-4">
          Continuar sem entrar
        </button>
        <p className="mt-3 text-center text-[11px] leading-5 text-[#8a8e8b]">O cadastro é opcional. CPF é armazenado em formato protegido; use um PIN que não utilize em outros serviços.</p>
      </section>
    </div>
  )
}
