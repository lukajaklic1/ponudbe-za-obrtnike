import { useState } from 'react'
import type { Quote, QuoteStatus } from '../types/database'
import { QuoteStatusBadge } from './ui/QuoteStatusBadge'

export interface KanbanQuote extends Quote {
  customers: { name: string; phone?: string | null } | null
  assignee: { first_name: string; last_name: string } | null
}

// Status changes allowed by dragging a card. Issuing a draft needs the editor (it locks the PDF content).
export const ALLOWED_MOVES: Partial<Record<QuoteStatus, QuoteStatus[]>> = {
  issued: ['sent'],
  sent: ['won', 'lost'],
  downloaded: ['won', 'lost'],
}

interface Props {
  statuses: QuoteStatus[]
  quotes: KanbanQuote[]
  canEdit: boolean
  statusLabels: Record<string, string>
  labels: { empty: string; total: string; created: string; validUntil: string; value: string; assignee: string; noAssignee: string; customer: string; site: string; phone: string; inStatus: string }
  money: (n: number) => string
  waitingDays: (q: Quote) => number | null
  onOpen: (q: KanbanQuote) => void
  onMove: (q: KanbanQuote, to: QuoteStatus) => void
}

/** Quotes as a board (Levelpath look): light grey columns, white cards like table rows, status badge on top of each column. */
export default function QuotesKanban({ statuses, quotes, canEdit, statusLabels, labels, money, waitingDays, onOpen, onMove }: Props) {
  const [dragging, setDragging] = useState<KanbanQuote | null>(null)
  const [overCol, setOverCol] = useState<QuoteStatus | null>(null)
  const canMove = (q: KanbanQuote | null, to: QuoteStatus) => !!q && canEdit && (ALLOWED_MOVES[q.status] ?? []).includes(to)

  function drop(to: QuoteStatus) {
    const q = dragging
    setDragging(null); setOverCol(null)
    if (q && canMove(q, to)) onMove(q, to)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {statuses.map(st => {
        const cards = quotes.filter(q => q.status === st)
        const total = cards.reduce((sum, q) => sum + (Number(q.total_net) || 0), 0)
        const droppable = canMove(dragging, st)
        const dimmed = !!dragging && dragging.status !== st && !droppable
        return (
          <div key={st}
            onDragOver={e => { if (droppable) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverCol(st) } }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(c => (c === st ? null : c)) }}
            onDrop={e => { e.preventDefault(); drop(st) }}
            className={`flex flex-col flex-1 min-w-[260px] max-h-[calc(100vh-230px)] rounded-xl border transition-all duration-150
              ${overCol === st ? 'bg-[#efefef] border-gray-400' : droppable ? 'bg-[#f3f3f3] border-dashed border-gray-300' : 'bg-[#f5f3ef] border-transparent'}
              ${dimmed ? 'opacity-50' : ''}`}>
            {/* Column header: status badge, count, total */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2.5">
              <QuoteStatusBadge status={st} label={statusLabels[st]} />
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-[#e9e8e3] text-[#464646]">{cards.length}</span>
              <span className="ml-auto text-[13px] font-medium text-[#6a6a6a] tabular-nums" title={labels.total}>{money(total)}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 flex flex-col gap-2 px-2 pb-2 min-h-[140px] overflow-y-auto">
              {cards.map(q => {
                const movable = canEdit && !!ALLOWED_MOVES[q.status]
                const assignee = q.assignee ? `${q.assignee.first_name} ${q.assignee.last_name}` : null
                const days = waitingDays(q)
                return (
                  <div key={q.id} draggable={movable}
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragging(q) }}
                    onDragEnd={() => { setDragging(null); setOverCol(null) }}
                    onClick={() => onOpen(q)}
                    className={`rounded-[10px] border border-gray-200 bg-white px-3.5 py-3 hover:border-gray-300 transition-colors
                      ${movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragging?.id === q.id ? 'opacity-40' : ''}`}>
                    {/* number + days in status */}
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[#6a6a6a]">
                      <span>{q.quote_number}</span>
                      {days != null && <span className="ml-auto whitespace-nowrap" title={labels.inStatus}>{days} d</span>}
                    </div>
                    {/* customer + site */}
                    <div className="mt-1.5 text-[15px] font-medium text-gray-900 line-clamp-2">{q.customers?.name ?? '—'}</div>
                    {q.site_address && <div className="mt-0.5 text-[13px] font-medium text-[#6a6a6a] truncate">{q.site_address}</div>}
                    {/* value + assignee */}
                    <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100">
                      <span className="text-[15px] font-medium text-gray-900 tabular-nums">{money(Number(q.total_net))}</span>
                      <span className="ml-auto text-[13px] font-medium text-[#6a6a6a] truncate" title={labels.assignee}>{assignee ?? labels.noAssignee}</span>
                    </div>
                  </div>
                )
              })}
              {cards.length === 0 && <p className="text-[13px] font-medium text-[#6a6a6a] text-center py-8">{labels.empty}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
