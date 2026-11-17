interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  dark?: boolean
  mono?: boolean
}

/**
 * Fenestrio mark: one solid round shape cut by two parallel slanted slits, like a sash tilting open (bold single-shape mark).
 * Heavy, rounded and simple, so it reads at 16 px as well.
 */
export function FenestrioMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="2.6 2.6 18.8 18.8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* one solid circle cut by two parallel slanted slits, like sashes tilting open; the slits are transparent */}
      <defs>
        <mask id="fenestrio-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#ffffff" />
          <path d="M0 17.8 L24 12.6" stroke="#000000" strokeWidth="2" />
          <path d="M0 11.4 L24 6.2" stroke="#000000" strokeWidth="2" />
        </mask>
      </defs>
      <circle mask="url(#fenestrio-cut)" cx="12" cy="12" r="9" fill="#131313" />
    </svg>
  )
}

export default function AppLogo({ size = 'md', showName = true, dark = false }: AppLogoProps) {
  const dim = size === 'sm' ? 22 : size === 'md' ? 28 : 36
  const fontSize = size === 'sm' ? 'text-[19px]' : size === 'md' ? 'text-2xl' : 'text-[32px]'
  const textColor = dark ? 'text-white' : 'text-[#131313]'

  return (
    <div className="flex items-center gap-2">
      <span className="-translate-y-[2px]"><FenestrioMark size={dim} /></span>
      {showName && (
        <span className={`font-bold tracking-[-0.035em] leading-none ${fontSize} ${textColor}`}>
          fenestrio
        </span>
      )}
    </div>
  )
}
