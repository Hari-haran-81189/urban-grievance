-- ===== Step 7a: voting functions (one vote per device) =====

-- Cast, change or remove a vote.  p_vote: 1 = like, -1 = dislike, 0 = remove my vote
create or replace function public.cast_vote(p_report uuid, p_device text, p_vote smallint)
returns json
language plpgsql
security definer            -- runs with owner rights, so the public table stays locked
set search_path = public
as $$
declare
  v_likes int;
  v_dislikes int;
begin
  if p_vote not in (-1, 0, 1) then raise exception 'invalid vote'; end if;
  if p_device is null or char_length(p_device) < 10 or char_length(p_device) > 100 then
    raise exception 'invalid device';
  end if;
  if not exists (select 1 from reports where id = p_report) then
    raise exception 'report not found';
  end if;

  if p_vote = 0 then
    delete from report_votes where report_id = p_report and device_id = p_device;
  else
    insert into report_votes (report_id, device_id, vote)
    values (p_report, p_device, p_vote)
    on conflict (report_id, device_id) do update set vote = excluded.vote;
  end if;

  -- Recount and store the totals on the report
  select count(*) filter (where vote = 1), count(*) filter (where vote = -1)
    into v_likes, v_dislikes
    from report_votes where report_id = p_report;

  update reports set likes = v_likes, dislikes = v_dislikes where id = p_report;

  return json_build_object('likes', v_likes, 'dislikes', v_dislikes);
end;
$$;

-- Ask: what did THIS device vote? (1, -1 or 0)
create or replace function public.get_my_vote(p_report uuid, p_device text)
returns smallint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select vote from report_votes where report_id = p_report and device_id = p_device), 0
  )::smallint;
$$;

-- Allow the website to call these two functions (and nothing else)
revoke all on function public.cast_vote(uuid, text, smallint) from public;
revoke all on function public.get_my_vote(uuid, text) from public;
grant execute on function public.cast_vote(uuid, text, smallint) to anon, authenticated;
grant execute on function public.get_my_vote(uuid, text) to anon, authenticated;