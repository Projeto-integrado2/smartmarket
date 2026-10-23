import { Icon } from './Icon'

export function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-2.5" aria-label="Ir para o início">
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#173f35] text-[#f6c453] shadow-sm transition-transform group-hover:-rotate-3">
        <Icon name="scan" size={22} strokeWidth={2.2} />
      </span>
      <span className="text-[21px] font-extrabold tracking-[-0.04em] text-[#173f35]">smart<span className="text-[#e99a36]">market</span></span>
    </button>
  )
}
