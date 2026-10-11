-- ============================================================
-- 20260615090000_drop_procurement.sql   (QuotePro migration 009)
-- Requestio → QuotePro: drop all procurement-domain tables.
-- KEEP: companies, users, user_permissions, user_invitations
-- ============================================================

-- Obsolete procurement RPCs / functions (reference dropped tables)
DROP FUNCTION IF EXISTS get_dashboard_stats(uuid, timestamptz, uuid, uuid, uuid, uuid, int) CASCADE;
DROP FUNCTION IF EXISTS generate_po_number(uuid) CASCADE;
DROP FUNCTION IF EXISTS generate_request_number(uuid) CASCADE;
DROP FUNCTION IF EXISTS submit_request(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS create_po_from_request(uuid) CASCADE;
DROP FUNCTION IF EXISTS create_receipt(uuid, date, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS recompute_po_received_status(uuid) CASCADE;

-- Procurement tables — CASCADE drops dependent FKs, policies, triggers, indexes.
-- Explicitly listed by the spec:
DROP TABLE IF EXISTS po_attachments      CASCADE;
DROP TABLE IF EXISTS po_line_items       CASCADE;
DROP TABLE IF EXISTS purchase_orders     CASCADE;
DROP TABLE IF EXISTS items               CASCADE;
DROP TABLE IF EXISTS departments         CASCADE;
DROP TABLE IF EXISTS locations           CASCADE;
DROP TABLE IF EXISTS projects            CASCADE;
DROP TABLE IF EXISTS categories          CASCADE;
DROP TABLE IF EXISTS suppliers           CASCADE;

-- Additional procurement tables present in the clone (Phase 2/3 / receipts):
DROP TABLE IF EXISTS receipt_attachments CASCADE;
DROP TABLE IF EXISTS receipt_line_items  CASCADE;
DROP TABLE IF EXISTS receipts            CASCADE;
DROP TABLE IF EXISTS po_activity_log      CASCADE;
DROP TABLE IF EXISTS activity_log         CASCADE;
DROP TABLE IF EXISTS approvals            CASCADE;
DROP TABLE IF EXISTS request_attachments CASCADE;
DROP TABLE IF EXISTS request_line_items  CASCADE;
DROP TABLE IF EXISTS requests            CASCADE;
