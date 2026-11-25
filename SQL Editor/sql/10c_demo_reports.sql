-- Demo reports around your first report. All start with "Demo data:" so they are easy to delete.
with base as (select lat as blat, lng as blng, photo_path as bphoto
              from public.reports order by created_at limit 1)
insert into public.reports (title, category, description, lat, lng, photo_path, status, progress, severity, created_at)
select v.title, v.category, 'Demo data: ' || v.title,
       base.blat + v.dlat, base.blng + v.dlng, base.bphoto,
       v.status, v.progress, v.severity, now() - make_interval(days => v.days)
from base,
(values
  -- Campus zone
  ('Deep pothole near main gate',        'roads', 0.003,  0.002, 'unsolved', 'submitted',   8, 14),
  ('Broken road edge by the bus stop',   'roads',-0.004,  0.005, 'unsolved', 'in_progress', 4,  9),
  ('Waterlogged road after rain',        'roads', 0.006, -0.003, 'unsolved', 'acknowledged',3,  5),
  ('Cracked speed breaker',              'roads',-0.002, -0.006, 'done',     'solved',      2, 20),
  ('Missing road marking at junction',   'roads', 0.001,  0.008, 'unsolved', 'submitted',   1,  2),
  -- North zone
  ('Potholes on the service road',       'roads', 0.052,  0.003, 'unsolved', 'submitted',  11, 18),
  ('Road caved in near culvert',         'roads', 0.047, -0.004, 'unsolved', 'submitted',   9, 12),
  ('Loose gravel causing accidents',     'roads', 0.055,  0.006, 'unsolved', 'acknowledged',5,  8),
  ('Damaged road divider',               'roads', 0.049,  0.002, 'done',     'solved',      3, 25),
  -- East zone
  ('Pothole cluster near the market',    'roads', 0.004,  0.052, 'unsolved', 'in_progress', 6, 10),
  ('Uneven road surface',                'roads',-0.003,  0.047, 'done',     'solved',      2, 16),
  ('Broken manhole cover on the road',   'roads', 0.002,  0.055, 'unsolved', 'submitted',   2,  3),
  -- Water officer (campus zone)
  ('Pipe leakage on the main road',      'water_leakage', 0.001, -0.002, 'unsolved', 'submitted', 7, 6),
  ('Dirty water overflow on the street', 'drainage',     -0.005,  0.003, 'unsolved', 'submitted', 5, 11),
  ('Blocked drain near the market',      'drainage',      0.004,  0.004, 'done',     'solved',    2, 13)
) as v(title, category, dlat, dlng, status, progress, severity, days);