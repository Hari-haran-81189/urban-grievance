-- ===== Steps 11+12: fix proof (after photo) + automatic DONE check =====

-- Settings table (so you can change the allowed distance in the Table Editor)
create table public.app_settings (key text primary key, value text not null);
insert into public.app_settings values ('done_distance_m', '20');
alter table public.app_settings enable row level security;   -- locked: only functions read it

-- Distance in metres between two GPS points
create or replace function public.distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8
language sql
immutable
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

-- An approved official uploads the "after" photo
create or replace function public.submit_after_photo(p_report uuid, p_photo_path text, p_lat float8, p_lng float8)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_off   officers%rowtype;
  v_rep   reports%rowtype;
  v_limit float8;
  v_dist  float8;
  v_ok    boolean;
begin
  select * into v_off from officers where id = auth.uid() and approved = true;
  if not found then raise exception 'not an approved official'; end if;

  select * into v_rep from reports where id = p_report;
  if not found then raise exception 'report not found'; end if;
  if v_rep.status = 'done' then raise exception 'report is already solved'; end if;

  if not (v_rep.category = any (v_off.categories)) then
    raise exception 'outside your department';
  end if;
  if distance_m(v_off.center_lat, v_off.center_lng, v_rep.lat, v_rep.lng) > v_off.radius_km * 1000 then
    raise exception 'outside your area';
  end if;

  if p_photo_path is null or char_length(p_photo_path) > 200 then raise exception 'invalid photo'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid location'; end if;

  select coalesce((select value::float8 from app_settings where key = 'done_distance_m'), 20) into v_limit;
  v_dist := distance_m(v_rep.lat, v_rep.lng, p_lat, p_lng);
  v_ok   := v_dist <= v_limit;

  insert into after_photos (report_id, officer_id, photo_path, lat, lng, distance_m, confirmed)
  values (p_report, v_off.id, p_photo_path, p_lat, p_lng, v_dist, v_ok);

  if v_ok then
    update reports set status = 'done' where id = p_report;
  end if;

  return json_build_object('distance_m', round(v_dist::numeric, 1), 'confirmed', v_ok);
end;
$$;

-- Public can see the after photos with the officer's name and designation (never email or id)
create or replace function public.get_after_photos(p_report uuid)
returns table(photo_path text, distance_m real, confirmed boolean, created_at timestamptz,
              full_name text, designation text, department text)
language sql
security definer
set search_path = public
stable
as $$
  select a.photo_path, a.distance_m, a.confirmed, a.created_at, o.full_name, o.designation, o.department
  from after_photos a
  join officers o on o.id = a.officer_id
  where a.report_id = p_report
  order by a.created_at desc;
$$;

revoke all on function public.submit_after_photo(uuid, text, float8, float8) from public;
revoke all on function public.get_after_photos(uuid) from public;
grant execute on function public.submit_after_photo(uuid, text, float8, float8) to authenticated;
grant execute on function public.get_after_photos(uuid) to anon, authenticated;