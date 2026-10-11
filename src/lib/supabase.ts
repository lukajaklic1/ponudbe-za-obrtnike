import { createClient } from '@supabase/supabase-js'
import { demoClient } from './demoClient'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// No Supabase project configured → run on the in-browser demo database.
export const isDemo = !supabaseUrl || !supabaseAnonKey

const makeClient = () => createClient(supabaseUrl, supabaseAnonKey)

export const supabase: ReturnType<typeof makeClient> = isDemo ? demoClient : makeClient()
