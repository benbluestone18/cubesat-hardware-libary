-- The newest update per component and per author. Reading these instead of every update keeps
-- pages under the API's 1000-row cap however many weeks of updates pile up.
-- security_invoker: the reader's own permission rules apply.
create view public.latest_updates with (security_invoker = true) as
  select distinct on (component_id) * from public.updates order by component_id, week_start desc, created_at desc;

create view public.latest_update_by_author with (security_invoker = true) as
  select distinct on (author_id) author_id, created_at from public.updates order by author_id, created_at desc;

revoke all on public.latest_updates, public.latest_update_by_author from anon;
grant select on public.latest_updates, public.latest_update_by_author to authenticated;
