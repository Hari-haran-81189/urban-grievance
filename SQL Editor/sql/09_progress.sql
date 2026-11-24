-- ===== Step 14: task progress (Acknowledged / In progress) =====

-- New column: new -> acknowledged -> in_progress -> solved
alter table public.reports
  add column progress text not null default 'submitted'
  check (progress in ('submitted','acknowledged','in_progress','solved'));

-- Reports that are already solved
update public.reports set progress = 'solved' where status = 'done';

-- Whenever a report becomes 'done', progress becomes 'solved' automatically
create or replace function public.sync_progress()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' then new.progress := 'solved'; end if;
  return new;
end;
$$;

create trigger reports_sync_progress
  before update of status on public.reports
  for each row execute function public.sync_progress();

-- Safety: new reports must start as 'submitted' (rebuild the insert rule)
drop policy "insert reports" on public.reports;
create policy "insert reports" on public.reports for insert
  with check (status = 'unsolved' and severity = 1 and likes = 0 and dislikes = 0
              and flag_count = 0 and progress = 'submitted');

-- An approved official (right department + area) sets Acknowledged / In progress
create or replace function public.set_progress(p_report uuid, p_progress text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_off officers%rowtype;
  v_rep reports%rowtype;
begin
  if p_progress not in ('acknowledged', 'in_progress') then raise exception 'invalid progress'; end if;

  select * into v_off from officers where id = auth.uid() and approved = true;
  if not found then raise exception 'not an approved official'; end if;

  select * into v_rep from reports where id = p_report;
  if not found then raise exception 'report not found'; end if;
  if v_rep.status = 'done' then raise exception 'report is already solved'; end if;

  if not (v_rep.category = any (v_off.categories)) then raise exception 'outside your department'; end if;
  if distance_m(v_off.center_lat, v_off.center_lng, v_rep.lat, v_rep.lng) > v_off.radius_km * 1000 then
    raise exception 'outside your area';
  end if;

  update reports set progress = p_progress where id = p_report;
  return p_progress;
end;
$$;

revoke all on function public.set_progress(uuid, text) from public;
grant execute on function public.set_progress(uuid, text) to authenticated;