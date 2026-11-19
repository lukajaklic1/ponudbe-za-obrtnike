-- Price with 100% advance payment: a default discount in the company settings,
-- copied to each quote where it can be changed. The quote and the PDF show both prices.
alter table public.companies add column if not exists advance_discount_pct numeric not null default 3;
alter table public.quotes add column if not exists advance_discount_pct numeric;
