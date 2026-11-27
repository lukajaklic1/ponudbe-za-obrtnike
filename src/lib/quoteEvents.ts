// The history of a quote: who did what to it, and when.
// Status changes are written by a trigger in the database, so they are there even when
// the change comes from the public configurator or from SQL. Everything the database
// cannot see as a status change — a saved edit, an attachment, a change of assignee —
// is written from here.
import { supabase } from './supabase'

export type QuoteEventAction =
  | 'created' | 'edited' | 'status' | 'viewed' | 'downloaded'
  | 'assignee' | 'attachment_added' | 'attachment_removed'

export interface QuoteEvent {
  id: string
  actor_id: string | null
  action: string
  from_status: string | null
  to_status: string | null
  meta: Record<string, unknown> | null
  created_at: string
}

/** Writes one line of history. It never breaks the action it records: a failure only warns. */
export async function logQuoteEvent(companyId: string, quoteId: string, action: QuoteEventAction, meta?: Record<string, unknown>) {
  try {
    const actor = (await supabase.auth.getUser()).data.user?.id ?? null
    const { error } = await supabase.from('quote_events' as never).insert({
      company_id: companyId, quote_id: quoteId, actor_id: actor, action, meta: meta ?? null,
    } as never)
    if (error) console.warn('quote event', action, error.message)
  } catch (e) {
    console.warn('quote event', action, e)
  }
}

/** The whole history of one quote, newest first. An empty list when the table is not there yet. */
export async function loadQuoteEvents(quoteId: string): Promise<QuoteEvent[]> {
  const { data, error } = await supabase.from('quote_events' as never)
    .select('id, actor_id, action, from_status, to_status, meta, created_at')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false })
  if (error) { console.warn('quote events', error.message); return [] }
  return (data as unknown as QuoteEvent[]) ?? []
}
