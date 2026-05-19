-- Audit trigger on packers: any update to bank fields auto-writes audit_log.
-- Runs as the table owner but uses auth.uid() to attribute the change to the calling user.

create or replace function log_packer_changes()
returns trigger language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
begin
  -- Log each field that actually changed
  if coalesce(old.bank_account_no, '') is distinct from coalesce(new.bank_account_no, '') then
    insert into audit_log (packer_id, field_changed, old_value, new_value, changed_by)
    values (new.id, 'bank_account_no', old.bank_account_no, new.bank_account_no, v_user);
  end if;

  if coalesce(old.ifsc_code, '') is distinct from coalesce(new.ifsc_code, '') then
    insert into audit_log (packer_id, field_changed, old_value, new_value, changed_by)
    values (new.id, 'ifsc_code', old.ifsc_code, new.ifsc_code, v_user);
  end if;

  if coalesce(old.phone, '') is distinct from coalesce(new.phone, '') then
    insert into audit_log (packer_id, field_changed, old_value, new_value, changed_by)
    values (new.id, 'phone', old.phone, new.phone, v_user);
  end if;

  if old.name is distinct from new.name then
    insert into audit_log (packer_id, field_changed, old_value, new_value, changed_by)
    values (new.id, 'name', old.name, new.name, v_user);
  end if;

  if old.is_active is distinct from new.is_active then
    insert into audit_log (packer_id, field_changed, old_value, new_value, changed_by)
    values (new.id, 'is_active', old.is_active::text, new.is_active::text, v_user);
  end if;

  -- Derive bank_details_status from current state of the bank fields
  if new.bank_account_no is not null and new.ifsc_code is not null then
    new.bank_details_status := 'provided';
  else
    new.bank_details_status := 'missing';
  end if;

  return new;
end;
$$;

drop trigger if exists packers_audit_trigger on packers;
create trigger packers_audit_trigger
  before update on packers
  for each row execute function log_packer_changes();

-- On insert: derive status, log a creation event
create or replace function log_packer_insert()
returns trigger language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
begin
  if new.bank_account_no is not null and new.ifsc_code is not null then
    new.bank_details_status := 'provided';
  else
    new.bank_details_status := 'missing';
  end if;

  insert into audit_log (packer_id, field_changed, old_value, new_value, changed_by)
  values (new.id, 'packer_created', null,
          format('emp_id=%s store_id=%s', new.emp_id, new.store_id), v_user);

  return new;
end;
$$;

drop trigger if exists packers_insert_trigger on packers;
create trigger packers_insert_trigger
  before insert on packers
  for each row execute function log_packer_insert();
