import type { QuoteStatus } from '../../types/database'

// Pridobljeno = green, Poslano = yellow, everything else (Osnutek, Izgubljeno) = grey
// Levelpath-style tints: soft background, darker text of the same colour, no border
export const GREY: React.CSSProperties   = { color: '#4a4a4a', backgroundColor: '#ececec' }
export const YELLOW: React.CSSProperties = { color: '#8a5c00', backgroundColor: '#fff3c4' }
export const GREEN: React.CSSProperties  = { color: '#267a47', backgroundColor: '#d6fae5' }
export const BLUE: React.CSSProperties   = { color: '#3b6fd8', backgroundColor: '#e5edfc' }
export const PURPLE: React.CSSProperties = { color: '#6a4fb6', backgroundColor: '#efeafc' }
// overdue (e.g. a quote sent long ago): same softness as the others
export const ORANGE: React.CSSProperties = { color: '#a24d16', backgroundColor: '#ffe9d9' }

const STATUS_COLORS: Record<QuoteStatus, React.CSSProperties> = {
  draft:    GREY,
  issued:   YELLOW,   // older quotes: Izdano = Poslano
  sent:     YELLOW,
  accepted: GREEN,
  won:      GREEN,
  rejected: GREY,
  lost:     GREY,
  expired:  GREY,
  frozen:   GREY,
}

export function QuoteStatusBadge({ status, label }: { status: QuoteStatus; label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-[3px] rounded-md text-xs font-medium whitespace-nowrap"
      style={STATUS_COLORS[status]}>
      {label}
    </span>
  )
}
