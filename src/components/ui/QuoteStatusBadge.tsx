import type { QuoteStatus } from '../../types/database'

// Pridobljeno = green, Poslano = yellow, everything else (Osnutek, Izgubljeno) = grey
export const GREY: React.CSSProperties   = { color: '#52525b', backgroundColor: '#f4f4f5',  border: '1px solid #e4e4e7' }
export const YELLOW: React.CSSProperties = { color: '#874d00', backgroundColor: '#fff3cc',  border: '1px solid #ffe5a0' }
export const GREEN: React.CSSProperties  = { color: '#007d53', backgroundColor: '#e0fced',  border: '1px solid #cbf7e1' }
// overdue (e.g. a quote sent long ago): same softness as the others
export const ORANGE: React.CSSProperties = { color: '#9e3f00', backgroundColor: '#feeee1',  border: '1px solid #fee0c8' }

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
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={STATUS_COLORS[status]}>
      {label}
    </span>
  )
}
