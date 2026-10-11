-- Obrtdesk namestitev — KORAK 1 od 6
-- Samo za PRAZEN Supabase projekt. Prilepi celoto v SQL Editor in klikni Run.
-- vsebuje: 001_initial_schema.sql … 20260613030000_phase2_requests.sql

-- ===== 001_initial_schema.sql =====
-- ============================================================
-- 001_initial_schema.sql
-- Full schema for the Procurement App
-- ============================================================

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  po_prefix text NOT NULL DEFAULT 'PO',
  po_next_number integer NOT NULL DEFAULT 1,
  address_street text,
  address_city text,
  address_postal_code text,
  address_country text,
  email text,
  phone text,
  tax_id text,
  logo_url text,
  bank_name text,
  bank_iban text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name text NOT NULL,
  vat_number text,
  contact_name text,
  email text,
  phone text,
  address_street text,
  address_city text,
  address_postal_code text,
  address_country text,
  payment_terms text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name text NOT NULL,
  project_code text,
  customer text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name text NOT NULL,
  address_street text,
  address_city text,
  address_postal_code text,
  address_country text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  item_number text NOT NULL,
  name text NOT NULL,
  long_description text,
  category_id uuid REFERENCES categories(id),
  default_unit text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  created_by uuid NOT NULL REFERENCES users(id),
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','sent','closed','cancelled')),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  category_id uuid NOT NULL REFERENCES categories(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  department_id uuid REFERENCES departments(id),
  payment_terms text NOT NULL,
  expected_delivery_date date NOT NULL,
  incoterm text,
  supplier_quote_ref text,
  notes text,
  delivery_notes text,
  total_amount decimal(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE po_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id),
  position integer NOT NULL DEFAULT 10,
  name text NOT NULL,
  long_description text,
  quantity decimal(12,3) NOT NULL,
  unit text NOT NULL,
  unit_price decimal(12,2) NOT NULL,
  line_total decimal(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_line_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies — all scoped to the authenticated user's company
-- ============================================================

CREATE POLICY "Users see own company"
  ON companies FOR ALL
  USING (id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own company users"
  ON users FOR ALL
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own suppliers"
  ON suppliers FOR ALL
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own categories"
  ON categories FOR ALL
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own projects"
  ON projects FOR ALL
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own locations"
  ON locations FOR ALL
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own departments"
  ON departments FOR ALL
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own items"
  ON items FOR ALL
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own POs"
  ON purchase_orders FOR ALL
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own PO lines"
  ON po_line_items FOR ALL
  USING (po_id IN (
    SELECT id FROM purchase_orders
    WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  ));


-- ===== 002_fix_onboarding_rls.sql =====
-- Fix RLS policies that block onboarding inserts.
--
-- The original FOR ALL policies use a subquery into `users` to scope by
-- company_id. During onboarding neither the company nor the user profile
-- row exists yet, so that subquery returns NULL and every INSERT is
-- silently blocked.
--
-- Solution: drop the FOR ALL policies and replace them with explicit
-- per-operation policies so INSERT paths can use looser rules.

-- ── companies ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own company" ON companies;

-- Any authenticated user may create a company (first-time onboarding).
CREATE POLICY "companies: authenticated can insert"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Read/update/delete only the company the user belongs to.
CREATE POLICY "companies: select own"
  ON companies FOR SELECT
  TO authenticated
  USING (id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "companies: update own"
  ON companies FOR UPDATE
  TO authenticated
  USING (id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "companies: delete own"
  ON companies FOR DELETE
  TO authenticated
  USING (id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- ── users ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own company users" ON users;

-- A user may insert only their own profile row (id must match auth.uid()).
CREATE POLICY "users: insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Read/update/delete rows that share the same company_id.
CREATE POLICY "users: select own company"
  ON users FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "users: update own company"
  ON users FOR UPDATE
  TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "users: delete own company"
  ON users FOR DELETE
  TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));


-- ===== 003_fix_rls_recursion.sql =====
-- Fix infinite recursion in RLS policies.
--
-- The companies INSERT policy was checking a subquery on `users`,
-- which itself triggered the users RLS policy, causing infinite recursion.
-- Solution: use auth.uid() directly and avoid cross-table subqueries on INSERT.

-- ── Drop all existing policies ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own company" ON companies;
DROP POLICY IF EXISTS "companies: authenticated can insert" ON companies;
DROP POLICY IF EXISTS "companies: select own" ON companies;
DROP POLICY IF EXISTS "companies: update own" ON companies;
DROP POLICY IF EXISTS "companies: delete own" ON companies;

DROP POLICY IF EXISTS "Users see own company users" ON users;
DROP POLICY IF EXISTS "users: insert own profile" ON users;
DROP POLICY IF EXISTS "users: select own company" ON users;
DROP POLICY IF EXISTS "users: update own company" ON users;
DROP POLICY IF EXISTS "users: delete own company" ON users;

-- ── companies ─────────────────────────────────────────────────────────────────

-- Any authenticated user can insert a company (first-time onboarding).
CREATE POLICY "companies_insert"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- For SELECT/UPDATE/DELETE use a security definer function to avoid recursion.
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM users WHERE id = auth.uid()
$$;

CREATE POLICY "companies_select"
  ON companies FOR SELECT
  TO authenticated
  USING (id = get_my_company_id());

CREATE POLICY "companies_update"
  ON companies FOR UPDATE
  TO authenticated
  USING (id = get_my_company_id());

CREATE POLICY "companies_delete"
  ON companies FOR DELETE
  TO authenticated
  USING (id = get_my_company_id());

-- ── users ─────────────────────────────────────────────────────────────────────

-- Can only insert your own profile row.
CREATE POLICY "users_insert"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Use the security definer function to avoid recursive self-join.
CREATE POLICY "users_select"
  ON users FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "users_update"
  ON users FOR UPDATE
  TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "users_delete"
  ON users FOR DELETE
  TO authenticated
  USING (company_id = get_my_company_id());


-- ===== 004_fix_companies_insert.sql =====
-- Nuclear reset of all companies + users RLS policies.
-- Run this to guarantee a clean state.

-- 1. Temporarily disable RLS to clear everything safely
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Drop every policy that could exist on these two tables
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE tablename IN ('companies', 'users')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 3. Re-enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. Create the security definer helper (avoids recursion)
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM users WHERE id = auth.uid()
$$;

-- 5. companies policies
CREATE POLICY "companies_insert"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "companies_select"
  ON companies FOR SELECT TO authenticated
  USING (id = get_my_company_id());

CREATE POLICY "companies_update"
  ON companies FOR UPDATE TO authenticated
  USING (id = get_my_company_id());

CREATE POLICY "companies_delete"
  ON companies FOR DELETE TO authenticated
  USING (id = get_my_company_id());

-- 6. users policies
CREATE POLICY "users_insert"
  ON users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_select"
  ON users FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "users_update"
  ON users FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "users_delete"
  ON users FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());


-- ===== 005_onboarding_rpc.sql =====
CREATE OR REPLACE FUNCTION public.handle_onboarding(
  p_company_name text,
  p_first_name   text,
  p_last_name    text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_company_id uuid;
  v_user_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.companies (name, currency, po_prefix, po_next_number)
  VALUES (p_company_name, 'EUR', 'PO', 1)
  RETURNING id INTO v_company_id;

  INSERT INTO public.users (id, company_id, first_name, last_name, email, is_admin)
  VALUES (v_user_id, v_company_id, p_first_name, p_last_name, v_user_email, true);

  RETURN json_build_object('company_id', v_company_id, 'user_id', v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_onboarding TO authenticated;


-- ===== 20260531100000_dashboard_rpc.sql =====
-- Dashboard aggregation RPC
-- Replaces fetching all PO rows to the client — all grouping done in Postgres.

CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_company_id   uuid,
  p_date_from    timestamptz DEFAULT NULL,
  p_supplier_id  uuid        DEFAULT NULL,
  p_category_id  uuid        DEFAULT NULL,
  p_project_id   uuid        DEFAULT NULL,
  p_department_id uuid       DEFAULT NULL,
  p_months       int         DEFAULT 12
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN json_build_object(

    -- ── Summary ────────────────────────────────────────────────────────────────
    'summary', (
      SELECT json_build_object(
        'total_spend', COALESCE(SUM(total_amount), 0),
        'po_count',    COUNT(id),
        'avg_po',      CASE WHEN COUNT(id) > 0 THEN SUM(total_amount) / COUNT(id) ELSE 0 END
      )
      FROM purchase_orders
      WHERE company_id    = p_company_id
        AND status        = ANY(ARRAY['issued','sent','closed'])
        AND (p_date_from      IS NULL OR created_at  >= p_date_from)
        AND (p_supplier_id    IS NULL OR supplier_id  = p_supplier_id)
        AND (p_category_id    IS NULL OR category_id  = p_category_id)
        AND (p_project_id     IS NULL OR project_id   = p_project_id)
        AND (p_department_id  IS NULL OR department_id = p_department_id)
    ),

    -- ── Open POs (no filters — always global) ─────────────────────────────────
    'open_pos', (
      SELECT COUNT(id)
      FROM purchase_orders
      WHERE company_id = p_company_id
        AND status = ANY(ARRAY['issued','sent'])
    ),

    -- ── Spend by month ────────────────────────────────────────────────────────
    'spend_by_month', (
      SELECT COALESCE(json_agg(
        json_build_object('month', to_char(m, 'YYYY-MM'), 'amount', COALESCE(s.amount, 0))
        ORDER BY m
      ), '[]'::json)
      FROM generate_series(
        date_trunc('month', NOW()) - ((p_months - 1) || ' months')::interval,
        date_trunc('month', NOW()),
        '1 month'::interval
      ) m
      LEFT JOIN (
        SELECT date_trunc('month', created_at) AS mo, SUM(total_amount) AS amount
        FROM purchase_orders
        WHERE company_id    = p_company_id
          AND status        = ANY(ARRAY['issued','sent','closed'])
          AND (p_date_from      IS NULL OR created_at  >= p_date_from)
          AND (p_supplier_id    IS NULL OR supplier_id  = p_supplier_id)
          AND (p_category_id    IS NULL OR category_id  = p_category_id)
          AND (p_project_id     IS NULL OR project_id   = p_project_id)
          AND (p_department_id  IS NULL OR department_id = p_department_id)
        GROUP BY mo
      ) s ON s.mo = m
    ),

    -- ── Spend by supplier (top 10) ────────────────────────────────────────────
    'spend_by_supplier', (
      SELECT COALESCE(json_agg(json_build_object('name', name, 'amount', amount) ORDER BY amount DESC), '[]'::json)
      FROM (
        SELECT sup.name, SUM(po.total_amount) AS amount
        FROM purchase_orders po
        LEFT JOIN suppliers sup ON sup.id = po.supplier_id
        WHERE po.company_id    = p_company_id
          AND po.status        = ANY(ARRAY['issued','sent','closed'])
          AND (p_date_from      IS NULL OR po.created_at  >= p_date_from)
          AND (p_supplier_id    IS NULL OR po.supplier_id  = p_supplier_id)
          AND (p_category_id    IS NULL OR po.category_id  = p_category_id)
          AND (p_project_id     IS NULL OR po.project_id   = p_project_id)
          AND (p_department_id  IS NULL OR po.department_id = p_department_id)
        GROUP BY sup.name
        ORDER BY amount DESC
        LIMIT 10
      ) t
    ),

    -- ── Spend by category (top 8) ─────────────────────────────────────────────
    'spend_by_category', (
      SELECT COALESCE(json_agg(json_build_object('name', name, 'value', amount) ORDER BY amount DESC), '[]'::json)
      FROM (
        SELECT cat.name, SUM(po.total_amount) AS amount
        FROM purchase_orders po
        LEFT JOIN categories cat ON cat.id = po.category_id
        WHERE po.company_id    = p_company_id
          AND po.status        = ANY(ARRAY['issued','sent','closed'])
          AND (p_date_from      IS NULL OR po.created_at  >= p_date_from)
          AND (p_supplier_id    IS NULL OR po.supplier_id  = p_supplier_id)
          AND (p_category_id    IS NULL OR po.category_id  = p_category_id)
          AND (p_project_id     IS NULL OR po.project_id   = p_project_id)
          AND (p_department_id  IS NULL OR po.department_id = p_department_id)
        GROUP BY cat.name
        ORDER BY amount DESC
        LIMIT 8
      ) t
    ),

    -- ── Spend by project (top 10) ─────────────────────────────────────────────
    'spend_by_project', (
      SELECT COALESCE(json_agg(json_build_object('name', name, 'amount', amount) ORDER BY amount DESC), '[]'::json)
      FROM (
        SELECT proj.name, SUM(po.total_amount) AS amount
        FROM purchase_orders po
        LEFT JOIN projects proj ON proj.id = po.project_id
        WHERE po.company_id    = p_company_id
          AND po.status        = ANY(ARRAY['issued','sent','closed'])
          AND (p_date_from      IS NULL OR po.created_at  >= p_date_from)
          AND (p_supplier_id    IS NULL OR po.supplier_id  = p_supplier_id)
          AND (p_category_id    IS NULL OR po.category_id  = p_category_id)
          AND (p_project_id     IS NULL OR po.project_id   = p_project_id)
          AND (p_department_id  IS NULL OR po.department_id = p_department_id)
        GROUP BY proj.name
        ORDER BY amount DESC
        LIMIT 10
      ) t
    ),

    -- ── Spend by department (top 10) ──────────────────────────────────────────
    'spend_by_department', (
      SELECT COALESCE(json_agg(json_build_object('name', name, 'amount', amount) ORDER BY amount DESC), '[]'::json)
      FROM (
        SELECT dept.name, SUM(po.total_amount) AS amount
        FROM purchase_orders po
        LEFT JOIN departments dept ON dept.id = po.department_id
        WHERE po.company_id    = p_company_id
          AND po.status        = ANY(ARRAY['issued','sent','closed'])
          AND (p_date_from      IS NULL OR po.created_at  >= p_date_from)
          AND (p_supplier_id    IS NULL OR po.supplier_id  = p_supplier_id)
          AND (p_category_id    IS NULL OR po.category_id  = p_category_id)
          AND (p_project_id     IS NULL OR po.project_id   = p_project_id)
          AND (p_department_id  IS NULL OR po.department_id = p_department_id)
        GROUP BY dept.name
        ORDER BY amount DESC
        LIMIT 10
      ) t
    ),

    -- ── Spend by material / line item (top 10) ────────────────────────────────
    'spend_by_material', (
      SELECT COALESCE(json_agg(json_build_object('name', name, 'amount', amount) ORDER BY amount DESC), '[]'::json)
      FROM (
        SELECT li.name, SUM(li.line_total) AS amount
        FROM po_line_items li
        JOIN purchase_orders po ON po.id = li.po_id
        WHERE po.company_id    = p_company_id
          AND po.status        = ANY(ARRAY['issued','sent','closed'])
          AND (p_date_from      IS NULL OR po.created_at  >= p_date_from)
          AND (p_supplier_id    IS NULL OR po.supplier_id  = p_supplier_id)
          AND (p_category_id    IS NULL OR po.category_id  = p_category_id)
          AND (p_project_id     IS NULL OR po.project_id   = p_project_id)
          AND (p_department_id  IS NULL OR po.department_id = p_department_id)
        GROUP BY li.name
        ORDER BY amount DESC
        LIMIT 10
      ) t
    ),

    -- ── Recent POs (last 8, no filters) ──────────────────────────────────────
    'recent_pos', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT po.id, po.po_number, po.status, po.total_amount, po.created_at,
               sup.name  AS supplier_name,
               proj.name AS project_name
        FROM purchase_orders po
        LEFT JOIN suppliers sup  ON sup.id  = po.supplier_id
        LEFT JOIN projects proj  ON proj.id = po.project_id
        WHERE po.company_id = p_company_id
        ORDER BY po.created_at DESC
        LIMIT 8
      ) t
    )

  );
END;
$$;

-- Indexes that help this query (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_po_company_status ON purchase_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_po_company_created ON purchase_orders(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON po_line_items(po_id);


-- ===== 20260531120000_quotation_upload.sql =====
-- Add quotation_url column to purchase_orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS quotation_url text;

-- Create storage bucket for quotations
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quotations',
  'quotations',
  false,
  10485760,  -- 10 MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can upload/read/delete only their own company's files
CREATE POLICY "Company members can upload quotations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quotations'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
);

CREATE POLICY "Company members can read quotations"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quotations'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
);

CREATE POLICY "Company members can delete quotations"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'quotations'
  AND (storage.foldername(name))[1] = (SELECT get_my_company_id()::text)
);


-- ===== 20260601_po_attachments.sql =====
-- Multiple attachments per PO
CREATE TABLE IF NOT EXISTS po_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id        uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_path    text NOT NULL,
  file_name    text NOT NULL,
  file_size    bigint,
  created_at   timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE po_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage attachments"
ON po_attachments FOR ALL
TO authenticated
USING  (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

-- Index
CREATE INDEX IF NOT EXISTS idx_po_attachments_po_id ON po_attachments(po_id);


-- ===== 20260613000000_phase1b_permissions_and_fixes.sql =====
-- ============================================================
-- 20260613000000_phase1b_permissions_and_fixes.sql
-- Phase 1b: schema fixes + permissions/invitations infrastructure
-- ============================================================

-- ─── Schema fixes ────────────────────────────────────────────

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS default_unit_price numeric(12,2);

-- ─── New columns for approvals/permissions (Phase 1b + future Phase 2) ──────

ALTER TABLE companies ADD COLUMN IF NOT EXISTS approval_auto_under numeric(12,2);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS approval_second_over numeric(12,2);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS team_edit_requests boolean NOT NULL DEFAULT false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_amount numeric(12,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES users(id);

-- Nullable, no FK yet — `requests` table is created in Phase 2, which will add the constraint.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS request_id uuid;

-- ─── generate_po_number RPC ──────────────────────────────────

CREATE OR REPLACE FUNCTION generate_po_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_number integer;
BEGIN
  UPDATE companies
  SET po_next_number = po_next_number + 1
  WHERE id = p_company_id
  RETURNING po_prefix, po_next_number - 1 INTO v_prefix, v_number;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Company % not found', p_company_id;
  END IF;

  RETURN v_prefix || '-' || lpad(v_number::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_po_number(uuid) TO authenticated;

-- ─── user_permissions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module       text NOT NULL CHECK (module IN ('requests','purchase_orders','receipts','invoices','budgets','reports')),
  can_view     boolean NOT NULL DEFAULT false,
  can_create   boolean NOT NULL DEFAULT false,
  can_approve  boolean NOT NULL DEFAULT false,
  can_pay      boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, module)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage permissions"
ON user_permissions FOR ALL
TO authenticated
USING (user_id IN (SELECT id FROM users WHERE company_id = (SELECT get_my_company_id())))
WITH CHECK (user_id IN (SELECT id FROM users WHERE company_id = (SELECT get_my_company_id())));

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- ─── user_invitations ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email        text NOT NULL,
  token        text NOT NULL UNIQUE,
  invited_by   uuid NOT NULL REFERENCES users(id),
  is_admin     boolean NOT NULL DEFAULT false,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  created_at   timestamptz DEFAULT now(),
  accepted_at  timestamptz
);

ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage invitations"
ON user_invitations FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

CREATE INDEX IF NOT EXISTS idx_user_invitations_company_id ON user_invitations(company_id);

-- ─── Permission RPCs ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_my_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin FROM users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION is_my_admin() TO authenticated;

CREATE OR REPLACE FUNCTION has_perm(p_module text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_result boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
  IF v_is_admin THEN
    RETURN true;
  END IF;

  SELECT CASE p_action
    WHEN 'view'    THEN can_view
    WHEN 'create'  THEN can_create
    WHEN 'approve' THEN can_approve
    WHEN 'pay'     THEN can_pay
    ELSE false
  END INTO v_result
  FROM user_permissions
  WHERE user_id = auth.uid() AND module = p_module;

  RETURN coalesce(v_result, false);
END;
$$;

GRANT EXECUTE ON FUNCTION has_perm(text, text) TO authenticated;


-- ===== 20260613010000_accept_invitation.sql =====
-- ============================================================
-- 20260613010000_accept_invitation.sql
-- RPC: invited user accepts → profile created in the inviting company
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_first_name text,
  p_last_name  text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid;
  v_email text;
  v_inv   user_invitations%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_inv
  FROM user_invitations
  WHERE lower(email) = lower(v_email) AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'No pending invitation for this email';
  END IF;

  -- Create the profile in the inviting company (idempotent)
  INSERT INTO public.users (id, company_id, first_name, last_name, email, is_admin)
  VALUES (v_uid, v_inv.company_id, p_first_name, p_last_name, v_email, v_inv.is_admin)
  ON CONFLICT (id) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name;

  UPDATE user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN json_build_object('company_id', v_inv.company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation TO authenticated;


-- ===== 20260613020000_invite_full_profile.sql =====
-- ============================================================
-- 20260613020000_invite_full_profile.sql
-- Admin sets full profile (name, department, job title, permissions)
-- at invite time. Invited user only sets a password.
-- ============================================================

-- Job title on users + invitations carry the full profile
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text;

ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS first_name   text;
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS last_name    text;
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id);
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS job_title    text;
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS permissions  jsonb;

-- Replace accept_invitation: no name args, reads everything from the invitation
DROP FUNCTION IF EXISTS public.accept_invitation(text, text);

CREATE OR REPLACE FUNCTION public.accept_invitation()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid;
  v_email text;
  v_inv   user_invitations%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_inv
  FROM user_invitations
  WHERE lower(email) = lower(v_email) AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'No pending invitation for this email';
  END IF;

  -- Create the profile from the invitation (idempotent)
  INSERT INTO public.users (id, company_id, first_name, last_name, email, is_admin, department_id, job_title)
  VALUES (v_uid, v_inv.company_id, coalesce(v_inv.first_name, ''), coalesce(v_inv.last_name, ''), v_email, v_inv.is_admin, v_inv.department_id, v_inv.job_title)
  ON CONFLICT (id) DO UPDATE
    SET first_name    = EXCLUDED.first_name,
        last_name     = EXCLUDED.last_name,
        department_id = EXCLUDED.department_id,
        job_title     = EXCLUDED.job_title;

  -- Apply permissions set by the admin at invite time
  IF v_inv.permissions IS NOT NULL THEN
    INSERT INTO public.user_permissions (user_id, module, can_view, can_create, can_approve, can_pay)
    SELECT v_uid,
           p->>'module',
           coalesce((p->>'can_view')::boolean, false),
           coalesce((p->>'can_create')::boolean, false),
           coalesce((p->>'can_approve')::boolean, false),
           coalesce((p->>'can_pay')::boolean, false)
    FROM jsonb_array_elements(v_inv.permissions) AS p
    ON CONFLICT (user_id, module) DO UPDATE
      SET can_view = EXCLUDED.can_view,
          can_create = EXCLUDED.can_create,
          can_approve = EXCLUDED.can_approve,
          can_pay = EXCLUDED.can_pay;
  END IF;

  UPDATE user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN json_build_object('company_id', v_inv.company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation() TO authenticated;


-- ===== 20260613030000_phase2_requests.sql =====
-- ============================================================
-- 20260613030000_phase2_requests.sql
-- Phase 2: requests + single-step approval (project manager)
-- ============================================================

-- Request number counter on companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS req_prefix text NOT NULL DEFAULT 'REQ';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS req_next_number integer NOT NULL DEFAULT 1;

-- ─── requests ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number  text NOT NULL,
  created_by      uuid NOT NULL REFERENCES users(id),
  project_id      uuid NOT NULL REFERENCES projects(id),
  supplier_id     uuid REFERENCES suppliers(id),
  supplier_name   text,
  category_id     uuid REFERENCES categories(id),
  location_id     uuid REFERENCES locations(id),
  department_id   uuid REFERENCES departments(id),
  needed_by_date  date,
  note            text,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_estimate  numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','pending','approved','rejected','cancelled')),
  approver_id     uuid REFERENCES users(id),   -- project manager at submit time
  decided_by      uuid REFERENCES users(id),
  decided_at      timestamptz,
  decision_note   text,
  po_id           uuid,                         -- linked PO (Phase 3)
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_company ON requests(company_id);
CREATE INDEX IF NOT EXISTS idx_requests_approver ON requests(approver_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_by ON requests(created_by);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage requests"
ON requests FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

-- ─── request_line_items ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_line_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  item_id          uuid REFERENCES items(id),
  position         integer NOT NULL DEFAULT 10,
  name             text NOT NULL,
  long_description text,
  quantity         numeric(12,3) NOT NULL,
  unit             text NOT NULL DEFAULT 'kos',
  est_unit_price   numeric(12,2) NOT NULL DEFAULT 0,
  line_total       numeric(12,2) GENERATED ALWAYS AS (quantity * est_unit_price) STORED,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_lines_request ON request_line_items(request_id);

ALTER TABLE request_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage request lines"
ON request_line_items FOR ALL
TO authenticated
USING (request_id IN (SELECT id FROM requests WHERE company_id = (SELECT get_my_company_id())))
WITH CHECK (request_id IN (SELECT id FROM requests WHERE company_id = (SELECT get_my_company_id())));

-- ─── generate_request_number ─────────────────────────────────
CREATE OR REPLACE FUNCTION generate_request_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_number integer;
BEGIN
  UPDATE companies
  SET req_next_number = req_next_number + 1
  WHERE id = p_company_id
  RETURNING req_prefix, req_next_number - 1 INTO v_prefix, v_number;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Company % not found', p_company_id;
  END IF;

  RETURN v_prefix || '-' || lpad(v_number::text, 4, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION generate_request_number(uuid) TO authenticated;

-- ─── submit_request ──────────────────────────────────────────
-- Moves a draft to pending; approver = project manager.
-- If the creator is the project manager, auto-approve.
CREATE OR REPLACE FUNCTION submit_request(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid;
  v_req     requests%ROWTYPE;
  v_manager uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_req.status <> 'draft' THEN RAISE EXCEPTION 'Only draft requests can be submitted'; END IF;

  SELECT manager_id INTO v_manager FROM projects WHERE id = v_req.project_id;
  IF v_manager IS NULL THEN
    RAISE EXCEPTION 'Project has no manager assigned';
  END IF;

  IF v_manager = v_uid THEN
    -- creator is the approver → auto-approve
    UPDATE requests
    SET status = 'approved', approver_id = v_manager,
        decided_by = v_uid, decided_at = now(), updated_at = now()
    WHERE id = p_request_id;
    RETURN json_build_object('status', 'approved');
  ELSE
    UPDATE requests
    SET status = 'pending', approver_id = v_manager, updated_at = now()
    WHERE id = p_request_id;
    RETURN json_build_object('status', 'pending', 'approver_id', v_manager);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION submit_request(uuid) TO authenticated;

-- ─── decide_request ──────────────────────────────────────────
-- Approver (or admin) approves/rejects a pending request.
CREATE OR REPLACE FUNCTION decide_request(p_request_id uuid, p_approved boolean, p_note text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_req requests%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be decided'; END IF;
  IF v_req.approver_id <> v_uid AND NOT is_my_admin() THEN
    RAISE EXCEPTION 'Only the assigned approver can decide';
  END IF;

  UPDATE requests
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      decided_by = v_uid, decided_at = now(), decision_note = p_note, updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object('status', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END);
END;
$$;
GRANT EXECUTE ON FUNCTION decide_request(uuid, boolean, text) TO authenticated;

-- ─── cancel_request ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_request(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_req requests%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_req.created_by <> v_uid AND NOT is_my_admin() THEN
    RAISE EXCEPTION 'Only the creator or an admin can cancel';
  END IF;
  IF v_req.status IN ('cancelled') THEN RAISE EXCEPTION 'Already cancelled'; END IF;

  UPDATE requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object('status', 'cancelled');
END;
$$;
GRANT EXECUTE ON FUNCTION cancel_request(uuid) TO authenticated;


