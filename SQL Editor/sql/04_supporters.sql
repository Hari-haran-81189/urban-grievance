-- ===== Step 7b: supporters ("same issue") =====

-- Who supported which report (one row per device per report)
create table public.report_supporters (
  report_id  uuid references public.reports(id) on delete cascade,
  device_id  text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, device_id)
);

-- Locked: no policies and no grants, so only the function below can use it
alter table public.report_supporters enable row level security;

create or replace function public.add_supporter(p_report uuid, p_device text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already boolean;
  v_count   int;
begin
  if p_device is null or char_length(p_device) < 10 or char_length(p_device) > 100 then
    raise exception 'invalid device';
  end if;
  if not exists (select 1 from reports where id = p_report and status = 'unsolved') then
    raise exception 'report not found or already solved';
  end if;

  -- Already counted? (the original reporter's device, or an earlier supporter)
  v_already :=
       exists (select 1 from report_private    where report_id = p_report and device_id = p_device)
    or exists (select 1 from report_supporters  where report_id = p_report and device_id = p_device);

  if not v_already then
    insert into report_supporters (report_id, device_id) values (p_report, p_device);
  end if;

  -- severity = the original reporter + all supporters
  select count(*) into v_count from report_supporters where report_id = p_report;
  update reports set severity = 1 + v_count where id = p_report;

  return json_build_object('severity', 1 + v_count, 'already_counted', v_already);
end;
$$;

revoke all on function public.add_supporter(uuid, text) from public;
grant execute on function public.add_supporter(uuid, text) to anon, authenticated;