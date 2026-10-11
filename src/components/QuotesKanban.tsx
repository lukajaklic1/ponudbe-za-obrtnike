import { useState } from 'react'
import { Euro, MapPin, UserRound, Building2, FileText, Clock } from 'lucide-react'
import type { Quote, QuoteStatus } from '../types/database'

export interface KanbanQuote extends Quote {
  customers: { name: string } | null
  assignee: { first_name: string; last_name: string } | null
}

// Column dot colours — same hues as the status badges, but solid
const STATUS_DOT: Partial<Record<QuoteStatus, string>> = {
  draft: '#f5b100', issued: '#8b5cf6', sent: '#3b82f6', won: '#10b981', lost: '#f97316',
}

// Status changes allowed by dragging a card. Issuing a draft needs the editor (it locks the PDF content).
export const ALLOWED_MOVES: Partial<Record<QuoteStatus, QuoteStatus[]>> = {
  issued: ['sent'],
  sent: ['won', 'lost'],
}

interface Props {
  statuses: QuoteStatus[]
  quotes: KanbanQuote[]
  canEdit: boolean
  statusLabels: Record<string, string>
  labels: { empty: string; total: string; created: string; validUntil: string; value: string; assignee: string; noAssignee: string; customer: string; site: string; inStatus: string }
  money: (n: number) => string
  waitingDays: (q: Quote) => number | null
  onOpen: (q: KanbanQuote) => void
  onMove: (q: KanbanQuote, to: QuoteStatus) => void
}

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
            className={`flex flex-col flex-1 min-w-[250px] max-h-[calc(100vh-210px)] rounded-xl transition-all duration-150
              ${overCol === st ? 'bg-[#e6eefc] ring-2 ring-inset ring-blue-300' : droppable ? 'bg-[#eef3fc]' : 'bg-gray-50'}
              ${dimmed ? 'opacity-50' : ''}`}>
            {/* Column header */}
            <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_DOT[st] }} />
              <span className="text-sm font-medium text-gray-900">{statusLabels[st]}</span>
              <span className="px-1.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#e5eeff', color: '#215bcf' }}>{cards.length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 flex flex-col gap-2.5 px-2.5 pb-2.5 min-h-[140px] overflow-y-auto">
              {cards.map(q => {
                const movable = canEdit && !!ALLOWED_MOVES[q.status]
                const hasTitle = !!q.title && q.title !== q.customers?.name
                const assignee = q.assignee ? `${q.assignee.first_name} ${q.assignee.last_name}` : null
                return (
                  <div key={q.id} draggable={movable}
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragging(q) }}
                    onDragEnd={() => { setDragging(null); setOverCol(null) }}
                    onClick={() => onOpen(q)}
                    className={`rounded-xl border border-gray-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-gray-300 hover:shadow-[0_2px_6px_rgba(16,24,40,0.06)] transition-all
                      ${movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragging?.id === q.id ? 'opacity-40' : ''}`}>
                    {/* Title */}
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 mt-px rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: '#e5eeff', border: '1px solid #d6e5ff' }}>
                        <FileText className="w-3 h-3" style={{ color: '#215bcf' }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 line-clamp-2">{hasTitle ? q.title : (q.customers?.name ?? '—')}</span>
                    </div>

                    {/* Details */}
                    <div className="flex flex-col gap-2.5 mt-3 text-sm text-gray-900">
                      {hasTitle && <CardRow icon={Building2} title={labels.customer}>{q.customers?.name ?? '—'}</CardRow>}
                      {q.site_address && <CardRow icon={MapPin} title={labels.site}>{q.site_address}</CardRow>}
                      <CardRow icon={Euro} title={labels.value}><span className="font-medium">{money(Number(q.total_net))}</span></CardRow>
                      <CardRow icon={UserRound} title={labels.assignee}>
                        {assignee
                          ? <span className="inline-flex items-center gap-1.5 min-w-0">
                              <span className="flex items-center justify-center rounded-full text-white font-bold shrink-0" style={{ backgroundColor: '#00d17e', width: 18, height: 18, fontSize: 10 }}>{assignee[0].toUpperCase()}</span>
                              <span className="truncate">{assignee}</span>
                            </span>
                          : <span className="text-gray-400">{labels.noAssignee}</span>}
                      </CardRow>
                    </div>

                    {/* Footer: number + days in current status */}
                    <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100 text-xs text-gray-500">
                      <span>{q.quote_number}</span>
                      {(() => {
                        const d = waitingDays(q)
                        if (d == null) return null
                        const color = d >= 14 ? '#9e3f00' : d >= 7 ? '#874d00' : '#6b7280'
                        return <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap" style={{ color }} title={labels.inStatus}><Clock className="w-3.5 h-3.5" />{d} d</span>
                      })()}
                    </div>
                  </div>
                )
              })}
              {cards.length === 0 && <p className="text-xs text-gray-400 text-center py-8">{labels.empty}</p>}
            </div>

            {/* Column total */}
            <div className="px-3.5 pt-1.5 pb-3 text-xs text-gray-500">
              <span className="font-medium text-gray-900">{money(total)}</span> · {labels.total}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CardRow({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0" title={title}>
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  )
}
