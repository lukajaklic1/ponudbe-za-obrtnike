interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  dark?: boolean
  mono?: boolean
}

export default function AppLogo({ size = 'md', showName = true, dark = false, mono: _mono = false }: AppLogoProps) {
  const dim = size === 'sm' ? 26 : size === 'md' ? 28 : 40
  const fontSize = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-3xl'
  const textColor = dark ? 'text-white' : 'text-gray-900'
  const iconColor = dark ? '#ffffff' : '#111111'

  return (
    <div className="flex items-center gap-1.5">
      <svg width={dim} height={dim} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polyline points="26,6 10,20 26,34" stroke={iconColor} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="33,6 17,20 33,34" stroke={iconColor} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
      </svg>

      {showName && (
        <span className={`font-semibold tracking-tight ${fontSize} ${textColor}`}>
          Obrtdesk
        </span>
      )}
    </div>
  )
}
