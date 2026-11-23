// An enquiry from the online configurator counts as new until someone opens it in the app.
export const isNewEnquiry = (q: { source?: string | null; viewed_at?: string | null; status?: string }) => q.source === 'configurator' && !q.viewed_at && (q.status === 'enquiry' || q.status === 'draft')
/** the menu's counters listen to this, so they update right after a quote changes */
export const QUOTES_CHANGED = 'fenestio-quotes-changed'
export const notifyQuotesChanged = () => window.dispatchEvent(new Event(QUOTES_CHANGED))
