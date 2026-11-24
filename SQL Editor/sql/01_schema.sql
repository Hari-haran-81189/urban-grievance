-- ========== 1. DEPARTMENTS (category -> who gets emailed) ==========
create table public.departments (
  category   text primary key,
  label      text not null,          -- shown to the reporter
  department text not null,          -- placeholder names, confirm later
  email      text                    -- filled in Step 11, hidden from public
);

insert into public.departments (category, label, department) values
  ('water',       'Water & waterbodies',    'Water Resources Department'),
  ('agriculture', 'Agriculture & farmland', 'Agriculture Department'),
  ('waste',       'Waste & garbage',        'Municipal Administration'),
  ('air',         'Air pollution',          'Pollution Control Board'),
  ('forest',      'Forest & wildlife',      'Forest Department'),
  ('noise',       'Noise pollution',        'Pollution Control Board'),
  ('land',        'Land & soil',            'Revenue Department'),
  ('other',       'Other',                  'District Collector');

-- ========== 2. REPORTS (public) ==========
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 3 and 100),
  category      text not null references public.departments(category),
  description   text not null check (char_length(description) between 10 and 1000),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  gps_accuracy_m real,
  photo_path    text not null,                       -- file name in storage
  status        text not null default 'unsolved' check (status in ('unsolved','done')),
  severity      int  not null default 1,             -- petition-style count
  likes         int  not null default 0,
  dislikes      int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ========== 3. PRIVATE reporter data (never readable from the website) ==========
create table public.report_private (
  report_id  uuid primary key references public.reports(id) on delete cascade,
  device_id  text not null,
  created_at timestamptz not null default now()
);

-- ========== 4. VOTES (one per device per report) ==========
create table public.report_votes (
  report_id  uuid references public.reports(id) on delete cascade,
  device_id  text not null,
  vote       smallint not null check (vote in (-1, 1)),
  primary key (report_id, device_id)
);

-- ========== 5. PHOTO FLAGS (different devices flag a photo) ==========
create table public.photo_flags (
  report_id  uuid references public.reports(id) on delete cascade,
  device_id  text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, device_id)
);

-- ========== 6. OFFICERS (admin approves them by hand) ==========
create table public.officers (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  designation text not null,
  department  text not null,
  gov_email   text not null,
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ========== 7. AFTER PHOTOS (fix proof) ==========
create table public.after_photos (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  officer_id  uuid not null references public.officers(id),
  photo_path  text not null,
  lat         double precision not null,
  lng         double precision not null,
  distance_m  real,
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ========== SECURITY: turn on Row Level Security everywhere ==========
alter table public.departments    enable row level security;
alter table public.reports        enable row level security;
alter table public.report_private enable row level security;
alter table public.report_votes   enable row level security;
alter table public.photo_flags    enable row level security;
alter table public.officers       enable row level security;
alter table public.after_photos   enable row level security;

-- Departments: public can read, but NOT the email column
create policy "read departments" on public.departments for select using (true);
revoke select on public.departments from anon, authenticated;
grant  select (category, label, department) on public.departments to anon, authenticated;

-- Reports: anyone can read; anyone can insert ONLY a fresh, untouched report
create policy "read reports" on public.reports for select using (true);
create policy "insert reports" on public.reports for insert
  with check (status = 'unsolved' and severity = 1 and likes = 0 and dislikes = 0);
-- (no update/delete policies = nobody can edit or delete from the website)

-- Private device id: write-only from the website, never readable
create policy "insert private" on public.report_private for insert with check (true);

-- Votes, flags, officers, after_photos: no policies yet (added in Steps 7-9)

-- ========== STORAGE: photo bucket ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "upload report photos" on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'report-photos');
-- (no update/delete policy = photos cannot be removed from the website)