import type { QuoteStatus } from '../../types/database'

// Pridobljeno = green, Poslano = yellow, everything else (Osnutek, Izgubljeno) = grey
// The only badge colours in the app: yellow, green and grey (soft background, darker text, no border)
export const GREY: React.CSSProperties   = { color: '#4a4a4a', backgroundColor: '#ececec' }
export const YELLOW: React.CSSProperties = { color: '#907c49', backgroundColor: '#fef3cd' }
export const GREEN: React.CSSProperties  = { color: '#3d6d51', backgroundColor: '#dbfce7' }

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
