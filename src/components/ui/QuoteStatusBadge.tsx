import type { QuoteStatus } from '../../types/database'
import { Badge, type BadgeTone } from './Badge'

// One colour per quote status, used everywhere a status is shown
export const QUOTE_STATUS_TONE: Record<QuoteStatus, BadgeTone> = {
  draft:    'neutral',
  issued:   'yellow',    // older quotes: Izdano = Poslano
  sent:     'yellow',
  accepted: 'green',
  won:      'green',
  rejected: 'neutral',
  lost:     'neutral',
  expired:  'neutral',
  frozen:   'neutral',
}

export function QuoteStatusBadge({ status, label }: { status: QuoteStatus; label: string }) {
  return <Badge tone={QUOTE_STATUS_TONE[status]}>{label}</Badge>
}
