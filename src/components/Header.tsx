import { type FormEvent, useState } from 'react'
import { Icon } from './Icon'
import { Logo } from './Logo'

export function Header({
  navigate,
  onSearch,
  dark,
  toggleDark,
}: {
  navigate: (page: string) => void
  onSearch: (value: string) => void
  dark: boolean
  toggleDark: () => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('search')?.toString() ?? ''
    onSearch(value)
  }
  return (
    <header className="sticky top-0 z-40 border-b border-[#173f35]/8 bg-[#fffdf8]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1180px] items-center gap-8 px-5 lg:px-8">
        <Logo onClick={() => navigate('home')} />
        <form onSubmit={submit} className="relative mx-auto hidden w-full max-w-[480px] md:block">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#68746f]" size={19} />
          <input name="search" aria-label="Buscar produtos" placeholder="Busque um produto, marca ou categoria" className="h-11 w-full rounded-full border border-[#173f35]/10 bg-[#f4f2eb] pl-11 pr-4 text-sm outline-none transition focus:border-[#2d6a57] focus:bg-white focus:ring-4 focus:ring-[#2d6a57]/8" />
        </form>
        <nav className="hidden items-center gap-7 lg:flex">
          <button onClick={() => navigate('catalog')} className="nav-link">Produtos</button>
          <button onClick={() => navigate('admin')} className="nav-link">Painel</button>
        </nav>
        <button onClick={toggleDark} className="theme-toggle grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#173f35]/10 bg-white text-[#173f35] transition hover:-translate-y-0.5" aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'} title={dark ? 'Modo claro' : 'Modo escuro'}>
          <Icon name={dark ? 'sun' : 'moon'} size={18} />
        </button>
        <button onClick={() => navigate('scan')} className="hidden h-11 items-center gap-2 rounded-full bg-[#f6c453] px-5 text-sm font-bold text-[#173f35] shadow-[0_5px_16px_rgba(131,91,21,.14)] transition hover:-translate-y-0.5 hover:bg-[#ffd168] sm:flex">
          <Icon name="scan" size={18} strokeWidth={2.2} /> Escanear QR
        </button>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-[#173f35]/10 lg:hidden" aria-label="Abrir menu">
          <Icon name={mobileOpen ? 'close' : 'menu'} />
        </button>
      </div>
      {mobileOpen && (
        <div className="border-t border-[#173f35]/8 bg-[#fffdf8] px-5 py-4 lg:hidden">
          <form onSubmit={submit} className="relative mb-3 md:hidden">
            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#68746f]" size={19} />
            <input name="search" placeholder="Buscar produtos" className="h-11 w-full rounded-full bg-[#f4f2eb] pl-11 pr-4 text-sm outline-none" />
          </form>
          <button onClick={() => { navigate('catalog'); setMobileOpen(false) }} className="mobile-link">Ver produtos <Icon name="arrow" size={17} /></button>
          <button onClick={() => { navigate('admin'); setMobileOpen(false) }} className="mobile-link">Painel administrativo <Icon name="arrow" size={17} /></button>
          <button onClick={toggleDark} className="mobile-link">{dark ? 'Ativar modo claro' : 'Ativar modo escuro'} <Icon name={dark ? 'sun' : 'moon'} size={17} /></button>
        </div>
      )}
    </header>
  )
}
