-- Obrtdesk namestitev — KORAK 2 od 6
-- Samo za PRAZEN Supabase projekt. Prilepi celoto v SQL Editor in klikni Run.
-- vsebuje: 20260613040000_approvals_structure.sql … 20260614070000_receive_sent_only.sql

-- ===== 20260613040000_approvals_structure.sql =====
-- ============================================================
-- 20260613040000_approvals_structure.sql
-- Full multi-step approval structure:
--   step 1 = project manager (always)
--   step 2 = company director/second approver (only if total > threshold)
-- No auto-approve: a submitted request always requires approval.
-- ============================================================

-- Chosen director / second approver (over-threshold step)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS second_approver_id uuid REFERENCES users(id);

-- ─── approvals (steps) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  step          integer NOT NULL,
  approver_id   uuid NOT NULL REFERENCES users(id),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_request ON approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON approvals(approver_id, status);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see approvals"
ON approvals FOR ALL
TO authenticated
USING (request_id IN (SELECT id FROM requests WHERE company_id = (SELECT get_my_company_id())))
WITH CHECK (request_id IN (SELECT id FROM requests WHERE company_id = (SELECT get_my_company_id())));

-- ─── submit_request (rewrite: always to approval, create step 1) ──
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
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Project has no manager assigned'; END IF;

  -- Clear any stale steps, create step 1 (project manager) — always requires approval
  DELETE FROM approvals WHERE request_id = p_request_id;
  INSERT INTO approvals (request_id, step, approver_id) VALUES (p_request_id, 1, v_manager);

  UPDATE requests
  SET status = 'pending', approver_id = v_manager,
      decided_by = NULL, decided_at = NULL, decision_note = NULL, updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object('status', 'pending', 'approver_id', v_manager);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_request(uuid) TO authenticated;

-- ─── decide_approval (per-step decision; lazily creates step 2) ──
DROP FUNCTION IF EXISTS decide_request(uuid, boolean, text);

CREATE OR REPLACE FUNCTION decide_approval(p_approval_id uuid, p_approved boolean, p_note text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid;
  v_ap        approvals%ROWTYPE;
  v_req       requests%ROWTYPE;
  v_threshold numeric;
  v_director  uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_ap FROM approvals WHERE id = p_approval_id;
  IF v_ap.id IS NULL THEN RAISE EXCEPTION 'Approval not found'; END IF;

  SELECT * INTO v_req FROM requests WHERE id = v_ap.request_id;
  IF v_req.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_ap.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF v_ap.approver_id <> v_uid AND NOT is_my_admin() THEN
    RAISE EXCEPTION 'Only the assigned approver can decide';
  END IF;

  IF NOT p_approved THEN
    UPDATE approvals SET status = 'rejected', decided_at = now(), decision_note = p_note WHERE id = v_ap.id;
    UPDATE requests SET status = 'rejected', decided_by = v_uid, decided_at = now(),
                        decision_note = p_note, updated_at = now()
    WHERE id = v_req.id;
    RETURN json_build_object('status', 'rejected');
  END IF;

  -- approved
  UPDATE approvals SET status = 'approved', decided_at = now(), decision_note = p_note WHERE id = v_ap.id;

  IF v_ap.step = 1 THEN
    SELECT approval_second_over, second_approver_id INTO v_threshold, v_director
    FROM companies WHERE id = v_req.company_id;

    IF v_threshold IS NOT NULL AND v_threshold > 0
       AND v_director IS NOT NULL AND v_director <> v_ap.approver_id
       AND v_req.total_estimate > v_threshold THEN
      -- escalate to director (step 2)
      INSERT INTO approvals (request_id, step, approver_id) VALUES (v_req.id, 2, v_director);
      UPDATE requests SET approver_id = v_director, updated_at = now() WHERE id = v_req.id;
      RETURN json_build_object('status', 'pending', 'next_step', 2);
    END IF;
  END IF;

  -- no further steps → approved
  UPDATE requests SET status = 'approved', decided_by = v_uid, decided_at = now(), updated_at = now()
  WHERE id = v_req.id;
  RETURN json_build_object('status', 'approved');
END;
$$;
GRANT EXECUTE ON FUNCTION decide_approval(uuid, boolean, text) TO authenticated;


-- ===== 20260613050000_request_attachments.sql =====
-- ============================================================
-- 20260613050000_request_attachments.sql
-- Attachments (offers/quotes) on requests. Reuses the
-- existing `quotations` storage bucket (company-scoped).
-- ============================================================

CREATE TABLE IF NOT EXISTS request_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_path    text NOT NULL,
  file_name    text NOT NULL,
  file_size    bigint,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage request attachments"
ON request_attachments FOR ALL
TO authenticated
USING  (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

CREATE INDEX IF NOT EXISTS idx_request_attachments_request ON request_attachments(request_id);


-- ===== 20260613060000_submit_rejected.sql =====
-- ============================================================
-- 20260613060000_submit_rejected.sql
-- Allow re-submitting a rejected request (after editing) — not only drafts.
-- ============================================================

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
  IF v_req.status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Only draft or rejected requests can be submitted';
  END IF;

  SELECT manager_id INTO v_manager FROM projects WHERE id = v_req.project_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Project has no manager assigned'; END IF;

  -- Reset approval chain, create step 1 (project manager)
  DELETE FROM approvals WHERE request_id = p_request_id;
  INSERT INTO approvals (request_id, step, approver_id) VALUES (p_request_id, 1, v_manager);

  UPDATE requests
  SET status = 'pending', approver_id = v_manager,
      decided_by = NULL, decided_at = NULL, decision_note = NULL, updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object('status', 'pending', 'approver_id', v_manager);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_request(uuid) TO authenticated;


-- ===== 20260613070000_submit_any_open.sql =====
-- ============================================================
-- 20260613070000_submit_any_open.sql
-- Allow (re)submitting from draft, pending or rejected.
-- Re-submitting resets the approval chain to step 1.
-- ============================================================

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
  IF v_req.status NOT IN ('draft', 'pending', 'rejected') THEN
    RAISE EXCEPTION 'This request cannot be submitted';
  END IF;

  SELECT manager_id INTO v_manager FROM projects WHERE id = v_req.project_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Project has no manager assigned'; END IF;

  DELETE FROM approvals WHERE request_id = p_request_id;
  INSERT INTO approvals (request_id, step, approver_id) VALUES (p_request_id, 1, v_manager);

  UPDATE requests
  SET status = 'pending', approver_id = v_manager,
      decided_by = NULL, decided_at = NULL, decision_note = NULL, updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object('status', 'pending', 'approver_id', v_manager);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_request(uuid) TO authenticated;


-- ===== 20260613080000_activity_log.sql =====
-- ============================================================
-- 20260613080000_activity_log.sql
-- Full audit trail for requests + log events inside RPCs.
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_id  uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES users(id),
  action      text NOT NULL,   -- created | edited | submitted | approved | rejected | cancelled
  note        text,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_request ON activity_log(request_id, created_at);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see activity log"
ON activity_log FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

-- ─── submit_request (adds optional note + logs) ──────────────
DROP FUNCTION IF EXISTS submit_request(uuid);

CREATE OR REPLACE FUNCTION submit_request(p_request_id uuid, p_note text DEFAULT NULL)
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
  IF v_req.status NOT IN ('draft', 'pending', 'rejected') THEN
    RAISE EXCEPTION 'This request cannot be submitted';
  END IF;

  SELECT manager_id INTO v_manager FROM projects WHERE id = v_req.project_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Project has no manager assigned'; END IF;

  DELETE FROM approvals WHERE request_id = p_request_id;
  INSERT INTO approvals (request_id, step, approver_id) VALUES (p_request_id, 1, v_manager);

  UPDATE requests
  SET status = 'pending', approver_id = v_manager,
      decided_by = NULL, decided_at = NULL, decision_note = NULL, updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO activity_log (company_id, request_id, actor_id, action, note)
  VALUES (v_req.company_id, p_request_id, v_uid, 'submitted', p_note);

  RETURN json_build_object('status', 'pending', 'approver_id', v_manager);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_request(uuid, text) TO authenticated;

-- ─── decide_approval (logs approved/rejected) ────────────────
CREATE OR REPLACE FUNCTION decide_approval(p_approval_id uuid, p_approved boolean, p_note text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid;
  v_ap        approvals%ROWTYPE;
  v_req       requests%ROWTYPE;
  v_threshold numeric;
  v_director  uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_ap FROM approvals WHERE id = p_approval_id;
  IF v_ap.id IS NULL THEN RAISE EXCEPTION 'Approval not found'; END IF;

  SELECT * INTO v_req FROM requests WHERE id = v_ap.request_id;
  IF v_req.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_ap.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF v_ap.approver_id <> v_uid AND NOT is_my_admin() THEN
    RAISE EXCEPTION 'Only the assigned approver can decide';
  END IF;

  IF NOT p_approved THEN
    UPDATE approvals SET status = 'rejected', decided_at = now(), decision_note = p_note WHERE id = v_ap.id;
    UPDATE requests SET status = 'rejected', decided_by = v_uid, decided_at = now(),
                        decision_note = p_note, updated_at = now()
    WHERE id = v_req.id;
    INSERT INTO activity_log (company_id, request_id, actor_id, action, note, meta)
    VALUES (v_req.company_id, v_req.id, v_uid, 'rejected', p_note, json_build_object('step', v_ap.step));
    RETURN json_build_object('status', 'rejected');
  END IF;

  UPDATE approvals SET status = 'approved', decided_at = now(), decision_note = p_note WHERE id = v_ap.id;
  INSERT INTO activity_log (company_id, request_id, actor_id, action, note, meta)
  VALUES (v_req.company_id, v_req.id, v_uid, 'approved', p_note, json_build_object('step', v_ap.step));

  IF v_ap.step = 1 THEN
    SELECT approval_second_over, second_approver_id INTO v_threshold, v_director
    FROM companies WHERE id = v_req.company_id;

    IF v_threshold IS NOT NULL AND v_threshold > 0
       AND v_director IS NOT NULL AND v_director <> v_ap.approver_id
       AND v_req.total_estimate > v_threshold THEN
      INSERT INTO approvals (request_id, step, approver_id) VALUES (v_req.id, 2, v_director);
      UPDATE requests SET approver_id = v_director, updated_at = now() WHERE id = v_req.id;
      RETURN json_build_object('status', 'pending', 'next_step', 2);
    END IF;
  END IF;

  UPDATE requests SET status = 'approved', decided_by = v_uid, decided_at = now(), updated_at = now()
  WHERE id = v_req.id;
  RETURN json_build_object('status', 'approved');
END;
$$;
GRANT EXECUTE ON FUNCTION decide_approval(uuid, boolean, text) TO authenticated;

-- ─── cancel_request (logs cancelled) ─────────────────────────
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
  IF v_req.status = 'cancelled' THEN RAISE EXCEPTION 'Already cancelled'; END IF;

  UPDATE requests SET status = 'cancelled', updated_at = now() WHERE id = p_request_id;

  INSERT INTO activity_log (company_id, request_id, actor_id, action)
  VALUES (v_req.company_id, p_request_id, v_uid, 'cancelled');

  RETURN json_build_object('status', 'cancelled');
END;
$$;
GRANT EXECUTE ON FUNCTION cancel_request(uuid) TO authenticated;


-- ===== 20260613090000_submit_from_approved.sql =====
-- ============================================================
-- 20260613090000_submit_from_approved.sql
-- Allow (re)submitting from any non-cancelled status (incl. approved).
-- Editing an approved request sends it back for approval.
-- ============================================================

CREATE OR REPLACE FUNCTION submit_request(p_request_id uuid, p_note text DEFAULT NULL)
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
  IF v_req.status = 'cancelled' THEN RAISE EXCEPTION 'A cancelled request cannot be submitted'; END IF;

  SELECT manager_id INTO v_manager FROM projects WHERE id = v_req.project_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Project has no manager assigned'; END IF;

  DELETE FROM approvals WHERE request_id = p_request_id;
  INSERT INTO approvals (request_id, step, approver_id) VALUES (p_request_id, 1, v_manager);

  UPDATE requests
  SET status = 'pending', approver_id = v_manager,
      decided_by = NULL, decided_at = NULL, decision_note = NULL, updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO activity_log (company_id, request_id, actor_id, action, note)
  VALUES (v_req.company_id, p_request_id, v_uid, 'submitted', p_note);

  RETURN json_build_object('status', 'pending', 'approver_id', v_manager);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_request(uuid, text) TO authenticated;


-- ===== 20260613100000_project_budget_status.sql =====
-- ============================================================
-- 20260613100000_project_budget_status.sql
-- Budget consumption for a project: budget vs ordered (POs) /
-- approved (requests) / pending (requests in approval).
-- ============================================================

CREATE OR REPLACE FUNCTION get_project_budget_status(p_project_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company  uuid;
  v_budget   numeric;
  v_ordered  numeric;
  v_approved numeric;
  v_pending  numeric;
BEGIN
  SELECT company_id, budget_amount INTO v_company, v_budget
  FROM projects WHERE id = p_project_id;

  IF v_company IS NULL OR v_company <> get_my_company_id() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT coalesce(sum(total_amount), 0) INTO v_ordered
  FROM purchase_orders
  WHERE project_id = p_project_id AND status <> 'cancelled';

  SELECT coalesce(sum(total_estimate), 0) INTO v_approved
  FROM requests
  WHERE project_id = p_project_id AND status = 'approved';

  SELECT coalesce(sum(total_estimate), 0) INTO v_pending
  FROM requests
  WHERE project_id = p_project_id AND status = 'pending';

  RETURN json_build_object(
    'budget',   v_budget,
    'ordered',  v_ordered,
    'approved', v_approved,
    'pending',  v_pending
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_project_budget_status(uuid) TO authenticated;


-- ===== 20260614000000_phase3_request_to_po.sql =====
-- ============================================================
-- 20260614000000_phase3_request_to_po.sql
-- Phase 3a: create a PO from an approved request + cross-links.
-- ============================================================

-- A draft PO created from a request may be incomplete; the buyer
-- fills the required fields before issuing (enforced in the form).
ALTER TABLE purchase_orders ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN location_id DROP NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN payment_terms DROP NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN expected_delivery_date DROP NOT NULL;

-- Link requests <-> purchase_orders
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_request_id_fkey
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL;

ALTER TABLE requests
  ADD CONSTRAINT requests_po_id_fkey
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL;

-- ─── create_po_from_request ──────────────────────────────────
CREATE OR REPLACE FUNCTION create_po_from_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid;
  v_req       requests%ROWTYPE;
  v_po_id     uuid;
  v_po_number text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_req.status <> 'approved' THEN RAISE EXCEPTION 'Only approved requests can become a PO'; END IF;
  IF v_req.po_id IS NOT NULL THEN RAISE EXCEPTION 'A PO already exists for this request'; END IF;
  IF NOT (has_perm('purchase_orders', 'create') OR is_my_admin()) THEN
    RAISE EXCEPTION 'No permission to create purchase orders';
  END IF;

  v_po_number := generate_po_number(v_req.company_id);

  INSERT INTO purchase_orders (
    company_id, created_by, po_number, status, request_id,
    supplier_id, category_id, location_id, project_id, department_id,
    payment_terms, expected_delivery_date, notes, discount_amount, total_amount
  ) VALUES (
    v_req.company_id, v_uid, v_po_number, 'draft', p_request_id,
    v_req.supplier_id, v_req.category_id, v_req.location_id, v_req.project_id, v_req.department_id,
    NULL, v_req.needed_by_date, v_req.note, v_req.discount_amount, v_req.total_estimate
  ) RETURNING id INTO v_po_id;

  INSERT INTO po_line_items (po_id, item_id, position, name, long_description, quantity, unit, unit_price)
  SELECT v_po_id, item_id, position, name, long_description, quantity, unit, coalesce(est_unit_price, 0)
  FROM request_line_items
  WHERE request_id = p_request_id
  ORDER BY position;

  UPDATE requests SET po_id = v_po_id, updated_at = now() WHERE id = p_request_id;

  INSERT INTO activity_log (company_id, request_id, actor_id, action, meta)
  VALUES (v_req.company_id, p_request_id, v_uid, 'po_created',
          json_build_object('po_id', v_po_id, 'po_number', v_po_number));

  RETURN v_po_id;
END;
$$;
GRANT EXECUTE ON FUNCTION create_po_from_request(uuid) TO authenticated;


-- ===== 20260614010000_reassign_on_manager_change.sql =====
-- ============================================================
-- 20260614010000_reassign_on_manager_change.sql
-- When a project's manager changes, reassign in-flight requests
-- that are still waiting on the manager (step 1) to the new manager.
-- ============================================================

CREATE OR REPLACE FUNCTION reassign_pending_on_manager_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.manager_id IS DISTINCT FROM OLD.manager_id AND NEW.manager_id IS NOT NULL THEN
    -- Step-1 (manager) pending approvals → new manager
    UPDATE approvals a
    SET approver_id = NEW.manager_id
    FROM requests r
    WHERE a.request_id = r.id
      AND r.project_id = NEW.id
      AND r.status = 'pending'
      AND a.status = 'pending'
      AND a.step = 1
      AND a.approver_id = OLD.manager_id;

    -- Mirror the current approver on the request row
    UPDATE requests r
    SET approver_id = NEW.manager_id, updated_at = now()
    WHERE r.project_id = NEW.id
      AND r.status = 'pending'
      AND r.approver_id = OLD.manager_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reassign_on_manager_change ON projects;
CREATE TRIGGER trg_reassign_on_manager_change
AFTER UPDATE OF manager_id ON projects
FOR EACH ROW EXECUTE FUNCTION reassign_pending_on_manager_change();


-- ===== 20260614020000_phase3b_change_orders.sql =====
-- ============================================================
-- 20260614020000_phase3b_change_orders.sql
-- Phase 3b: change orders + version history for purchase orders.
-- ============================================================

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS change_note text;

CREATE TABLE IF NOT EXISTS po_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id       uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  version     int NOT NULL,
  snapshot    jsonb NOT NULL,
  change_note text,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_versions_po ON po_versions(po_id, version);

ALTER TABLE po_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see po versions"
ON po_versions FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

-- Snapshot the current PO state before a change order, then bump version.
CREATE OR REPLACE FUNCTION save_po_change_order(p_po_id uuid, p_change_note text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid;
  v_po          purchase_orders%ROWTYPE;
  v_snapshot    jsonb;
  v_new_version int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
  IF v_po.id IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF v_po.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_po.status NOT IN ('issued', 'sent') THEN
    RAISE EXCEPTION 'Only issued or sent purchase orders can have a change order';
  END IF;
  IF NOT (has_perm('purchase_orders', 'create') OR is_my_admin()) THEN
    RAISE EXCEPTION 'No permission to change purchase orders';
  END IF;

  v_snapshot := jsonb_build_object(
    'status', v_po.status,
    'total_amount', v_po.total_amount,
    'discount_amount', v_po.discount_amount,
    'supplier_id', v_po.supplier_id,
    'category_id', v_po.category_id,
    'project_id', v_po.project_id,
    'location_id', v_po.location_id,
    'department_id', v_po.department_id,
    'payment_terms', v_po.payment_terms,
    'expected_delivery_date', v_po.expected_delivery_date,
    'incoterm', v_po.incoterm,
    'notes', v_po.notes,
    'line_items', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'unit', unit, 'unit_price', unit_price, 'line_total', line_total) ORDER BY position)
      FROM po_line_items WHERE po_id = p_po_id
    ), '[]'::jsonb)
  );

  INSERT INTO po_versions (po_id, company_id, version, snapshot, change_note, created_by)
  VALUES (p_po_id, v_po.company_id, v_po.version, v_snapshot, p_change_note, v_uid);

  v_new_version := v_po.version + 1;
  UPDATE purchase_orders SET version = v_new_version, change_note = p_change_note, updated_at = now() WHERE id = p_po_id;

  RETURN v_new_version;
END;
$$;
GRANT EXECUTE ON FUNCTION save_po_change_order(uuid, text) TO authenticated;


-- ===== 20260614030000_po_activity_log.sql =====
-- ============================================================
-- 20260614030000_po_activity_log.sql
-- Drop change-order structures; add a simple PO audit trail.
-- ============================================================

DROP FUNCTION IF EXISTS save_po_change_order(uuid, text);
DROP TABLE IF EXISTS po_versions;

CREATE TABLE IF NOT EXISTS po_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_id       uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES users(id),
  action      text NOT NULL,   -- created | edited | issued | sent | closed | cancelled
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_activity_po ON po_activity_log(po_id, created_at);

ALTER TABLE po_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members see PO activity"
ON po_activity_log FOR ALL
TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));


-- ===== 20260614040000_po_prev_status.sql =====
-- Remember the status a PO had before being cancelled/closed, so an admin
-- can reopen it back to that exact status.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS prev_status text;


-- ===== 20260614050000_receipts.sql =====
-- ============================================================
-- 20260614050000_receipts.sql
-- Goods receipts (prevzemi) against purchase orders.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS rec_prefix text NOT NULL DEFAULT 'REC';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rec_next_number integer NOT NULL DEFAULT 1;

-- Derived receiving state of a PO (main status stays untouched)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_status text NOT NULL DEFAULT 'none'
  CHECK (received_status IN ('none', 'partial', 'full'));

-- ─── receipts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_id              uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  receipt_number     text NOT NULL,
  received_by        uuid NOT NULL REFERENCES users(id),
  received_date      date NOT NULL,
  supplier_receipt_no text,
  note               text,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_company ON receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_receipts_po ON receipts(po_id);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage receipts"
ON receipts FOR ALL TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));

-- ─── receipt_line_items ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipt_line_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id        uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  po_line_id        uuid NOT NULL REFERENCES po_line_items(id) ON DELETE CASCADE,
  quantity_received numeric(12,3) NOT NULL,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON receipt_line_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_po_line ON receipt_line_items(po_line_id);

ALTER TABLE receipt_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage receipt lines"
ON receipt_line_items FOR ALL TO authenticated
USING (receipt_id IN (SELECT id FROM receipts WHERE company_id = (SELECT get_my_company_id())))
WITH CHECK (receipt_id IN (SELECT id FROM receipts WHERE company_id = (SELECT get_my_company_id())));

-- ─── receipt_attachments (packing slip) — reuses quotations bucket ──
CREATE TABLE IF NOT EXISTS receipt_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id  uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_path   text NOT NULL,
  file_name   text NOT NULL,
  file_size   bigint,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE receipt_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage receipt attachments"
ON receipt_attachments FOR ALL TO authenticated
USING (company_id = (SELECT get_my_company_id()))
WITH CHECK (company_id = (SELECT get_my_company_id()));
CREATE INDEX IF NOT EXISTS idx_receipt_attachments_receipt ON receipt_attachments(receipt_id);

-- ─── generate_receipt_number ─────────────────────────────────
CREATE OR REPLACE FUNCTION generate_receipt_number(p_company_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prefix text; v_number integer;
BEGIN
  UPDATE companies SET rec_next_number = rec_next_number + 1
  WHERE id = p_company_id
  RETURNING rec_prefix, rec_next_number - 1 INTO v_prefix, v_number;
  IF v_prefix IS NULL THEN RAISE EXCEPTION 'Company % not found', p_company_id; END IF;
  RETURN v_prefix || '-' || lpad(v_number::text, 4, '0');
END; $$;
GRANT EXECUTE ON FUNCTION generate_receipt_number(uuid) TO authenticated;

-- ─── recompute a PO's received_status ────────────────────────
CREATE OR REPLACE FUNCTION recompute_po_received_status(p_po_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_full int; v_any int; v_status text;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE recv >= li.quantity),
         count(*) FILTER (WHERE recv > 0)
  INTO v_total, v_full, v_any
  FROM po_line_items li
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(rli.quantity_received), 0) AS recv
    FROM receipt_line_items rli WHERE rli.po_line_id = li.id
  ) r ON true
  WHERE li.po_id = p_po_id;

  v_status := CASE WHEN v_total > 0 AND v_full = v_total THEN 'full'
                   WHEN v_any > 0 THEN 'partial'
                   ELSE 'none' END;
  UPDATE purchase_orders SET received_status = v_status WHERE id = p_po_id;
  RETURN v_status;
END; $$;

-- ─── create_receipt ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_receipt(
  p_po_id uuid, p_received_date date, p_supplier_receipt_no text, p_note text, p_lines jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid; v_po purchase_orders%ROWTYPE; v_num text; v_receipt_id uuid;
  v_line jsonb; v_po_line uuid; v_qty numeric; v_ordered numeric; v_received numeric;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
  IF v_po.id IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF v_po.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_po.status NOT IN ('issued', 'sent') THEN RAISE EXCEPTION 'Only issued or sent orders can be received'; END IF;
  IF NOT (has_perm('receipts', 'create') OR is_my_admin()) THEN RAISE EXCEPTION 'No permission to receive'; END IF;

  v_num := generate_receipt_number(v_po.company_id);
  INSERT INTO receipts (company_id, po_id, receipt_number, received_by, received_date, supplier_receipt_no, note)
  VALUES (v_po.company_id, p_po_id, v_num, v_uid, p_received_date, p_supplier_receipt_no, p_note)
  RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_po_line := (v_line->>'po_line_id')::uuid;
    v_qty := (v_line->>'quantity_received')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    SELECT quantity INTO v_ordered FROM po_line_items WHERE id = v_po_line AND po_id = p_po_id;
    IF v_ordered IS NULL THEN RAISE EXCEPTION 'Invalid line'; END IF;
    SELECT coalesce(sum(quantity_received), 0) INTO v_received FROM receipt_line_items WHERE po_line_id = v_po_line;
    IF v_qty > (v_ordered - v_received) THEN RAISE EXCEPTION 'Received quantity exceeds remaining'; END IF;

    INSERT INTO receipt_line_items (receipt_id, po_line_id, quantity_received)
    VALUES (v_receipt_id, v_po_line, v_qty);
  END LOOP;

  PERFORM recompute_po_received_status(p_po_id);

  INSERT INTO po_activity_log (company_id, po_id, actor_id, action, note)
  VALUES (v_po.company_id, p_po_id, v_uid, 'received', v_num);

  RETURN v_receipt_id;
END; $$;
GRANT EXECUTE ON FUNCTION create_receipt(uuid, date, text, text, jsonb) TO authenticated;


-- ===== 20260614060000_receipts_rejected_autoclose.sql =====
-- ============================================================
-- 20260614060000_receipts_rejected_autoclose.sql
-- Precoro-like receiving: rejected quantities + auto-close (Received)
-- on full receipt.
-- ============================================================

ALTER TABLE receipt_line_items ADD COLUMN IF NOT EXISTS quantity_rejected numeric(12,3) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION create_receipt(
  p_po_id uuid, p_received_date date, p_supplier_receipt_no text, p_note text, p_lines jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid; v_po purchase_orders%ROWTYPE; v_num text; v_receipt_id uuid;
  v_line jsonb; v_po_line uuid; v_qty numeric; v_rej numeric; v_ordered numeric; v_received numeric;
  v_recv_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
  IF v_po.id IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF v_po.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_po.status NOT IN ('issued', 'sent') THEN RAISE EXCEPTION 'Only issued or sent orders can be received'; END IF;
  IF NOT (has_perm('receipts', 'create') OR is_my_admin()) THEN RAISE EXCEPTION 'No permission to receive'; END IF;

  v_num := generate_receipt_number(v_po.company_id);
  INSERT INTO receipts (company_id, po_id, receipt_number, received_by, received_date, supplier_receipt_no, note)
  VALUES (v_po.company_id, p_po_id, v_num, v_uid, p_received_date, p_supplier_receipt_no, p_note)
  RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_po_line := (v_line->>'po_line_id')::uuid;
    v_qty := coalesce((v_line->>'quantity_received')::numeric, 0);
    v_rej := coalesce((v_line->>'quantity_rejected')::numeric, 0);
    IF v_qty <= 0 AND v_rej <= 0 THEN CONTINUE; END IF;

    SELECT quantity INTO v_ordered FROM po_line_items WHERE id = v_po_line AND po_id = p_po_id;
    IF v_ordered IS NULL THEN RAISE EXCEPTION 'Invalid line'; END IF;
    SELECT coalesce(sum(quantity_received), 0) INTO v_received FROM receipt_line_items WHERE po_line_id = v_po_line;
    IF v_qty > (v_ordered - v_received) THEN RAISE EXCEPTION 'Received quantity exceeds remaining'; END IF;

    INSERT INTO receipt_line_items (receipt_id, po_line_id, quantity_received, quantity_rejected)
    VALUES (v_receipt_id, v_po_line, v_qty, v_rej);
  END LOOP;

  v_recv_status := recompute_po_received_status(p_po_id);

  -- Fully received → order becomes "Received" (closed); remember prior status for reopen
  IF v_recv_status = 'full' AND v_po.status IN ('issued', 'sent') THEN
    UPDATE purchase_orders SET status = 'closed', prev_status = v_po.status, updated_at = now() WHERE id = p_po_id;
  END IF;

  INSERT INTO po_activity_log (company_id, po_id, actor_id, action, note)
  VALUES (v_po.company_id, p_po_id, v_uid, 'received', v_num);

  RETURN v_receipt_id;
END; $$;
GRANT EXECUTE ON FUNCTION create_receipt(uuid, date, text, text, jsonb) TO authenticated;


-- ===== 20260614070000_receive_sent_only.sql =====
-- ============================================================
-- 20260614070000_receive_sent_only.sql
-- Receiving is allowed only on SENT orders (issued must be marked
-- as sent first).
-- ============================================================

CREATE OR REPLACE FUNCTION create_receipt(
  p_po_id uuid, p_received_date date, p_supplier_receipt_no text, p_note text, p_lines jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid; v_po purchase_orders%ROWTYPE; v_num text; v_receipt_id uuid;
  v_line jsonb; v_po_line uuid; v_qty numeric; v_rej numeric; v_ordered numeric; v_received numeric;
  v_recv_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
  IF v_po.id IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF v_po.company_id <> get_my_company_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_po.status <> 'sent' THEN RAISE EXCEPTION 'Only sent orders can be received'; END IF;
  IF NOT (has_perm('receipts', 'create') OR is_my_admin()) THEN RAISE EXCEPTION 'No permission to receive'; END IF;

  v_num := generate_receipt_number(v_po.company_id);
  INSERT INTO receipts (company_id, po_id, receipt_number, received_by, received_date, supplier_receipt_no, note)
  VALUES (v_po.company_id, p_po_id, v_num, v_uid, p_received_date, p_supplier_receipt_no, p_note)
  RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_po_line := (v_line->>'po_line_id')::uuid;
    v_qty := coalesce((v_line->>'quantity_received')::numeric, 0);
    v_rej := coalesce((v_line->>'quantity_rejected')::numeric, 0);
    IF v_qty <= 0 AND v_rej <= 0 THEN CONTINUE; END IF;

    SELECT quantity INTO v_ordered FROM po_line_items WHERE id = v_po_line AND po_id = p_po_id;
    IF v_ordered IS NULL THEN RAISE EXCEPTION 'Invalid line'; END IF;
    SELECT coalesce(sum(quantity_received), 0) INTO v_received FROM receipt_line_items WHERE po_line_id = v_po_line;
    IF v_qty > (v_ordered - v_received) THEN RAISE EXCEPTION 'Received quantity exceeds remaining'; END IF;

    INSERT INTO receipt_line_items (receipt_id, po_line_id, quantity_received, quantity_rejected)
    VALUES (v_receipt_id, v_po_line, v_qty, v_rej);
  END LOOP;

  v_recv_status := recompute_po_received_status(p_po_id);

  IF v_recv_status = 'full' THEN
    UPDATE purchase_orders SET status = 'closed', prev_status = v_po.status, updated_at = now() WHERE id = p_po_id;
  END IF;

  INSERT INTO po_activity_log (company_id, po_id, actor_id, action, note)
  VALUES (v_po.company_id, p_po_id, v_uid, 'received', v_num);

  RETURN v_receipt_id;
END; $$;
GRANT EXECUTE ON FUNCTION create_receipt(uuid, date, text, text, jsonb) TO authenticated;


