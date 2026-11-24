insert into public.officers
  (id, full_name, designation, department, gov_email, approved, role, area_name, center_lat, center_lng, radius_km, categories)
values
  ('cc99a812-ffcd-46fb-8dc9-5ac792cdb5f3', 'Demo Roads Officer',   'Assistant Engineer', 'Highways / Roads Department',
   'roads.local@demo.test',  true, 'local',  'Campus Zone',        11.0784013507168, 77.1428405062517,  3, '{roads}'),

  ('473dbd83-6ad1-4e27-8621-f9a56bf278c7', 'Demo Roads Authority', 'Divisional Engineer', 'Highways / Roads Department',
   'roads.higher@demo.test', true, 'higher', 'District (all zones)', 11.0767908058507, 77.1428405062517, 50, '{roads}'),

  ('5f36ec67-0e9c-4fd4-95f6-d23d598e9b9a', 'Demo Water Officer',   'Junior Engineer', 'Water Supply & Drainage Board',
   'water.local@demo.test',  true, 'local',  'Campus Zone',        11.0784013507168, 77.1428405062517,  3, '{water_leakage,drainage,water}');