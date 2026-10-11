-- Security fixes round 4
-- 1. Quote status transition enforcement via trigger
-- 2. Prevent quote_counter from being decreased

-- ─── 1. Quote status transition trigger ──────────────────────────────────────
-- Final statuses (won/lost/accepted/rejected) require is_admin OR can_approve.
-- Other transitions (draft→issued→sent→expired) only require company membership
-- which is already enforced by RLS.

CREATE OR REPLACE FUNCTION check_quote_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin   boolean;
  v_can_approve boolean;
BEGIN
  -- No status change — nothing to check
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Transitions to final/locked states require elevated permission
  IF NEW.status IN ('won', 'lost', 'accepted', 'rejected') THEN
    SELECT is_admin INTO v_is_admin
    FROM users WHERE id = auth.uid() AND is_active = true;

    IF NOT COALESCE(v_is_admin, false) THEN
      SELECT can_approve INTO v_can_approve
      FROM user_permissions
      WHERE user_id = auth.uid() AND module = 'quotes';

      IF NOT COALESCE(v_can_approve, false) THEN
        RAISE EXCEPTION 'Insufficient permissions to mark quote as %', NEW.status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_status_transition_check ON quotes;
CREATE TRIGGER quote_status_transition_check
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION check_quote_status_transition();


-- ─── 2. Prevent quote_counter from being decreased ───────────────────────────

CREATE OR REPLACE FUNCTION prevent_quote_counter_decrease()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quote_counter < OLD.quote_counter THEN
    RAISE EXCEPTION 'quote_counter cannot be decreased (would cause duplicate quote numbers)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_quote_counter_decrease ON companies;
CREATE TRIGGER prevent_quote_counter_decrease
  BEFORE UPDATE OF quote_counter ON companies
  FOR EACH ROW
  EXECUTE FUNCTION prevent_quote_counter_decrease();
