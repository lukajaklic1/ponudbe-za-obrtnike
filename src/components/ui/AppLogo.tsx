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
    <svg width={size} height={size} viewBox="9.6 10.6 22.3 21.8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* an arched window (fenestra): slim arch, a fine mullion, the frame bar beside it */}
      <path d="M11 31 L11 18.5 A6.5 6.5 0 0 1 24 18.5 L24 31 Z" fill="#1f2123" stroke="#1f2123" strokeWidth="2" strokeLinejoin="round" />
      <line x1="17.5" y1="15" x2="17.5" y2="30.2" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="28" y="15" width="3.5" height="17" rx="1.75" fill="#1f2123" />
    </svg>
  )
}

export default function AppLogo({ size = 'md', showName = true, dark = false }: AppLogoProps) {
  // the mark is as tall as the letters (baseline to the top of the f)
  const dim = size === 'sm' ? 15 : size === 'md' ? 19 : 25
  const fontSize = size === 'sm' ? 'text-[19px]' : size === 'md' ? 'text-2xl' : 'text-[32px]'
  const textColor = dark ? 'text-white' : 'text-[#1f2123]'

  return (
    <div className="flex items-baseline gap-1.5">
      <FenestrioMark size={dim} />
      {showName && (
        <span className={`font-bold tracking-[-0.035em] leading-none ${fontSize} ${textColor}`}>
          fenestrio
        </span>
      )}
    </div>
  )
}
