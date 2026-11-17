interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  dark?: boolean
  mono?: boolean
}

/**
 * Fenestrio mark: a solid round-topped window (fenestra) with the frame bar next to it, on a transparent background.
 * Heavy, rounded and simple, so it reads at 16 px as well.
 */
export function FenestrioMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="6 6 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* an arched window (fenestra), solid and round */}
      <path d="M9.5 31 L9.5 19 A8.5 8.5 0 0 1 26.5 19 L26.5 31 Z" fill="#1f2123" stroke="#1f2123" strokeWidth="3" strokeLinejoin="round" />
      {/* the frame bar next to it */}
      <rect x="29.5" y="14" width="4.5" height="18.5" rx="2.25" fill="#1f2123" />
    </svg>
  )
}

export default function AppLogo({ size = 'md', showName = true, dark = false }: AppLogoProps) {
  const dim = size === 'sm' ? 26 : size === 'md' ? 30 : 40
  const fontSize = size === 'sm' ? 'text-[19px]' : size === 'md' ? 'text-2xl' : 'text-[32px]'
  const textColor = dark ? 'text-white' : 'text-[#1f2123]'

  return (
    <div className="flex items-center gap-2">
      <FenestrioMark size={dim} />
      {showName && (
        <span className={`font-bold tracking-[-0.035em] leading-none ${fontSize} ${textColor}`}>
          fenestrio
        </span>
      )}
    </div>
  )
}
