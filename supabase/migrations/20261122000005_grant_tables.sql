-- Newer hosted Supabase projects don't give the API roles access to new tables automatically
-- (local ones still do, which is why tests passed locally). Grant signed-in users table access
-- explicitly; the row-level security rules still decide which rows they can see or change.
-- Signed-out visitors (anon) get nothing.
grant select, insert, update, delete on
  public.people, public.projects, public.memberships, public.folders, public.components,
  public.component_editors, public.comments, public.updates, public.files, public.weeks
  to authenticated;
-- The activity log is written only by triggers.
grant select on public.activity_log to authenticated;
