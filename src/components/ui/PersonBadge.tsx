// Muted avatar colours (Levelpath style); every person always gets the same one, picked from the name
const AVATAR_COLORS = ['#2f7d6d', '#b8457a', '#5a5fc4', '#b7782a', '#3a78b5', '#7c56a8', '#5f7a32', '#c0533f']

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
export function avatarColor(name: string) {
  let h = 0
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/** Round avatar with the person's initials. */
export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 select-none"
      style={{ backgroundColor: avatarColor(name), width: size, height: size, fontSize: Math.round(size * 0.42), letterSpacing: '0.02em' }}>
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
