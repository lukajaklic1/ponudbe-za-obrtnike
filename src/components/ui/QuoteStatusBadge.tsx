import type { QuoteStatus } from '../../types/database'

// Pridobljeno = green, Poslano = yellow, everything else (Osnutek, Izgubljeno) = grey
// The badge colours in the app: yellow, green, grey, orange (Povpraševanje) and purple (Izdano) (soft background, darker text, no border)
export const GREY: React.CSSProperties   = { color: '#52525b', backgroundColor: '#eeeff1' }
export const YELLOW: React.CSSProperties = { color: '#8a6100', backgroundColor: '#fef3cd' }
export const GREEN: React.CSSProperties  = { color: '#267a47', backgroundColor: '#dbfce7' }
export const ORANGE: React.CSSProperties = { color: '#9e3f00', backgroundColor: '#feeee1' }
export const PURPLE: React.CSSProperties = { color: '#6b3fc4', backgroundColor: '#f0eafd' }
export const TEAL: React.CSSProperties   = { color: '#0c6b6b', backgroundColor: '#dcf5f4' }
export const PINK: React.CSSProperties   = { color: '#a3195b', backgroundColor: '#fde8f3' }

const STATUS_COLORS: Record<QuoteStatus, React.CSSProperties> = {
  enquiry:  ORANGE,   // Povpraševanje: a customer is waiting for an offer
  measure:  TEAL,     // Izmera: the supplier measures on site
  draft:    GREY,
  issued:   PURPLE,   // Izdano: the offer is locked, not sent yet
  sent:     YELLOW,
  downloaded: PINK,   // Preneseno: the customer downloaded the offer himself
  won:      GREEN,
  lost:     GREY,
}

export function QuoteStatusBadge({ status, label }: { status: QuoteStatus; label: string }) {
  return (
    <span className="inline-flex items-center px-[7px] py-[3px] rounded-lg text-xs font-semibold whitespace-nowrap"
      style={STATUS_COLORS[status] ?? YELLOW}>
      {label}
    </span>
  )
}
