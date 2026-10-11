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

export type MachineCategory =
  | 'cnc_milling' | 'cnc_turning' | 'edm' | 'grinding' | 'laser'
  | 'pressing' | 'stamping' | 'bending' | 'welding'
  | 'injection' | 'extrusion' | 'coating' | 'heat_treatment'
  | 'assembly' | 'inspection' | 'other'

export interface EnergyMediaRow {
  name: string
  unit: string
  price_per_unit: number
  consumption_per_h: number
}

export interface Machine {
  id: string
  company_id: string
  name: string
  model: string | null
  category: MachineCategory | null
  energy_media: EnergyMediaRow[]
  // Capacity
  production_days_per_year: number
  shifts_per_day: number
  hours_per_shift: number
  break_min_per_shift: number
  utilization_pct: number
  // Investments
  acquisition_value: number | null
  installation_cost: number
  foundation_cost: number
  additional_cost: number
  residual_value: number
  depreciation_years: number | null
  interest_rate_pct: number | null
  insurance_rate_pct: number | null
  space_m2: number | null
  space_cost_per_m2: number | null
  // Variable
  maintenance_pct: number
  power_production_kw: number
  power_standby_kw: number
  electricity_cost_per_kwh: number
  water_cost_per_year: number
  compressed_air_cost_per_year: number
  tooling_cost_per_year: number
  consumables_cost_per_year: number
  other_variable_per_year: number
  // Rate
  hourly_rate_manual: number | null
  use_manual_rate: boolean
  hourly_rate_computed: number | null
  is_active: boolean
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface LaborRate {
  id: string
  company_id: string
  name: string
  annual_cost: number
  working_days_per_year: number
  vacation_days: number
  shifts_per_day: number
  hours_per_shift: number
  break_min_per_shift: number
  utilization_pct: number
  hourly_rate_computed: number | null
  is_active: boolean
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface Workstation {
  id: string
  company_id: string
  name: string
  hourly_rate: number
  is_active: boolean
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

export interface QuoteItem {
  id: string
  quote_id: string
  company_id: string
  position: number
  part_name: string
  part_number: string | null
  quantity: number
  notes: string | null
  drawing_path: string | null
  thumb_path: string | null
  created_at: string
}

export type MaterialShape = 'sheet' | 'round_bar' | 'rect_bar' | 'round_tube' | 'square_tube' | 'other'

export interface Material {
  id: string
  company_id: string
  name: string
  category: string | null
  density: number        // g/cm³
  price_per_kg: number   // €/kg
  color: string | null
  is_active: boolean
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// JSONB section row shapes (calculations.*)
// Raw material = pick from DB, choose shape + dimensions (mm) → weight (kg) → cost.
export interface RawMaterialRow {
  material_id: string | null
  name: string
  density: number
  price_per_kg: number
  shape: MaterialShape
  length: number
  width: number
  thickness: number
  diameter: number
  wall: number
  manual_weight: number      // for shape 'other' — enter stock weight (kg) directly
  pieces_per_stock: number   // how many finished pieces from one stock (cost ÷ this)
  qty_per_piece?: number     // legacy
  scrap_pct: number
  weight: number
  total: number
}
export interface PurchasedPartRow {
  name: string
  supplier: string
  unit: string
  qty_per_piece: number
  price_per_unit: number
  scrap_pct?: number
  total: number
}
export interface ProcessRow {
  name: string
  // Machine (occupies the cell during run + setup)
  machine_id: string | null
  machine_rate: number
  // Direct operators during the run
  operators: number
  operator_id: string | null
  operator_rate: number
  // Setup — done by one or more technologists/setters
  setup_id: string | null
  setup_rate: number
  setup_qty: number
  setup_min: number
  setup_with_operator: boolean   // operator also present during setup
  batch_size: number             // max pieces per setup (lot); 0 = one setup for whole order
  cycle_min: number
  pieces_per_cycle: number       // cavities / nests (default 1)
  total: number
  // legacy (pre-multi-resource calcs)
  ref_type?: 'machine' | 'workstation'
  ref_id?: string | null
  hourly_rate?: number
}
export interface ToolingRow {
  name: string
  tool_cost: number
  lifetime_pcs: number
  scrap_pct?: number
  cost_per_piece: number
}
export interface InvestmentRow {
  name: string
  value: number
  utilization_pct: number
  project_years: number
  lifetime_pcs: number
  interest_rate_pct: number
  insurance_rate_pct: number
  additional_cost: number
  amortization_per_piece: number
  interest_per_piece: number
  insurance_per_piece: number
  total_per_piece: number
}
export interface PackagingRow {
  name: string
  price_per_unit: number       // price of one packaging unit (box/crate)
  pieces_per_unit?: number     // finished pieces that fit in one packaging unit
  qty_per_piece?: number       // legacy
  total: number
}

export interface Calculation {
  id: string
  quote_item_id: string
  company_id: string
  version: number
  quantities: number[]
  scrap_pct: number
  batch_size: number
  raw_materials: RawMaterialRow[]
  purchased_parts: PurchasedPartRow[]
  processes: ProcessRow[]
  tooling: ToolingRow[]
  investments: InvestmentRow[]
  packaging: PackagingRow[]
  oh_material_pct: number
  oh_mfg_pct: number
  oh_sga_pct: number
  oh_logistics_pct: number
  oh_rd_pct: number
  profit_pct: number
  total_raw_materials: number
  total_purchased_parts: number
  total_processes: number
  total_tooling: number
  total_investments: number
  total_packaging: number
  total_overhead: number
  cost_per_piece: number
  selling_price: number
  annual_value: number
  created_at: string
  updated_at: string
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
      machines: { Row: Machine; Insert: Omit<Machine, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Machine, 'id'>> }
      workstations: { Row: Workstation; Insert: Omit<Workstation, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Workstation, 'id'>> }
      labor_rates: { Row: LaborRate; Insert: Omit<LaborRate, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<LaborRate, 'id'>> }
      materials: { Row: Material; Insert: Omit<Material, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Material, 'id'>> }
      quotes: { Row: Quote; Insert: Omit<Quote, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Quote, 'id'>> }
      quote_items: { Row: QuoteItem; Insert: Omit<QuoteItem, 'id' | 'created_at'>; Update: Partial<Omit<QuoteItem, 'id'>> }
      calculations: { Row: Calculation; Insert: Omit<Calculation, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Calculation, 'id'>> }
      price_items: { Row: PriceItem; Insert: Omit<PriceItem, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<PriceItem, 'id'>> }
      quote_lines: { Row: QuoteLine; Insert: Omit<QuoteLine, 'id' | 'created_at'>; Update: Partial<Omit<QuoteLine, 'id'>> }
      quote_attachments: { Row: QuoteAttachment; Insert: Omit<QuoteAttachment, 'id' | 'created_at'>; Update: Partial<Omit<QuoteAttachment, 'id'>> }
    }
  }
}
