-- ===== Step 8: photo flags =====

-- Public counter of how many different devices flagged the photo
alter table public.reports add column flag_count int not null default 0;

-- Safety: new reports must start with flag_count = 0 (rebuild the insert rule)
drop policy "insert reports" on public.reports;
create policy "insert reports" on public.reports for insert
  with check (status = 'unsolved' and severity = 1 and likes = 0 and dislikes = 0 and flag_count = 0);

-- Flag a photo (one flag per device, never your own photo)
create or replace function public.flag_photo(p_report uuid, p_device text)
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
  if not exists (select 1 from reports where id = p_report) then
    raise exception 'report not found';
  end if;
  if exists (select 1 from report_private where report_id = p_report and device_id = p_device) then
    raise exception 'you cannot flag your own photo';
  end if;

  v_already := exists (select 1 from photo_flags where report_id = p_report and device_id = p_device);
  if not v_already then
    insert into photo_flags (report_id, device_id) values (p_report, p_device);
  end if;

  select count(*) into v_count from photo_flags where report_id = p_report;
  update reports set flag_count = v_count where id = p_report;

  return json_build_object('flag_count', v_count, 'already_flagged', v_already);
end;
$$;

-- Has THIS device already flagged this photo?
create or replace function public.get_my_flag(p_report uuid, p_device text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from photo_flags where report_id = p_report and device_id = p_device);
$$;

revoke all on function public.flag_photo(uuid, text) from public;
revoke all on function public.get_my_flag(uuid, text) from public;
grant execute on function public.flag_photo(uuid, text) to anon, authenticated;
grant execute on function public.get_my_flag(uuid, text) to anon, authenticated;