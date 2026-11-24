-- ===== Step 9: add urban categories (department names are placeholders) =====
insert into public.departments (category, label, department) values
  ('roads',         'Roads & potholes',         'Highways / Roads Department'),
  ('water_leakage', 'Water leakage / supply',   'Water Supply & Drainage Board'),
  ('drainage',      'Drainage & dirty water',   'Municipal Administration'),
  ('streetlight',   'Streetlights',             'Electricity Board / Municipality'),
  ('trees',         'Trees & green spaces',     'Parks & Forest Department');