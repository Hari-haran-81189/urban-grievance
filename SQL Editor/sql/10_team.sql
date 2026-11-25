-- ===== Step 15: team overview for higher authorities =====
-- Returns one row per local officer under the caller (same category + inside the caller's radius).
-- Never returns emails or ids.
create or replace function public.get_team_overview()
returns table(full_name text, designation text, area_name text,
              center_lat float8, center_lng float8, radius_km real,
              total int, solved int, pending int, oldest_pending_days int)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_me officers%rowtype;
begin
  select * into v_me from officers where id = auth.uid() and approved = true and role = 'higher';
  if not found then raise exception 'not a higher authority'; end if;

  return query
  select o.full_name, o.designation, o.area_name, o.center_lat, o.center_lng, o.radius_km,
         coalesce(s.total, 0)::int,
         coalesce(s.solved, 0)::int,
         coalesce(s.pending, 0)::int,
         coalesce(s.oldest, 0)::int
  from officers o
  left join lateral (
    select count(*) as total,
           count(*) filter (where r.status = 'done') as solved,
           count(*) filter (where r.status <> 'done') as pending,
           max(extract(day from (now() - r.created_at))) filter (where r.status <> 'done') as oldest
    from reports r
    where r.category = any (o.categories)
      and r.category = any (v_me.categories)
      and distance_m(o.center_lat, o.center_lng, r.lat, r.lng) <= o.radius_km * 1000
  ) s on true
  where o.role = 'local' and o.approved = true
    and o.categories && v_me.categories
    and distance_m(v_me.center_lat, v_me.center_lng, o.center_lat, o.center_lng) <= v_me.radius_km * 1000
  order by 9 desc;      -- most pending first
end;
$$;

revoke all on function public.get_team_overview() from public;
grant execute on function public.get_team_overview() to authenticated;