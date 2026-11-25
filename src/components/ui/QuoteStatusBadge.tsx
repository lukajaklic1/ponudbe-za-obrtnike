import type { QuoteStatus } from '../../types/database'

// Subtle status chips: warm grey fill, black text, no border.
// A small dot keeps the meaning: yellow = waiting on someone, green = won, grey = everything else.
const DOT = { grey: '#b5b2ab', yellow: '#e0a100', green: '#2f9e5b' } as const

const STATUS_DOT: Record<QuoteStatus, keyof typeof DOT> = {
  enquiry:  'yellow',   // Povpraševanje: a customer is waiting for an offer
  downloaded: 'yellow', // Ponudba prenesena: the customer already has the offer
  draft:    'grey',
  issued:   'yellow',   // Izdano: the offer is locked, not sent yet
  sent:     'yellow',
  accepted: 'green',
  won:      'green',
  rejected: 'grey',
  lost:     'grey',
  expired:  'grey',
  frozen:   'grey',
}

export function QuoteStatusBadge({ status, label }: { status: QuoteStatus; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-[#f5f3ef] text-[13px] font-medium text-black whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: DOT[STATUS_DOT[status]] }} />
      {label}
    </span>
  )
}
