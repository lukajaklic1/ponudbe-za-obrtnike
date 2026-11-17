// One avatar colour for everybody (user choice): deep teal, matches the teal focus of the fields
const AVATAR_COLOR = '#0d5c6e'

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
export function avatarColor(_name?: string) {
  return AVATAR_COLOR
}

/** Round avatar with the person's initials. */
export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 select-none"
      style={{ backgroundColor: avatarColor(name), width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)), letterSpacing: '0.02em' }}>
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
