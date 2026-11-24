-- ===== Step 10 (part A): officials table upgrade =====
alter table public.officers
  add column role        text not null default 'local' check (role in ('local','higher')),
  add column area_name   text,
  add column center_lat  double precision,
  add column center_lng  double precision,
  add column radius_km   real,
  add column categories  text[] not null default '{}';   -- category codes this official handles

-- An official can read ONLY their own row (nobody else's)
grant select on public.officers to authenticated;
create policy "officials read own row" on public.officers
  for select to authenticated using (id = auth.uid());