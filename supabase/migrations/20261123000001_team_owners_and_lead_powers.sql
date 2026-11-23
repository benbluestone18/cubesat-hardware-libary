-- Team owners, leaving a team, and lead powers scoped to the lead's own project.
--
-- Every team (project) has one owner, and the owner is always one of its leads.
-- Leads can do inside their own project what an admin can do anywhere: add and remove people,
-- choose leads, edit the project, its parts, files, links and updates, remove comments, and
-- restore its folders, parts and files from the trash. They get nothing site-wide.
-- Only the owner (or an admin) can hand the team to someone else. The owner can't leave, be removed,
-- or step down as lead while anyone else is on the team; they hand it over first. The last person on
-- a team can always leave, and whoever joins an empty team next becomes its owner.

-- ---------------------------------------------------------------------------
-- Owner column, filled in for existing teams
-- ---------------------------------------------------------------------------
alter table public.projects add column owner_id uuid references public.people (id) on delete set null;

-- The creator if they are still on the team (made a lead if they weren't), otherwise the
-- longest-standing lead. A team with neither has no owner: an admin can hand it to someone on it,
-- and an empty one goes to whoever joins next. Not logged: nobody did this by hand.
alter table public.projects disable trigger log_projects;
alter table public.memberships disable trigger log_memberships_update;
update public.projects p set owner_id = coalesce(
  (select m.person_id from public.memberships m where m.project_id = p.id and m.person_id = p.created_by),
  (select m.person_id from public.memberships m where m.project_id = p.id and m.lead order by m.joined_at, m.person_id limit 1)
);
update public.memberships m set lead = true
  from public.projects p where p.id = m.project_id and p.owner_id = m.person_id and not m.lead;
alter table public.projects enable trigger log_projects;
alter table public.memberships enable trigger log_memberships_update;

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_team_lead(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships where project_id = pid and person_id = auth.uid() and lead);
$$;

-- A lead of the project this component belongs to.
create or replace function public.is_component_lead(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.components c join public.memberships m on m.project_id = c.project_id
     where c.id = cid and m.person_id = auth.uid() and m.lead);
$$;

-- Edit a part: the admin, its owner, its editors, and the leads of its project.
create or replace function public.can_edit_component(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or exists (select 1 from public.components where id = cid and owner_id = auth.uid())
      or exists (select 1 from public.component_editors where component_id = cid and person_id = auth.uid())
      or public.is_component_lead(cid);
$$;

-- Choose a part's editors and hand it off: the admin, its owner, and the leads of its project.
create or replace function public.can_manage_component(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or exists (select 1 from public.components where id = cid and owner_id = auth.uid())
      or public.is_component_lead(cid);
$$;

revoke execute on function public.is_team_lead(uuid), public.is_component_lead(uuid), public.can_manage_component(uuid)
  from public, anon;
grant execute on function public.is_team_lead(uuid), public.is_component_lead(uuid), public.can_manage_component(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Owners: set on create, changed only by handing the team over
-- ---------------------------------------------------------------------------
-- Owner changes go through transfer_team or the membership triggers below, which set this flag for
-- the rest of their own statement. Signed-in people can't set it: the API only exposes public functions.
create or replace function public.guard_project_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := new.created_by;
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id then
    if auth.uid() is not null and coalesce(current_setting('app.owner_change', true), '') <> 'on' then
      raise exception 'Use Transfer ownership to hand a team to someone else';
    end if;
    if new.owner_id is not null and not exists (
      select 1 from public.memberships where project_id = new.id and person_id = new.owner_id and lead) then
      raise exception 'A team''s owner must be one of its leads';
    end if;
  end if;
  return new;
end;
$$;
create trigger projects_guard_owner before insert or update on public.projects
  for each row execute function public.guard_project_owner();

-- Whoever makes a project joins it as its lead and owner.
create or replace function public.add_project_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.memberships (person_id, project_id, lead) values (new.created_by, new.id, true)
  on conflict (person_id, project_id) do update set lead = true;
  return null;
end;
$$;
create trigger projects_add_creator after insert on public.projects
  for each row execute function public.add_project_creator();

-- Hand a team to someone already on it. They become a lead too. The old owner stays a lead and can
-- step down afterwards. Allowed for the owner, an admin, or any lead of a team that has no owner.
create or replace function public.transfer_team(pid uuid, new_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_owner uuid;
begin
  select owner_id into current_owner from public.projects where id = pid and deleted_at is null for update;
  if not found then
    raise exception 'That team doesn''t exist or is in the trash';
  end if;
  if not (public.is_admin()
          or coalesce(current_owner = auth.uid(), false)
          or (current_owner is null and public.is_team_lead(pid))) then
    raise exception 'Only the team''s owner or an admin can hand it over' using errcode = '42501';
  end if;
  if not exists (select 1 from public.memberships where project_id = pid and person_id = new_owner) then
    raise exception 'Add them to the team before handing it over';
  end if;
  perform set_config('app.owner_change', 'on', true);
  update public.memberships set lead = true where project_id = pid and person_id = new_owner and not lead;
  update public.projects set owner_id = new_owner where id = pid;
  perform set_config('app.owner_change', 'off', true);
end;
$$;
revoke execute on function public.transfer_team(uuid, uuid) from public, anon;
grant execute on function public.transfer_team(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Memberships: protect the owner, and fill an empty team's owner seat
-- ---------------------------------------------------------------------------
-- Only checked for signed-in requests, so deleting an account from the Supabase dashboard still works.
create or replace function public.guard_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  team_owner uuid;
begin
  select owner_id into team_owner from public.projects where id = old.project_id;
  if auth.uid() is null or team_owner is null or old.person_id <> team_owner then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' then
    if old.lead and not new.lead then
      raise exception 'The owner is always a lead. Hand the team to someone else first.';
    end if;
    return new;
  end if;
  -- The owner is leaving or being removed.
  if exists (select 1 from public.memberships where project_id = old.project_id and person_id <> old.person_id) then
    if old.person_id = auth.uid() then
      raise exception 'You own this team. Hand it to someone else before you leave.';
    end if;
    raise exception 'That person owns this team. Hand it to someone else before removing them.';
  end if;
  -- Last one out: the team is left without an owner until someone joins.
  perform set_config('app.owner_change', 'on', true);
  update public.projects set owner_id = null where id = old.project_id;
  perform set_config('app.owner_change', 'off', true);
  return old;
end;
$$;
create trigger memberships_guard before update or delete on public.memberships
  for each row execute function public.guard_membership();

-- The first person on an empty team with no owner leads and owns it.
create or replace function public.claim_empty_team()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select owner_id from public.projects where id = new.project_id) is null
     and not exists (select 1 from public.memberships where project_id = new.project_id and person_id <> new.person_id) then
    perform set_config('app.owner_change', 'on', true);
    update public.memberships set lead = true where project_id = new.project_id and person_id = new.person_id and not lead;
    update public.projects set owner_id = new.person_id where id = new.project_id;
    perform set_config('app.owner_change', 'off', true);
  end if;
  return null;
end;
$$;
create trigger memberships_claim_empty after insert on public.memberships
  for each row execute function public.claim_empty_team();

revoke execute on function public.guard_project_owner(), public.add_project_creator(), public.guard_membership(),
  public.claim_empty_team() from public, anon, authenticated;

-- Join yourself (never as a lead), or add anyone if you lead the team or are an admin.
-- The creator is added by the database now, so the old "creator may join as lead" exception is gone.
drop policy memberships_add on public.memberships;
create policy memberships_add on public.memberships for insert to authenticated
  with check (public.can_manage_team(project_id) or (person_id = auth.uid() and not lead));

-- ---------------------------------------------------------------------------
-- Leads' powers inside their own project
-- ---------------------------------------------------------------------------
-- Project settings (name, description, status, budgets) and trashing: the team's leads and admins.
drop policy projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (public.can_manage_team(id)) with check (public.can_manage_team(id));

-- Folders: anyone can still edit them; leads and admins restore them from the trash.
drop policy folders_update on public.folders;
create policy folders_update on public.folders for update to authenticated
  using (public.is_member() and (deleted_at is null or public.can_manage_team(project_id)))
  with check (public.is_member());

-- Parts: leads edit every part in their project (via can_edit_component) and restore trashed ones.
drop policy components_update on public.components;
create policy components_update on public.components for update to authenticated
  using (public.can_edit_component(id) and (deleted_at is null or public.can_manage_team(project_id)))
  with check (public.is_member());

-- Editors and hand-offs: the part's owner, the project's leads, and admins.
drop policy editors_grant on public.component_editors;
create policy editors_grant on public.component_editors for insert to authenticated
  with check (public.can_manage_component(component_id) and granted_by = auth.uid());
drop policy editors_revoke on public.component_editors;
create policy editors_revoke on public.component_editors for delete to authenticated
  using (public.can_manage_component(component_id));

create or replace function public.guard_component_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id
     and not (old.owner_id = auth.uid() or public.is_admin() or public.is_team_lead(old.project_id)) then
    raise exception 'Only the owner can hand off a component';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Comments and updates: leads can remove them on their project's parts, like the admin can anywhere.
drop policy comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin() or public.is_component_lead(component_id));
drop policy updates_delete on public.updates;
create policy updates_delete on public.updates for delete to authenticated
  using (author_id = auth.uid() or public.is_admin() or public.is_component_lead(component_id));
