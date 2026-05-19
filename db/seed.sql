-- Dev seed data. Run AFTER schema.sql, triggers.sql, policies.sql.
-- IMPORTANT: Create the auth users first via Supabase Auth UI or admin API,
-- then update the UUIDs below to match, then run this script.

-- ============================================================
-- Stores
-- ============================================================
insert into stores (code, name) values
  ('NCR01', 'Delhi - Connaught Place'),
  ('MUM02', 'Mumbai - Bandra')
on conflict (code) do nothing;

-- ============================================================
-- App users (link to Supabase Auth users created out-of-band)
-- Replace the UUIDs below with the IDs from auth.users for each created account.
-- ============================================================

-- Example (uncomment and replace UUIDs after creating in Supabase Auth):
-- insert into app_users (id, email, role, store_id, must_change_password) values
--   ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'admin', null, true),
--   ('00000000-0000-0000-0000-000000000002', 'mgr.ncr01@example.com', 'manager',
--     (select id from stores where code='NCR01'), true),
--   ('00000000-0000-0000-0000-000000000003', 'mgr.mum02@example.com', 'manager',
--     (select id from stores where code='MUM02'), true)
-- on conflict (id) do nothing;

-- ============================================================
-- Sample packers (no bank details yet)
-- ============================================================
insert into packers (emp_id, name, store_id)
select * from (values
  ('PKR001', 'Ramesh Kumar',  (select id from stores where code='NCR01')),
  ('PKR002', 'Sunita Sharma', (select id from stores where code='NCR01')),
  ('PKR003', 'Amit Verma',    (select id from stores where code='NCR01')),
  ('PKR101', 'Priya Patel',   (select id from stores where code='MUM02')),
  ('PKR102', 'Vikram Singh',  (select id from stores where code='MUM02'))
) as t(emp_id, name, store_id)
on conflict (emp_id, store_id) do nothing;

-- Open an initial cycle for the current month
insert into cycles (month, status)
values (to_char(now(), 'YYYY-MM'), 'open')
on conflict (month) do nothing;
