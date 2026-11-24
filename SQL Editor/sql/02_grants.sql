-- Let the website READ and ADD reports (security rules still block edits/deletes)
grant select, insert on public.reports to anon, authenticated;

-- Let the website ADD the hidden device id (it can never READ it back)
grant insert on public.report_private to anon, authenticated;