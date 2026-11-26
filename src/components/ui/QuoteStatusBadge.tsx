import type { QuoteStatus } from '../../types/database'

// Pridobljeno = green, Poslano = yellow, everything else (Osnutek, Izgubljeno) = grey
// The only badge colours in the app: yellow, green and grey (soft background, darker text, no border)
export const GREY: React.CSSProperties   = { color: '#52525b', backgroundColor: '#eeeff1' }
export const YELLOW: React.CSSProperties = { color: '#8a6100', backgroundColor: '#fef3cd' }
export const GREEN: React.CSSProperties  = { color: '#267a47', backgroundColor: '#dbfce7' }

const STATUS_COLORS: Record<QuoteStatus, React.CSSProperties> = {
  enquiry:  YELLOW,   // Povpraševanje: a customer is waiting for an offer
  draft:    GREY,
  issued:   YELLOW,   // Izdano: the offer is locked, not sent yet
  sent:     YELLOW,
  won:      GREEN,
  lost:     GREY,
}

export function QuoteStatusBadge({ status, label }: { status: QuoteStatus; label: string }) {
  return (
    <span className="inline-flex items-center px-[7px] py-[3px] rounded-lg text-xs font-semibold whitespace-nowrap"
      style={STATUS_COLORS[status]}>
      {label}
    </span>
  )
}
