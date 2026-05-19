-- Row Level Security policies.
-- Critical: enforce store isolation and cycle lock at the DB layer.

-- Enable RLS on all tables
alter table stores enable row level security;
alter table app_users enable row level security;
alter table packers enable row level security;
alter table cycles enable row level security;
alter table cycle_packers enable row level security;
alter table audit_log enable row level security;

-- ============================================================
-- stores
-- ============================================================
drop policy if exists stores_select on stores;
create policy stores_select on stores
  for select using (auth.uid() is not null);

drop policy if exists stores_admin_write on stores;
create policy stores_admin_write on stores
  for all using (is_admin()) with check (is_admin());

-- ============================================================
-- app_users
-- ============================================================
drop policy if exists app_users_self_select on app_users;
create policy app_users_self_select on app_users
  for select using (id = auth.uid() or is_admin());

drop policy if exists app_users_admin_write on app_users;
create policy app_users_admin_write on app_users
  for all using (is_admin()) with check (is_admin());

-- ============================================================
-- packers
-- ============================================================
-- Admin: full read access
drop policy if exists packers_admin_select on packers;
create policy packers_admin_select on packers
  for select using (is_admin());

-- Manager: read only their store
drop policy if exists packers_manager_select on packers;
create policy packers_manager_select on packers
  for select using (
    store_id = my_store_id()
  );

-- Admin: write any packer (insert/update/delete)
-- Note: admin can edit even when cycle closed (with confirmation in UI)
drop policy if exists packers_admin_write on packers;
create policy packers_admin_write on packers
  for all using (is_admin()) with check (is_admin());

-- Manager: update only their store packers, and only when a cycle is open
drop policy if exists packers_manager_update on packers;
create policy packers_manager_update on packers
  for update using (
    store_id = my_store_id()
    and current_open_cycle_id() is not null
  ) with check (
    store_id = my_store_id()
    and current_open_cycle_id() is not null
  );

-- ============================================================
-- cycles
-- ============================================================
drop policy if exists cycles_select on cycles;
create policy cycles_select on cycles
  for select using (auth.uid() is not null);

drop policy if exists cycles_admin_write on cycles;
create policy cycles_admin_write on cycles
  for all using (is_admin()) with check (is_admin());

-- ============================================================
-- cycle_packers
-- ============================================================
drop policy if exists cycle_packers_admin_all on cycle_packers;
create policy cycle_packers_admin_all on cycle_packers
  for all using (is_admin()) with check (is_admin());

drop policy if exists cycle_packers_manager_select on cycle_packers;
create policy cycle_packers_manager_select on cycle_packers
  for select using (store_id = my_store_id());

-- ============================================================
-- audit_log
-- ============================================================
drop policy if exists audit_log_admin_select on audit_log;
create policy audit_log_admin_select on audit_log
  for select using (is_admin());

-- Inserts come from SECURITY DEFINER trigger functions; no user-facing insert policy needed.
