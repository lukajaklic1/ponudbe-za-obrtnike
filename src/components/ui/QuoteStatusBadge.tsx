import { Check } from 'lucide-react'
import type { QuoteStatus } from '../../types/database'

// Subtle coloured pills, no border: green = won (with a check), amber = waiting on someone,
// blue = a new enquiry, grey = draft or closed.
type Tone = 'green' | 'amber' | 'blue' | 'grey'
const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: '#e6f6ea', fg: '#1a7f37' },
  amber: { bg: '#fdf3d8', fg: '#8a5a00' },
  blue:  { bg: '#e8f1fc', fg: '#0157ad' },
  grey:  { bg: '#f6f8fc', fg: '#475467' },
}

const STATUS_TONE: Record<QuoteStatus, Tone> = {
  enquiry:  'blue',     // Povpraševanje: a customer is waiting for an offer
  downloaded: 'amber',  // Ponudba prenesena: the customer already has the offer
  draft:    'grey',
  issued:   'amber',    // Izdano: the offer is locked, not sent yet
  sent:     'amber',
  accepted: 'green',
  won:      'green',
  rejected: 'grey',
  lost:     'grey',
  expired:  'grey',
  frozen:   'grey',
}

export function QuoteStatusBadge({ status, label }: { status: QuoteStatus; label: string }) {
  const tone = STATUS_TONE[status]
  const { bg, fg } = TONES[tone]
  return (
    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[12px] font-medium whitespace-nowrap" style={{ backgroundColor: bg, color: fg }}>
      {tone === 'green' && <Check className="w-3 h-3" strokeWidth={2.5} />}
      {label}
    </span>
  )
}
