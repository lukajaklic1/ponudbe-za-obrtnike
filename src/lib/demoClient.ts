// Demo mode: a tiny in-browser stand-in for supabase-js, used when no Supabase
// project is configured in .env.local. Data lives in localStorage and is seeded
// with a sample painting company so every screen can be clicked through.
import { STARTER } from './starterPriceList'
import { buildSnapshot } from './offerSnapshot'
import { lineTotal, quoteTotals } from './quoteTotals'

type Row = Record<string, any>
type DB = Record<string, Row[]>
interface AuthUser { id: string; email: string; password: string }

const DB_KEY = 'obrtdesk-demo-db'
const AUTH_KEY = 'obrtdesk-demo-auth'
const SESSION_KEY = 'obrtdesk-demo-session'

export const DEMO_EMAIL = 'demo@obrtdesk.si'
export const DEMO_PASSWORD = 'demo1234'

const uid = () => (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
const now = () => new Date().toISOString()
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString()

// ─── Persistence ─────────────────────────────────────────────
function load<T>(key: string, fallback: () => T): T {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v) } catch { /* ignore */ }
  const f = fallback(); save(key, f); return f
}
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

let auth: AuthUser[] = load(AUTH_KEY, () => [{ id: 'demo-user', email: DEMO_EMAIL, password: DEMO_PASSWORD }])
let db: DB = load(DB_KEY, seed)
const persist = () => save(DB_KEY, db)

// ─── Seed ────────────────────────────────────────────────────
function seed(): DB {
  const companyId = 'demo-company'
  const userId = 'demo-user'
  const company: Row = {
    id: companyId, name: 'Pleskarstvo Novak s.p.', currency: 'EUR', po_prefix: 'PO', po_next_number: 1,
    address_street: 'Celovška cesta 120', address_city: 'Ljubljana', address_postal_code: '1000', address_country: 'Slovenija',
    email: 'info@pleskarstvo-novak.si', phone: '041 555 123', tax_id: 'SI12345678', logo_url: null,
    bank_name: 'NLB d.d.', bank_iban: 'SI56 0201 0001 2345 678',
    quote_prefix: 'P', quote_counter: 4,
    legal_form: 'sp', registration_number: '1234567000', registry_authority: null, share_capital: null, unpaid_capital: null,
    payment_terms_list: ['30 % avans, ostalo po končanju del', '8 dni po izstavitvi računa', 'Takoj ob končanju del'],
    default_payment_terms: '30 % avans, ostalo po končanju del', default_valid_days: 30, default_parity: null,
    quote_terms: 'Cene so brez DDV, razen kjer je navedeno drugače. Material je vključen v ceno postavk. Dodatna dela se obračunajo po dejanskih količinah in veljavnem ceniku.',
    quote_terms_en: 'Prices exclude VAT unless stated otherwise. Material is included in item prices. Additional work is charged per actual quantities.',
    is_active: true, created_at: daysAgo(200), updated_at: daysAgo(10),
  }
  const user: Row = { id: userId, company_id: companyId, first_name: 'Janez', last_name: 'Novak', email: DEMO_EMAIL, phone: null, is_admin: true, is_active: true, department_id: null, job_title: 'Lastnik', is_super_admin: false, created_at: daysAgo(200), updated_at: daysAgo(200) }

  const customers: Row[] = [
    ['Maja Kovač', 'Maja Kovač', 'maja.kovac@gmail.com', '031 222 333', 'Trubarjeva 14', 'Ljubljana', '1000', null],
    ['Peter Horvat', 'Peter Horvat', 'peter.horvat@siol.net', '040 111 222', 'Gorenjska cesta 5', 'Kranj', '4000', null],
    ['Stanovanjska zadruga Bežigrad', 'Ana Zupan', 'ana.zupan@sz-bezigrad.si', '01 234 56 78', 'Dunajska 50', 'Ljubljana', '1000', 'SI87654321'],
    ['Tina Mlakar', 'Tina Mlakar', 'tina.mlakar@gmail.com', '051 999 888', 'Ob potoku 3', 'Domžale', '1230', null],
  ].map(([name, contact, email, phone, street, city, postal, vat], i) => ({
    id: `demo-cust-${i + 1}`, company_id: companyId, name, customer_type: vat ? 'company' : 'person',
    first_name: vat ? null : String(name).split(' ')[0], last_name: vat ? null : String(name).split(' ').slice(1).join(' '),
    contact_person: vat ? contact : null, email, phone, address: null,
    address_street: street, address_city: city, address_postal_code: postal, vat_number: vat, country: 'Slovenija',
    payment_terms: i === 2 ? '30 dni po izstavitvi računa' : '30 % avans, ostalo po končanju del', parity: null,
    status: 'active', notes: null, created_at: daysAgo(150 - i * 20), updated_at: daysAgo(150 - i * 20),
  }))

  const price_items: Row[] = STARTER.map((x, i) => ({
    id: `demo-pi-${i + 1}`, company_id: companyId, code: x.code, name: x.sl, description: null, category: x.category,
    unit: x.unit, price: x.price, vat_rate: 22, is_active: true, created_by: userId, updated_by: null,
    created_at: daysAgo(180), updated_at: daysAgo(180),
  }))
  const pi = (code: string) => price_items.find(p => p.code === code)!

  type L = [string | null, string, number]
  const quoteDefs: { cust: number; status: string; age: number; site: string; lead: string; disc: number; vat: number; lines: L[] }[] = [
    { cust: 0, status: 'won', age: 70, site: 'Trubarjeva 14, Ljubljana', lead: '4 delovne dni', disc: 0, vat: 9.5, lines: [
      [null, 'P01', 85], ['Dnevna soba', 'G01', 12], ['Dnevna soba', 'B02', 58.4], ['Dnevna soba', 'B03', 24], ['Spalnica', 'B04', 41.6], ['Spalnica', 'B03', 14], [null, 'O02', 1],
    ] },
    { cust: 2, status: 'sent', age: 25, site: 'Dunajska 50, Ljubljana – stopnišče', lead: '10 delovnih dni', disc: 5, vat: 22, lines: [
      ['Stopnišče', 'P01', 140], ['Stopnišče', 'G02', 96], ['Stopnišče', 'B04', 210], ['Stopnišče', 'L02', 36], [null, 'O02', 1],
    ] },
    { cust: 1, status: 'lost', age: 45, site: 'Gorenjska cesta 5, Kranj', lead: '3 tedni', disc: 0, vat: 22, lines: [
      ['Fasada', 'F04', 1], ['Fasada', 'F01', 185], ['Fasada', 'F02', 185], ['Fasada', 'F03', 64],
    ] },
    { cust: 3, status: 'draft', age: 2, site: 'Ob potoku 3, Domžale', lead: '', disc: 0, vat: 9.5, lines: [
      ['Kuhinja', 'B02', 32.5], ['Kuhinja', 'B03', 12.8], ['Otroška soba', 'D01', 9],
    ] },
  ]

  const quotes: Row[] = []
  const quote_lines: Row[] = []
  quoteDefs.forEach((d, qi) => {
    const id = `demo-quote-${qi + 1}`
    const created = daysAgo(d.age)
    const lines = d.lines.map(([room, code, qty]) => {
      const p = pi(code)
      return { room, priceItemId: p.id as string, name: p.name, description: null, unit: p.unit, quantity: qty, unit_price: p.price, discount_pct: 0, vat_rate: d.vat }
    })
    const tot = quoteTotals(lines, d.disc)
    const cust = customers[d.cust]
    const q: Row = {
      id, company_id: companyId, customer_id: cust.id, quote_number: `P-${new Date(created).getFullYear()}-${String(qi + 1).padStart(4, '0')}`,
      title: cust.name, status: d.status, lost_reason: d.status === 'lost' ? 'price' : null,
      valid_until: new Date(Date.parse(created) + 30 * 86400000).toISOString().slice(0, 10), delivery_date: null, lead_time: d.lead || null,
      contact_person: cust.contact_person, contact_email: cust.email, contact_phone: cust.phone, payment_terms: cust.payment_terms, parity: null,
      notes: d.vat === 9.5 ? 'Obračunan znižan DDV 9,5 % za popravila stanovanjskih objektov.' : null,
      created_by: userId, assignee_id: userId, sent_at: d.status !== 'draft' ? created : null, snapshot: null,
      issued_at: d.status !== 'draft' ? created : null, pdf_path: null, site_address: d.site, discount_pct: d.disc,
      total_net: tot.total_net, total_vat: tot.total_vat, total_gross: tot.total_gross, created_at: created, updated_at: created,
    }
    if (d.status !== 'draft') {
      q.snapshot = buildSnapshot(q as any, cust as any, company as any, lines)
      q.snapshot.offer.issued_at = created
    }
    quotes.push(q)
    lines.forEach(({ priceItemId, ...l }, i) => quote_lines.push({ id: `${id}-l${i + 1}`, quote_id: id, company_id: companyId, position: i + 1, price_item_id: priceItemId, ...l, total_net: lineTotal(l), created_at: created }))
  })

  // The won quote is already being painted, so the calendar has something to show
  const day = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
  const jobs: Row[] = quotes.filter(q => q.status === 'won').map((q, i) => ({
    id: `demo-job-${i + 1}`, company_id: companyId, quote_id: q.id, customer_id: q.customer_id, status: 'in_progress',
    start_date: day(-2), end_date: day(3), assignee_id: userId, notes: null, started_at: daysAgo(2), finished_at: null, created_at: q.created_at, updated_at: daysAgo(2),
  }))

  return { companies: [company], users: [user], user_permissions: [], user_invitations: [], customers, price_items, quotes, quote_lines, quote_attachments: [], jobs }
}

// ─── Select parsing (supports "*, customers(name), alias:users!fk(cols)") ──
interface Embed { alias: string; table: string; fk: string; cols: string[] }
function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
function parseSelect(sel: string) {
  const cols: string[] = []; const embeds: Embed[] = []
  for (const tok of splitTop(sel || '*')) {
    const m = tok.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?(?:!inner)?\((.*)\)$/)
    if (m) {
      const table = m[2]
      embeds.push({ alias: m[1] ?? table, table, fk: m[3] ?? table.replace(/s$/, '') + '_id', cols: splitTop(m[4]) })
    } else cols.push(tok)
  }
  return { cols, embeds }
}
function pick(row: Row, cols: string[]): Row {
  if (cols.includes('*') || cols.length === 0) return { ...row }
  const o: Row = {}; for (const c of cols) o[c] = row[c]; return o
}

const DEFAULTS: Record<string, () => Row> = {
  quotes: () => ({ status: 'draft', discount_pct: 0, total_net: 0, total_vat: 0, total_gross: 0, snapshot: null, assignee_id: null, lost_reason: null, sent_at: null, issued_at: null, pdf_path: null }),
  price_items: () => ({ is_active: true, vat_rate: 22, unit: 'm2' }),
  customers: () => ({ status: 'active' }),
  users: () => ({ is_active: true, is_admin: false }),
  invoices: () => ({ kind: 'invoice', status: 'draft', invoice_number: null, discount_pct: 0, total_net: 0, total_vat: 0, total_gross: 0, paid_at: null, sent_at: null, issued_at: null, snapshot: null, reference: null }),
  purchase_invoices: () => ({ status: 'unpaid', category: 'material', paid_at: null, job_id: null, file_path: null, file_name: null }),
  jobs: () => ({ status: 'planned', quote_id: null, customer_id: null, title: null, site_address: null, value: null, start_date: null, end_date: null, start_time: null, end_time: null, assignee_id: null, notes: null, started_at: null, finished_at: null }),
}

// ─── Query builder ───────────────────────────────────────────
type Filter = (r: Row) => boolean
class Query implements PromiseLike<{ data: any; error: any; count?: number }> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private sel = '*'
  private wantReturn = false
  private payload: any = null
  private conflict = 'id'
  private filters: Filter[] = []
  private orders: { col: string; asc: boolean }[] = []
  private lim: number | null = null
  private mode: 'many' | 'single' | 'maybe' = 'many'
  private table: string
  constructor(table: string) { this.table = table }

  select(cols = '*') { if (this.op === 'select') this.sel = cols; else { this.wantReturn = true; this.sel = cols } return this }
  insert(rows: any) { this.op = 'insert'; this.payload = rows; return this }
  upsert(rows: any, opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = rows; this.conflict = opts?.onConflict ?? 'id'; return this }
  update(patch: any) { this.op = 'update'; this.payload = patch; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: any) { this.filters.push(r => r[c] === v); return this }
  // "a.eq.1,b.eq.2" (only eq is needed by the app)
  or(expr: string) {
    const parts = expr.split(',').map(p => { const [c, , ...v] = p.split('.'); return [c, v.join('.')] as const })
    this.filters.push(r => parts.some(([c, v]) => String(r[c]) === v)); return this
  }
  neq(c: string, v: any) { this.filters.push(r => r[c] !== v); return this }
  in(c: string, vs: any[]) { this.filters.push(r => vs.includes(r[c])); return this }
  is(c: string, v: any) { this.filters.push(r => (r[c] ?? null) === v); return this }
  not(c: string, op: string, v: any) { this.filters.push(r => op === 'is' ? (r[c] ?? null) !== v : r[c] !== v); return this }
  gte(c: string, v: any) { this.filters.push(r => r[c] >= v); return this }
  lte(c: string, v: any) { this.filters.push(r => r[c] <= v); return this }
  ilike(c: string, v: string) { const re = new RegExp('^' + v.replace(/%/g, '.*') + '$', 'i'); this.filters.push(r => re.test(String(r[c] ?? ''))); return this }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this }
  limit(n: number) { this.lim = n; return this }
  range(from: number, to: number) { this.lim = to - from + 1; return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybe'; return this }

  private rows(): Row[] { return (db[this.table] ??= []) }
  private match(r: Row) { return this.filters.every(f => f(r)) }

  private shape(list: Row[]) {
    const { cols, embeds } = parseSelect(this.sel)
    return list.map(r => {
      const o = pick(r, cols)
      for (const e of embeds) {
        const ref = r[e.fk]
        if (ref !== undefined) {
          const t = (db[e.table] ?? []).find(x => x.id === ref)
          o[e.alias] = t ? pick(t, e.cols) : null
        } else {
          // reverse relation (one-to-many): child rows pointing at this row
          const back = this.table.replace(/s$/, '') + '_id'
          o[e.alias] = (db[e.table] ?? []).filter(x => x[back] === r.id).map(x => pick(x, e.cols))
        }
      }
      return o
    })
  }

  private exec(): { data: any; error: any } {
    let out: Row[] = []
    if (this.op === 'select') {
      out = this.rows().filter(r => this.match(r))
      for (const o of [...this.orders].reverse()) out.sort((a, b) => {
        const av = a[o.col], bv = b[o.col]
        const c = av == null ? -1 : bv == null ? 1 : typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true })
        return o.asc ? c : -c
      })
      if (this.lim != null) out = out.slice(0, this.lim)
    } else if (this.op === 'insert' || this.op === 'upsert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[]
      for (const p of list) {
        const keys = this.conflict.split(',')
        const existing = this.op === 'upsert' ? this.rows().find(r => keys.every(k => r[k] === p[k])) : undefined
        if (existing) { Object.assign(existing, p, { updated_at: now() }); out.push(existing) }
        else {
          const row = { ...(DEFAULTS[this.table]?.() ?? {}), id: uid(), created_at: now(), updated_at: now(), ...p }
          this.rows().push(row); out.push(row)
        }
      }
      persist()
    } else if (this.op === 'update') {
      out = this.rows().filter(r => this.match(r))
      for (const r of out) Object.assign(r, this.payload)
      if (this.table === 'quotes') syncJobs()
      if (this.table === 'invoices') for (const r of out) invoiceMarksJob(r)
      persist()
    } else if (this.op === 'delete') {
      out = this.rows().filter(r => this.match(r))
      db[this.table] = this.rows().filter(r => !this.match(r))
      if (this.table === 'quotes') { const ids = new Set(out.map(r => r.id)); for (const t of ['quote_lines', 'quote_attachments', 'jobs']) db[t] = (db[t] ?? []).filter(r => !ids.has(r.quote_id)) }
      persist()
    }
    if (this.op !== 'select' && !this.wantReturn) return { data: null, error: null }
    const shaped = this.shape(out)
    if (this.mode === 'single') return shaped.length === 1 ? { data: shaped[0], error: null } : { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
    if (this.mode === 'maybe') return { data: shaped[0] ?? null, error: null }
    return { data: shaped, error: null }
  }

  then<A = any, B = never>(ok?: ((v: { data: any; error: any }) => A | PromiseLike<A>) | null, fail?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.exec()).then(ok, fail)
  }
}

// ─── Auth ────────────────────────────────────────────────────
type Session = { access_token: string; token_type: string; user: { id: string; email: string } }
type Listener = (event: string, session: Session | null) => void
const listeners = new Set<Listener>()
let session: Session | null = load<Session | null>(SESSION_KEY, () => null)
function setSession(s: Session | null, event: string) {
  session = s
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  for (const l of listeners) l(event, s)
}
const mkSession = (u: AuthUser): Session => ({ access_token: 'demo', token_type: 'bearer', user: { id: u.id, email: u.email } })
const me = () => (db.users ?? []).find(u => u.id === session?.user.id)
const myCompanyId = () => me()?.company_id as string | undefined

// ─── RPC ─────────────────────────────────────────────────────
function rpc(fn: string, a: Record<string, any> = {}): { data: any; error: any } {
  const cid = myCompanyId()
  const quotes = (db.quotes ?? []).filter(q => q.company_id === cid
    && (!a.p_customer_id || q.customer_id === a.p_customer_id)
    && (!a.p_assignee_id || q.assignee_id === a.p_assignee_id))
  const sentish = (q: Row) => ['sent', 'won', 'lost'].includes(q.status)
  const sum = (l: Row[]) => Math.round(l.reduce((s, q) => s + Number(q.total_net || 0), 0) * 100) / 100

  switch (fn) {
    case 'is_super_admin': return { data: false, error: null }
    case 'handle_onboarding': {
      if (!session) return { data: null, error: { message: 'Not signed in' } }
      if (me()) return { data: null, error: null }
      const companyId = uid()
      db.companies.push({ id: companyId, name: a.p_company_name, currency: 'EUR', po_prefix: 'PO', po_next_number: 1, address_street: null, address_city: null, address_postal_code: null, address_country: null, email: null, phone: null, tax_id: null, logo_url: null, bank_name: null, bank_iban: null, quote_prefix: 'P', quote_counter: 0, quote_terms: null, quote_terms_en: null, is_active: true, created_at: now(), updated_at: now() })
      db.users.push({ id: session.user.id, company_id: companyId, first_name: a.p_first_name, last_name: a.p_last_name, email: session.user.email, phone: null, is_admin: true, is_active: true, department_id: null, job_title: null, is_super_admin: false, created_at: now(), updated_at: now() })
      persist(); return { data: companyId, error: null }
    }
    case 'generate_invoice_number': {
      const c = db.companies.find(x => x.id === a.p_company_id)
      if (!c) return { data: null, error: { message: 'forbidden' } }
      const y = new Date().getFullYear()
      c.invoice_counter = c.invoice_year === y ? (c.invoice_counter ?? 0) + 1 : 1
      c.invoice_year = y
      persist()
      return { data: `${c.invoice_prefix || 'R'}-${y}-${String(c.invoice_counter).padStart(4, '0')}`, error: null }
    }
    case 'generate_quote_number': {
      const c = db.companies.find(x => x.id === a.p_company_id)
      if (!c) return { data: null, error: { message: 'forbidden' } }
      c.quote_counter = (c.quote_counter ?? 0) + 1; persist()
      return { data: `${c.quote_prefix || 'P'}-${new Date().getFullYear()}-${String(c.quote_counter).padStart(4, '0')}`, error: null }
    }
    case 'get_quote_dashboard_stats': {
      const recent = quotes.filter(q => Date.parse(q.created_at) >= Date.now() - 90 * 86400000)
      const won = recent.filter(q => q.status === 'won').length, lost = recent.filter(q => q.status === 'lost').length
      const month = new Date().toISOString().slice(0, 7)
      return { data: {
        pipeline_value: sum(quotes.filter(sentish)),
        win_rate: won + lost ? Math.round(won / (won + lost) * 1000) / 10 : 0,
        won_90d: won, lost_90d: lost,
        active_quotes: quotes.filter(sentish).length,
        realized_this_month: sum(quotes.filter(q => q.status === 'won' && q.created_at.slice(0, 7) === month)),
      }, error: null }
    }
    case 'get_quote_trends': {
      const months = a.p_months ?? 12
      const out = []
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
        const key = d.toISOString().slice(0, 7)
        const inM = quotes.filter(q => q.created_at.slice(0, 7) === key)
        out.push({ period: key, sent_count: inM.filter(sentish).length, sent_value: sum(inM.filter(sentish)), realized_count: inM.filter(q => q.status === 'won').length, realized_value: sum(inM.filter(q => q.status === 'won')) })
      }
      return { data: out, error: null }
    }
    case 'get_customer_stats': {
      const data = (db.customers ?? []).filter(c => c.company_id === cid).map(c => {
        const qs = quotes.filter(q => q.customer_id === c.id && (!a.p_status || q.status === a.p_status))
        const sent = qs.filter(sentish), won = qs.filter(q => q.status === 'won')
        return { customer_id: c.id, customer_name: c.name, sent_value: sum(sent), realized_value: sum(won), sent_count: sent.length, realized_count: won.length, win_rate: sent.length ? Math.round(won.length / sent.length * 1000) / 10 : 0 }
      }).sort((x, y) => y.sent_value - x.sent_value)
      return { data, error: null }
    }
    case 'set_user_active': { const u = db.users.find(x => x.id === a.p_user_id); if (u) u.is_active = a.p_active; persist(); return { data: null, error: null } }
    case 'set_user_admin': { const u = db.users.find(x => x.id === a.p_user_id); if (u) u.is_admin = a.p_is_admin; persist(); return { data: null, error: null } }
    default: return { data: null, error: { message: `Demo način: funkcija ${fn} ni na voljo` } }
  }
}

// ─── Storage (in-memory blobs; uploads last until page reload) ───
const files = new Map<string, Blob>()
const storage = {
  from: (_bucket: string) => ({
    upload: async (path: string, file: Blob) => { files.set(path, file); return { data: { path }, error: null } },
    download: async (path: string) => files.has(path) ? { data: files.get(path)!, error: null } : { data: null, error: { message: 'Not found' } },
    remove: async (paths: string[]) => { paths.forEach(p => files.delete(p)); return { data: null, error: null } },
    createSignedUrl: async (path: string) => files.has(path) ? { data: { signedUrl: URL.createObjectURL(files.get(path)!) }, error: null } : { data: null, error: { message: 'Not found' } },
    getPublicUrl: (path: string) => ({ data: { publicUrl: files.has(path) ? URL.createObjectURL(files.get(path)!) : '' } }),
  }),
}

// ─── Client ──────────────────────────────────────────────────
export const demoClient: any = {
  from: (table: string) => new Query(table),
  rpc: (fn: string, args?: Record<string, any>) => Promise.resolve().then(() => rpc(fn, args)),
  storage,
  functions: { invoke: async () => ({ data: null, error: { message: 'Demo način: vabila po e-pošti niso na voljo' } }) },
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
    onAuthStateChange: (cb: Listener) => {
      listeners.add(cb)
      queueMicrotask(() => cb('INITIAL_SESSION', session))
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const u = auth.find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password)
      if (!u) return { data: { session: null, user: null }, error: { message: 'Napačen e-naslov ali geslo' } }
      setSession(mkSession(u), 'SIGNED_IN'); return { data: { session, user: session!.user }, error: null }
    },
    signUp: async ({ email, password }: { email: string; password: string }) => {
      if (auth.some(x => x.email.toLowerCase() === email.trim().toLowerCase())) return { data: { session: null, user: null }, error: { message: 'Uporabnik s tem e-naslovom že obstaja' } }
      const u = { id: uid(), email: email.trim(), password }
      auth = [...auth, u]; save(AUTH_KEY, auth)
      setSession(mkSession(u), 'SIGNED_IN'); return { data: { session, user: session!.user }, error: null }
    },
    signOut: async () => { setSession(null, 'SIGNED_OUT'); return { error: null } },
    updateUser: async (attrs: { password?: string }) => {
      if (attrs.password && session) { auth = auth.map(x => x.id === session!.user.id ? { ...x, password: attrs.password! } : x); save(AUTH_KEY, auth) }
      return { data: { user: session?.user ?? null }, error: null }
    },
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  },
}

export function resetDemo() {
  for (const k of [DB_KEY, AUTH_KEY, SESSION_KEY]) try { localStorage.removeItem(k) } catch { /* ignore */ }
  location.href = '/login'
}

// Mirrors the quote_won_creates_job trigger: won quote → job; reverting removes an untouched job
function syncJobs() {
  const jobs = (db.jobs ??= [])
  for (const q of db.quotes ?? []) {
    const job = jobs.find(j => j.quote_id === q.id)
    if (q.status === 'won' && !job) {
      jobs.push({ ...DEFAULTS.jobs(), id: uid(), company_id: q.company_id, quote_id: q.id, customer_id: q.customer_id, assignee_id: q.assignee_id, created_at: now(), updated_at: now() })
    } else if (q.status !== 'won' && job && job.status === 'planned' && !job.start_date && !job.end_date) {
      db.jobs = (db.jobs ?? []).filter(j => j !== job)
    }
  }
  persist()
}

syncJobs()   // older demo databases have no jobs yet

// Mirrors the invoice_issued_marks_job trigger
function invoiceMarksJob(inv: Row) {
  if (!inv.job_id || inv.kind !== 'invoice' || !['issued', 'sent', 'paid'].includes(inv.status)) return
  const job = (db.jobs ?? []).find(j => j.id === inv.job_id)
  if (job && ['planned', 'in_progress', 'done'].includes(job.status)) { job.status = 'invoiced'; job.finished_at ??= now(); persist() }
}

// Older demo databases: invoice settings + a few supplier invoices to look at
;(function ensureInvoiceDemo() {
  const c = db.companies?.[0]
  if (!c || c.invoice_prefix) return
  Object.assign(c, { invoice_prefix: 'R', invoice_counter: 0, invoice_year: null, invoice_due_days: 8, vat_payer: true, invoice_note: 'Hvala za zaupanje! Pri plačilu navedite sklic.' })
  const job = (db.jobs ?? [])[0]
  db.invoices ??= []; db.invoice_lines ??= []
  db.purchase_invoices = [
    { supplier_name: 'Jub d.o.o.', invoice_number: '2026-04512', category: 'material', issue_date: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), due_date: new Date(Date.now() + 24 * 864e5).toISOString().slice(0, 10), total_gross: 412.3, total_vat: 74.35, total_net: 337.95, status: 'unpaid', job_id: job?.id ?? null },
    { supplier_name: 'Merkur trgovina d.o.o.', invoice_number: 'MR-88213', category: 'tools', issue_date: new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10), due_date: new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10), total_gross: 129.9, total_vat: 23.42, total_net: 106.48, status: 'unpaid', job_id: null },
    { supplier_name: 'Petrol d.d.', invoice_number: 'P-55102', category: 'fuel', issue_date: new Date(Date.now() - 12 * 864e5).toISOString().slice(0, 10), due_date: null, total_gross: 86.4, total_vat: 15.58, total_net: 70.82, status: 'paid', paid_at: new Date(Date.now() - 12 * 864e5).toISOString().slice(0, 10), job_id: null },
  ].map((b, i) => ({ ...DEFAULTS.purchase_invoices(), id: `demo-bill-${i + 1}`, company_id: c.id, supplier_vat: null, notes: null, file_path: null, file_name: null, created_by: 'demo-user', created_at: now(), updated_at: now(), ...b }))
  persist()
})()
