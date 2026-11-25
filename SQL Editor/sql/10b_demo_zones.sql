-- Two extra local roads officers: North Zone and East Zone (about 5.5 km from your first report)
with b as (select lat, lng from public.reports order by created_at limit 1)
insert into public.officers
  (id, full_name, designation, department, gov_email, approved, role, area_name, center_lat, center_lng, radius_km, categories)
select '08736b96-d77c-4f48-87a6-7b3e099bb25b'::uuid, 'Demo North Roads Officer', 'Junior Engineer', 'Highways / Roads Department',
       'roads.local2@demo.test', true, 'local', 'North Zone', b.lat + 0.05, b.lng, 3, '{roads}'::text[]
from b
union all
select '8612cc0f-14d8-4de1-9d74-ae69b4865892'::uuid, 'Demo East Roads Officer', 'Assistant Engineer', 'Highways / Roads Department',
       'roads.local3@demo.test', true, 'local', 'East Zone', b.lat, b.lng + 0.05, 3, '{roads}'::text[]
from b;