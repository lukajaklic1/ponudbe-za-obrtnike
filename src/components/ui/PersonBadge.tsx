// Avatars: quiet grey circle with the initials everywhere in lists (Levelpath style),
// the black one only for the signed-in person at the bottom of the sidebar.
const BRAND_COLOR = '#f97316'

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
export function avatarColor(_name?: string) {
  return BRAND_COLOR
}

/**
 * Round avatar. `tone="neutral"` (default): light grey circle, thin border, first letter in dark grey.
 * `tone="brand"`: black circle with white initials (only for "you" in the sidebar).
 */
export function Avatar({ name, size = 24, tone = 'neutral' }: { name: string; size?: number; tone?: 'neutral' | 'brand' }) {
  if (tone === 'brand') {
    return (
      <span className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 select-none"
        style={{ backgroundColor: BRAND_COLOR, width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)), letterSpacing: '0.02em' }}>
        {initialsOf(name)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center rounded-full font-medium shrink-0 select-none"
      style={{ backgroundColor: '#f4f4f5', border: '1px solid #e2e2e2', color: '#52525b', width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)), letterSpacing: '0.01em' }}>
      {initialsOf(name)}
    </span>
  )
}

interface PersonBadgeProps {
  name: string
}

/** A person shown as avatar + name, no box around it. */
export function PersonBadge({ name }: PersonBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 whitespace-nowrap">
      <Avatar name={name} />
      {name}
    </span>
  )
}
