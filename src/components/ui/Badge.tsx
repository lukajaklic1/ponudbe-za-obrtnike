// Pill badge for tables: soft tinted background, 1px border, text in the same
// weight as the table text. Only three colours: green, yellow and olive grey.

export type BadgeTone = 'green' | 'yellow' | 'neutral'

export const BADGE_TONES: Record<BadgeTone, { bg: string; border: string; color: string }> = {
  green:   { bg: '#eefdf3', border: '#c3f6d4', color: '#077a3a' },   // won
  yellow:  { bg: '#fefbe6', border: '#fff0a6', color: '#9a5b0a' },   // sent
  neutral: { bg: '#f1f2ec', border: '#dfe2d5', color: '#3f4338' },   // every grey badge: draft, lost, people
}

export const BADGE_CLASS = 'inline-flex items-center gap-1 h-6 px-2.5 rounded-full border text-xs font-medium leading-none whitespace-nowrap'

export function Badge({ tone, children, className = '' }: { tone: BadgeTone; children: React.ReactNode; className?: string }) {
  const t = BADGE_TONES[tone]
  return (
    <span className={`${BADGE_CLASS} ${className}`} style={{ backgroundColor: t.bg, borderColor: t.border, color: t.color }}>
      {children}
    </span>
  )
}
