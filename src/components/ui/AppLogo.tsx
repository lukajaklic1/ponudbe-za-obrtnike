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
      <path d="M11 2.6 C6 5.6 3.9 9.6 3.9 13.6 C3.9 17.6 6.8 20.7 11 21.3 Z" fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="1.1" strokeLinejoin="round" transform="rotate(-11 11 21.3)" />
      {/* right wing, the mirror image */}
      <path d="M13 2.6 C18 5.6 20.1 9.6 20.1 13.6 C20.1 17.6 17.2 20.7 13 21.3 Z" fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="1.1" strokeLinejoin="round" transform="rotate(11 13 21.3)" />
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
