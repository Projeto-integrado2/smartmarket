import { Logo } from './Logo'

export function Footer({ navigate }: { navigate: (page: string) => void }) {
  return (
    <footer className="border-t border-[#173f35]/8 bg-[#fffdf8]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <Logo onClick={() => navigate('home')} />
        <p className="max-w-md text-sm leading-6 text-[#77807c]">Projeto acadêmico demonstrativo. Informações, preços e disponibilidade são dados simulados.</p>
        <button onClick={() => navigate('admin')} className="text-left text-sm font-bold text-[#275947] sm:text-right">Acessar painel</button>
      </div>
    </footer>
  )
}
