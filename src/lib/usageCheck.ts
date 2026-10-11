import { supabase } from './supabase'

// Customers referenced by a quote can't be deleted (UI hides delete).
export async function usedCustomerIds(): Promise<Set<string>> {
  const { data } = await supabase.from('quotes').select('customer_id')
  const set = new Set<string>()
  for (const q of (data as { customer_id: string | null }[]) ?? []) if (q.customer_id) set.add(q.customer_id)
  return set
}
