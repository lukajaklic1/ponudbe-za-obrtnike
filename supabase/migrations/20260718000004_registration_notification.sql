-- Enable pg_net extension for HTTP calls from DB functions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Modify handle_onboarding to notify super admin after successful registration
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

  -- Idempotency: if user already has a profile, return existing data
  SELECT company_id INTO v_company_id FROM users WHERE id = v_user_id FOR UPDATE;
  IF FOUND THEN
    RETURN json_build_object('company_id', v_company_id, 'user_id', v_user_id);
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.companies (name, currency, po_prefix, po_next_number)
  VALUES (p_company_name, 'EUR', 'PO', 1)
  RETURNING id INTO v_company_id;

  INSERT INTO public.users (id, company_id, first_name, last_name, email, is_admin)
  VALUES (v_user_id, v_company_id, p_first_name, p_last_name, v_user_email, true);

  -- Notify super admin asynchronously (fire-and-forget)
  PERFORM net.http_post(
    url     := (SELECT value FROM vault.secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/notify-registration',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'supabase_anon_key' LIMIT 1)
    ),
    body    := jsonb_build_object(
      'company_name', p_company_name,
      'first_name',   p_first_name,
      'last_name',    p_last_name,
      'email',        v_user_email
    )
  );

  RETURN json_build_object('company_id', v_company_id, 'user_id', v_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.handle_onboarding TO authenticated;
