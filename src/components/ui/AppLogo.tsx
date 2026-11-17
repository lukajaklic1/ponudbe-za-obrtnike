interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  dark?: boolean
  mono?: boolean
}

/**
 * Fenestrio mark: one solid arch (a window, fenestra) cut by a slanted slit, in the spirit of a bold single-shape mark.
 * Heavy, rounded and simple, so it reads at 16 px as well.
 */
export function FenestrioMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size * 19 / 20.8} height={size} viewBox="2.5 1.7 19 20.8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* one solid arch (fenestra) cut by two parallel slanted slits, like a sash tilting open; the slits are transparent */}
      <defs>
        <mask id="fenestrio-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#ffffff" />
          <path d="M0 18.6 L24 13.4" stroke="#000000" strokeWidth="2.1" />
          <path d="M0 12.3 L24 7.1" stroke="#000000" strokeWidth="2.1" />
        </mask>
      </defs>
      <path mask="url(#fenestrio-cut)" d="M3 19.4 V11.2 A9 9 0 0 1 21 11.2 V19.4 A2.6 2.6 0 0 1 18.4 22 H5.6 A2.6 2.6 0 0 1 3 19.4 Z" fill="#1f2123" />
    </svg>
  )
}

export default function AppLogo({ size = 'md', showName = true, dark = false }: AppLogoProps) {
  const dim = size === 'sm' ? 22 : size === 'md' ? 28 : 36
  const fontSize = size === 'sm' ? 'text-[19px]' : size === 'md' ? 'text-2xl' : 'text-[32px]'
  const textColor = dark ? 'text-white' : 'text-[#1f2123]'

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
