import type { QuoteStatus } from '../../types/database'

const STATUS_COLORS: Record<QuoteStatus, React.CSSProperties> = {
  draft:    { color: '#874d00', backgroundColor: '#fff3cc',  border: '1px solid #ffe5a0' },
  issued:   { color: '#6b3fc9', backgroundColor: '#f3edff',  border: '1px solid #e6dbff' },
  sent:     { color: '#215bc4', backgroundColor: '#e5eeff',  border: '1px solid #d9e7ff' },
  accepted: { color: '#007d53', backgroundColor: '#e0fced',  border: '1px solid #cbf7e1' },
  rejected: { color: '#9e3f00', backgroundColor: '#feeee1',  border: '1px solid #fee0c8' },
  expired:  { color: '#874d00', backgroundColor: '#fff3cc',  border: '1px solid #ffe59e' },
  won:      { color: '#007d53', backgroundColor: '#e0fced',  border: '1px solid #cbf7e1' },
  lost:     { color: '#9e3f00', backgroundColor: '#feeee1',  border: '1px solid #fee0c8' },
  frozen:   { color: '#6d28d9', backgroundColor: '#ede9fe',  border: '1px solid #ddd6fe' },
}

export function QuoteStatusBadge({ status, label }: { status: QuoteStatus; label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={STATUS_COLORS[status]}>
      {label}
    </span>
  )
}
