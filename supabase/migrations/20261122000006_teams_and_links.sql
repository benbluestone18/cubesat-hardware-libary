-- Teams are projects. Each project can have team leads, who (with admins) can add and remove
-- people and choose other leads. Anyone can still join or leave a team themselves.

alter table public.memberships
  add column lead boolean not null default false,
  add column added_by uuid references public.people (id) default auth.uid();

create or replace function public.can_manage_team(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or exists (select 1 from public.memberships where project_id = pid and person_id = auth.uid() and lead);
$$;
revoke execute on function public.can_manage_team(uuid) from public, anon;
grant execute on function public.can_manage_team(uuid) to authenticated;

drop policy memberships_join on public.memberships;
drop policy memberships_leave on public.memberships;

-- Join yourself (not as a lead, unless you made the project), or add anyone if you manage the team.
create policy memberships_add on public.memberships for insert to authenticated
  with check (
    public.can_manage_team(project_id)
    or (person_id = auth.uid() and (not lead or exists (
      select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())))
  );
create policy memberships_change on public.memberships for update to authenticated
  using (public.can_manage_team(project_id)) with check (public.can_manage_team(project_id));
create policy memberships_remove on public.memberships for delete to authenticated
  using (person_id = auth.uid() or public.can_manage_team(project_id));

-- Only the lead flag can change on an existing membership.
revoke update on public.memberships from authenticated;
grant update (lead) on public.memberships to authenticated;

create trigger log_memberships_update after update on public.memberships
  for each row execute function public.log_activity();

-- Whoever made a project so far leads it.
update public.memberships m set lead = true
  from public.projects p where p.id = m.project_id and p.created_by = m.person_id;

-- Links on a component, for files that live in Google Drive (or anywhere else on the web).
create table public.component_links (
  id            uuid primary key default gen_random_uuid(),
  component_id  uuid not null references public.components (id) on delete cascade,
  url           text not null check (url ~* '^https://[^\s]+$' and length(url) <= 2000),
  label         text not null check (length(trim(label)) between 1 and 120),
  added_by      uuid not null default auth.uid() references public.people (id),
  created_at    timestamptz not null default now()
);
create index component_links_component on public.component_links (component_id, created_at);
alter table public.component_links enable row level security;
create policy component_links_read on public.component_links for select to authenticated using (public.is_member());
create policy component_links_add on public.component_links for insert to authenticated
  with check (public.can_edit_component(component_id) and added_by = auth.uid());
create policy component_links_remove on public.component_links for delete to authenticated
  using (public.can_edit_component(component_id));
grant select, insert, delete on public.component_links to authenticated;
create trigger log_component_links after insert or delete on public.component_links
  for each row execute function public.log_activity();

-- Uploads: any kind of file, up to 50 MB (the most the free plan allows per file).
-- Downloads are always sent as attachments, so no uploaded file is ever shown as a web page.
update storage.buckets set allowed_mime_types = null, file_size_limit = 50 * 1024 * 1024 where id = 'component-files';
alter table public.files drop constraint files_size_bytes_check;
alter table public.files add constraint files_size_bytes_check check (size_bytes > 0 and size_bytes <= 50 * 1024 * 1024);
