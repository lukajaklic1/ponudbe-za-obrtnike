interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  dark?: boolean
  mono?: boolean
}

/**
 * Fenestrio mark: two solid leaf-shaped sashes (a window with two wings) opening outwards,
 * a straight edge where they close, a soft curve outside, a narrow gap between them.
 * Organic and bold, so it reads at 16 px as well.
 */
export function FenestrioMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* left wing, tilted slightly open */}
      <path d="M10.5 3.4 C6.2 3.4 3.4 7.3 3.4 12 C3.4 16.7 6.2 20.6 10.5 20.6 Z" fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="round" transform="rotate(-6 10.5 20.6)" />
      {/* right wing, the mirror image */}
      <path d="M13.5 3.4 C17.8 3.4 20.6 7.3 20.6 12 C20.6 16.7 17.8 20.6 13.5 20.6 Z" fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="round" transform="rotate(6 13.5 20.6)" />
    </svg>
  )
}

export default function AppLogo({ size = 'md', showName = true, dark = false }: AppLogoProps) {
  const dim = size === 'sm' ? 22 : size === 'md' ? 28 : 36
  const fontSize = size === 'sm' ? 'text-[19px]' : size === 'md' ? 'text-2xl' : 'text-[32px]'
  const textColor = dark ? 'text-white' : 'text-[#1a1a1a]'

  return (
    <div className="flex items-center gap-2">
      <span className="-translate-y-[1px]"><FenestrioMark size={dim} /></span>
      {showName && (
        <span className={`font-bold tracking-[-0.035em] leading-none ${fontSize} ${textColor}`}>
          fenestrio
        </span>
      )}
    </div>
  )
}
