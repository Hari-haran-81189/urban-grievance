-- ===== Feed votes: which reports has THIS device voted on? =====
create or replace function public.get_my_votes(p_device text, p_reports uuid[])
returns table(report_id uuid, vote smallint)
language sql
security definer
set search_path = public
stable
as $$
  select v.report_id, v.vote
  from report_votes v
  where v.device_id = p_device
    and v.report_id = any(p_reports);
$$;

revoke all on function public.get_my_votes(text, uuid[]) from public;
grant execute on function public.get_my_votes(text, uuid[]) to anon, authenticated;