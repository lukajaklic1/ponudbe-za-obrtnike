export interface Company {
  id: string
  name: string
  currency: string
  // PO/legacy columns still present in DB (unused by QuotePro UI)
  po_prefix: string
  po_next_number: number
  address_street: string | null
  address_city: string | null
  address_postal_code: string | null
  address_country: string | null
  email: string | null
  phone: string | null
  tax_id: string | null
  logo_url: string | null
  bank_name: string | null
  bank_iban: string | null
  // QuotePro: overhead defaults + quote counter
  overhead_material_pct: number
  overhead_mfg_pct: number
  overhead_sga_pct: number
  overhead_logistics_pct: number
  overhead_rd_pct: number
  overhead_profit_pct: number
  // Overhead calculation inputs (cost centres + bases, annual)
  oh_cc_material: number
  oh_cc_manufacturing: number
  oh_cc_sga: number
  oh_cc_logistics: number
  oh_cc_rd: number
  oh_base_material: number
  oh_base_manufacturing: number
  quote_prefix: string
  quote_counter: number
  quote_terms: string | null
  quote_terms_en: string | null
  payment_terms_list: string[]
  legal_form: 'sp' | 'doo' | 'dd' | 'other' | null
  registration_number: string | null
  registry_authority: string | null
  share_capital: number | null
  unpaid_capital: number | null
  default_payment_terms: string | null
  default_valid_days: number
  default_parity: string | null
  invoice_prefix: string
  invoice_counter: number
  invoice_due_days: number
  vat_payer: boolean
  invoice_note: string | null
  oh_updated_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  company_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  is_admin: boolean
  is_active: boolean
  department_id: string | null
  job_title: string | null
  created_at: string
  updated_at: string
}

export type PermModule = 'quotes' | 'customers' | 'price_list'

export interface UserPermission {
  id: string
  user_id: string
  module: PermModule
  can_view: boolean
  can_create: boolean
  can_approve: boolean
  can_pay: boolean
}

export interface InvitationPermission {
  module: UserPermission['module']
  can_view: boolean
  can_create: boolean
  can_approve: boolean
  can_pay: boolean
}

export interface UserInvitation {
  id: string
  company_id: string
  email: string
  token: string
  invited_by: string
  is_admin: boolean
  first_name: string | null
  last_name: string | null
  department_id: string | null
  job_title: string | null
  permissions: InvitationPermission[] | null
  status: 'pending' | 'accepted' | 'revoked'
  created_at: string
  accepted_at: string | null
}

// ─── QuotePro entities ──────────────────────────────────────

export interface Customer {
  id: string
  company_id: string
  name: string
  customer_type: 'person' | 'company'
  first_name: string | null
  last_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  address_street: string | null
  address_city: string | null
  address_postal_code: string | null
  vat_number: string | null
  country: string | null
  payment_terms: string | null
  parity: string | null
  status: 'active' | 'inactive'
  notes: string | null
  created_at: string
  updated_at: string
}

export type QuoteStatus = 'draft' | 'issued' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'won' | 'lost' | 'frozen'
export type LostReason = 'price' | 'time' | 'quality' | 'competitor' | 'other'

export interface Quote {
  id: string
  company_id: string
  customer_id: string
  quote_number: string
  title: string
  status: QuoteStatus
  lost_reason: LostReason | null
  valid_until: string | null
  delivery_date: string | null
  lead_time: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  payment_terms: string | null
  parity: string | null
  notes: string | null
  created_by: string
  assignee_id: string | null
  sent_at: string | null
  snapshot: OfferSnapshot | null
  issued_at: string | null
  pdf_path: string | null
  site_address: string | null
  discount_pct: number
  total_net: number
  total_vat: number
  total_gross: number
  created_at: string
  updated_at: string
}

// Frozen copy of an issued offer (so it never re-reads live price lists).
export interface OfferSnapshot {
  offer: { number: string; title?: string | null; issued_at: string; valid_until: string | null; lead_time: string | null; payment_terms: string | null; parity: string | null; notes: string | null; currency: string; site_address?: string | null; discount_pct?: number }
  customer: { name: string; vat_number: string | null; address: string | null; contact_person: string | null; contact_email: string | null; contact_phone: string | null }
  company: { name: string; address: string | null; tax_id: string | null; legal_form?: string | null; registration_number?: string | null; registry_authority?: string | null; share_capital?: number | null; unpaid_capital?: number | null; email: string | null; phone: string | null; bank_name: string | null; bank_iban: string | null; logo_url: string | null; quote_terms: string | null; quote_terms_en: string | null }
  lines: OfferSnapshotLine[]
  subtotal: number          // sum of line totals (after line discounts)
  discount_amount: number   // quote-level discount
  total_net: number
  vat: { rate: number; base: number; amount: number }[]
  total_gross: number
}
export interface OfferSnapshotLine {
  room: string | null
  name: string
  description: string | null
  unit: string
  quantity: number
  unit_price: number
  discount_pct: number
  vat_rate: number
  total: number
}

// ─── Trades: price list + quote lines ───────────────────────

export type PriceUnit = 'm2' | 'm' | 'pcs' | 'h' | 'lump' | 'l' | 'kg'
export type PriceCategory = 'prep' | 'painting' | 'plaster' | 'facade' | 'decor' | 'material' | 'other'

export interface PriceItem {
  id: string
  company_id: string
  code: string | null
  name: string
  description: string | null
  category: PriceCategory | null
  unit: PriceUnit
  price: number
  vat_rate: number
  is_active: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface QuoteLine {
  id: string
  quote_id: string
  company_id: string
  position: number
  room: string | null
  price_item_id: string | null
  name: string
  description: string | null
  unit: PriceUnit
  quantity: number
  unit_price: number
  discount_pct: number
  vat_rate: number
  total_net: number
  created_at: string
}

export type AttachmentKind = 'cad' | 'email' | 'drawing' | 'bom' | 'other'

export interface QuoteAttachment {
  id: string
  company_id: string
  quote_id: string
  quote_item_id: string | null
  file_name: string
  storage_path: string
  thumb_path: string | null
  file_size: number | null
  kind: AttachmentKind
  uploaded_by: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      companies: { Row: Company; Insert: Omit<Company, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Company, 'id'>> }
      users: { Row: User; Insert: Omit<User, 'created_at' | 'updated_at'>; Update: Partial<Omit<User, 'id'>> }
      user_permissions: { Row: UserPermission; Insert: Omit<UserPermission, 'id'>; Update: Partial<Omit<UserPermission, 'id'>> }
      user_invitations: { Row: UserInvitation; Insert: Omit<UserInvitation, 'id' | 'created_at'>; Update: Partial<Omit<UserInvitation, 'id'>> }
      customers: { Row: Customer; Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Customer, 'id'>> }
      quotes: { Row: Quote; Insert: Omit<Quote, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Quote, 'id'>> }
      price_items: { Row: PriceItem; Insert: Omit<PriceItem, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<PriceItem, 'id'>> }
      quote_lines: { Row: QuoteLine; Insert: Omit<QuoteLine, 'id' | 'created_at'>; Update: Partial<Omit<QuoteLine, 'id'>> }
      jobs: { Row: Job; Insert: Partial<Job> & Pick<Job, 'company_id'>; Update: Partial<Omit<Job, 'id'>> }
      quote_attachments: { Row: QuoteAttachment; Insert: Omit<QuoteAttachment, 'id' | 'created_at'>; Update: Partial<Omit<QuoteAttachment, 'id'>> }
      invoices: { Row: Invoice; Insert: Partial<Invoice> & Pick<Invoice, 'company_id'>; Update: Partial<Omit<Invoice, 'id'>> }
      invoice_lines: { Row: InvoiceLine; Insert: Partial<InvoiceLine> & Pick<InvoiceLine, 'company_id' | 'invoice_id' | 'name'>; Update: Partial<Omit<InvoiceLine, 'id'>> }
      purchase_invoices: { Row: PurchaseInvoice; Insert: Partial<PurchaseInvoice> & Pick<PurchaseInvoice, 'company_id' | 'supplier_name'>; Update: Partial<Omit<PurchaseInvoice, 'id'>> }
    }
  }
}

export type JobStatus = 'planned' | 'in_progress' | 'done' | 'invoiced' | 'cancelled'

export interface Job {
  id: string
  company_id: string
  quote_id: string | null      // null = added by hand, not from a quote
  title: string | null
  site_address: string | null
  value: number | null
  created_by: string | null
  customer_id: string | null
  status: JobStatus
  start_date: string | null   // yyyy-mm-dd
  end_date: string | null
  start_time: string | null  // 'HH:MM' or 'HH:MM:SS' — optional working hours
  end_time: string | null
  assignee_id: string | null
  notes: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

// ─── Računi ─────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'paid' | 'cancelled'
export type InvoiceKind = 'invoice' | 'advance'

export interface Invoice {
  id: string
  company_id: string
  invoice_number: string | null      // set when issued
  kind: InvoiceKind
  status: InvoiceStatus
  customer_id: string | null
  quote_id: string | null
  job_id: string | null
  title: string | null
  issue_date: string                 // yyyy-mm-dd
  service_date: string | null
  service_date_to: string | null
  due_date: string | null
  reference: string | null
  notes: string | null
  discount_pct: number
  total_net: number
  total_vat: number
  total_gross: number
  paid_at: string | null
  sent_at: string | null
  issued_at: string | null
  snapshot: InvoiceSnapshot | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  company_id: string
  position: number
  price_item_id: string | null
  advance_invoice_id: string | null
  name: string
  description: string | null
  unit: string
  quantity: number
  unit_price: number
  discount_pct: number
  vat_rate: number
  total_net: number
  created_at: string
}

// Frozen copy of an issued invoice — the PDF only reads this
export interface InvoiceSnapshot {
  invoice: {
    number: string; kind: InvoiceKind; title: string | null
    issue_date: string; service_date: string | null; service_date_to: string | null; due_date: string | null
    reference: string | null; notes: string | null; currency: string; discount_pct: number
    quote_number: string | null; site_address: string | null
  }
  customer: { name: string; vat_number: string | null; street: string | null; city: string | null; address: string | null; email: string | null }
  company: OfferSnapshot['company'] & { street: string | null; city: string | null; vat_payer: boolean; invoice_note: string | null }
  lines: { name: string; description: string | null; unit: string; quantity: number; unit_price: number; discount_pct: number; vat_rate: number; total: number }[]
  subtotal: number
  discount_amount: number
  total_net: number
  vat: { rate: number; base: number; amount: number }[]
  total_vat: number
  total_gross: number
}

export type PurchaseCategory = 'material' | 'tools' | 'subcontract' | 'fuel' | 'rent' | 'other'

export interface PurchaseInvoice {
  id: string
  company_id: string
  supplier_name: string
  supplier_vat: string | null
  invoice_number: string | null
  category: PurchaseCategory
  issue_date: string | null
  due_date: string | null
  total_net: number | null
  total_vat: number | null
  total_gross: number
  status: 'unpaid' | 'paid'
  paid_at: string | null
  job_id: string | null
  file_path: string | null
  file_name: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
