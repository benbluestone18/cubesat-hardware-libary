-- CubeSat hardware library: schema, permission rules and activity log.
-- Permissions are enforced here with row-level security, not only in the interface.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- People: one row per signed-in @lgsstudent.org account
-- ---------------------------------------------------------------------------
create table public.people (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  email       text not null unique,
  avatar_url  text,
  role        text not null default 'member' check (role in ('member', 'admin')),
  theme       text check (theme in ('light', 'dark')),
  created_at  timestamptz not null default now()
);

-- Only school accounts get in. A sign-in from any other domain is refused here,
-- so it cannot be bypassed from the browser.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_first boolean;
begin
  if new.email is null or lower(new.email) not like '%@lgsstudent.org' then
    raise exception 'Only @lgsstudent.org accounts can use the hardware library';
  end if;
  select not exists (select 1 from public.people) into is_first;
  insert into public.people (id, name, email, avatar_url, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    lower(new.email),
    new.raw_user_meta_data ->> 'avatar_url',
    -- The first person to sign in sets the library up, so they become the admin.
    case when is_first then 'admin' else 'member' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.people where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.people where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Projects, memberships and folders: anyone signed in can create and edit them
-- ---------------------------------------------------------------------------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 80),
  description  text not null default '' check (length(description) <= 2000),
  status       text not null default 'active' check (status in ('active', 'paused', 'done')),
  created_by   uuid not null default auth.uid() references public.people (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create unique index projects_name_unique on public.projects (lower(name)) where deleted_at is null;

create table public.memberships (
  person_id   uuid not null references public.people (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (person_id, project_id)
);

create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  parent_id   uuid references public.folders (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  created_by  uuid not null default auth.uid() references public.people (id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check (parent_id is null or parent_id <> id)
);
create index folders_project on public.folders (project_id);

-- A folder must sit in the same project as its parent, and never inside itself.
create or replace function public.check_folder_parent()
returns trigger language plpgsql set search_path = '' as $$
declare
  cursor_id uuid := new.parent_id;
  depth int := 0;
begin
  if new.parent_id is null then return new; end if;
  if (select project_id from public.folders where id = new.parent_id) is distinct from new.project_id then
    raise exception 'A folder must be in the same project as its parent';
  end if;
  while cursor_id is not null loop
    if cursor_id = new.id then raise exception 'A folder cannot be moved inside itself'; end if;
    depth := depth + 1;
    if depth > 32 then raise exception 'Folders can only nest 32 levels deep'; end if;
    select parent_id into cursor_id from public.folders where id = cursor_id;
  end loop;
  return new;
end;
$$;
create trigger folders_check_parent before insert or update of parent_id, project_id on public.folders
  for each row execute function public.check_folder_parent();

-- ---------------------------------------------------------------------------
-- Components: only the owner, the editors they grant and the admin can edit
-- ---------------------------------------------------------------------------
create table public.components (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  folder_id       uuid references public.folders (id) on delete set null,
  name            text not null check (length(trim(name)) between 1 and 120),
  description     text not null default '' check (length(description) <= 4000),
  owner_id        uuid not null default auth.uid() references public.people (id),
  status          text not null default 'planned'
                    check (status in ('planned', 'in_design', 'in_review', 'released', 'built', 'on_hold')),
  onshape_url     text check (onshape_url is null or onshape_url ~* '^https://([a-z0-9-]+\.)*onshape\.com/'),
  revision        text not null default 'A' check (length(revision) between 1 and 12),
  last_update_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index components_project on public.components (project_id);
create index components_owner on public.components (owner_id);
create index components_name_trgm on public.components using gin (name extensions.gin_trgm_ops);

create table public.component_editors (
  component_id  uuid not null references public.components (id) on delete cascade,
  person_id     uuid not null references public.people (id) on delete cascade,
  granted_by    uuid not null default auth.uid() references public.people (id),
  granted_at    timestamptz not null default now(),
  primary key (component_id, person_id)
);

create or replace function public.is_component_owner(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.components where id = cid and owner_id = auth.uid());
$$;

create or replace function public.can_edit_component(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or exists (select 1 from public.components where id = cid and owner_id = auth.uid())
      or exists (select 1 from public.component_editors where component_id = cid and person_id = auth.uid());
$$;

-- Editors can change a component but cannot hand off ownership; only the owner or the admin can.
-- The folder must belong to the component's project.
create or replace function public.guard_component_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id
     and not (old.owner_id = auth.uid() or public.is_admin()) then
    raise exception 'Only the owner can hand off a component';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger components_guard before update on public.components
  for each row execute function public.guard_component_update();

create or replace function public.check_component_folder()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.folder_id is not null
     and (select project_id from public.folders where id = new.folder_id) is distinct from new.project_id then
    raise exception 'A component''s folder must be in the same project';
  end if;
  return new;
end;
$$;
create trigger components_check_folder before insert or update of folder_id, project_id on public.components
  for each row execute function public.check_component_folder();

-- ---------------------------------------------------------------------------
-- Comments, weekly updates, files and weeks
-- ---------------------------------------------------------------------------
create table public.comments (
  id            uuid primary key default gen_random_uuid(),
  component_id  uuid not null references public.components (id) on delete cascade,
  author_id     uuid not null default auth.uid() references public.people (id),
  body          text not null check (length(trim(body)) between 1 and 4000),
  created_at    timestamptz not null default now(),
  edited_at     timestamptz
);
create index comments_component on public.comments (component_id, created_at);

create table public.updates (
  id            uuid primary key default gen_random_uuid(),
  component_id  uuid not null references public.components (id) on delete cascade,
  author_id     uuid not null default auth.uid() references public.people (id),
  week_start    date not null check (extract(isodow from week_start) = 1),
  done          text not null default '' check (length(done) <= 1000),
  next          text not null default '' check (length(next) <= 1000),
  blocked       text not null default '' check (length(blocked) <= 1000),
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  check (length(trim(done)) > 0 or length(trim(next)) > 0 or length(trim(blocked)) > 0),
  unique (component_id, week_start)
);
create index updates_author on public.updates (author_id, created_at desc);
create index updates_week on public.updates (week_start);

-- Posting an update marks the component as fresh again.
create or replace function public.touch_component_on_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.components set last_update_at = now() where id = new.component_id;
  return new;
end;
$$;
create trigger updates_touch_component after insert or update on public.updates
  for each row execute function public.touch_component_on_update();

create table public.files (
  id            uuid primary key default gen_random_uuid(),
  component_id  uuid not null references public.components (id) on delete cascade,
  revision      text not null check (length(revision) between 1 and 12),
  storage_path  text not null unique,
  filename      text not null check (length(filename) between 1 and 200),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 20 * 1024 * 1024),
  content_type  text not null,
  uploaded_by   uuid not null default auth.uid() references public.people (id),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index files_component on public.files (component_id, created_at desc);

create table public.weeks (
  week_start  date primary key check (extract(isodow from week_start) = 1),
  slides_url  text check (slides_url is null or slides_url ~* '^https://docs\.google\.com/presentation/'),
  notes       text not null default '' check (length(notes) <= 2000),
  updated_by  uuid default auth.uid() references public.people (id),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Activity log: every create, edit, move and delete
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.people (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_entity on public.activity_log (entity, entity_id, created_at desc);

create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb;
  old_rec jsonb;
  act text;
  label text;
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old); act := 'deleted';
  else
    rec := to_jsonb(new);
    if tg_op = 'INSERT' then
      act := 'created';
    else
      old_rec := to_jsonb(old);
      if (old_rec ->> 'deleted_at') is null and (rec ->> 'deleted_at') is not null then act := 'trashed';
      elsif (old_rec ->> 'deleted_at') is not null and (rec ->> 'deleted_at') is null then act := 'restored';
      elsif old_rec ? 'folder_id' and (old_rec -> 'folder_id') is distinct from (rec -> 'folder_id') then act := 'moved';
      elsif old_rec ? 'parent_id' and (old_rec -> 'parent_id') is distinct from (rec -> 'parent_id') then act := 'moved';
      else act := 'edited';
      end if;
    end if;
  end if;
  label := coalesce(rec ->> 'name', rec ->> 'filename', left(rec ->> 'body', 80), rec ->> 'week_start');
  insert into public.activity_log (actor_id, action, entity, entity_id, detail)
  values (
    auth.uid(), act, tg_table_name,
    coalesce((rec ->> 'id')::uuid, (rec ->> 'component_id')::uuid),
    jsonb_strip_nulls(jsonb_build_object(
      'label', label,
      'component_id', rec ->> 'component_id',
      'project_id', rec ->> 'project_id',
      'person_id', rec ->> 'person_id',
      'changed', case when tg_op = 'UPDATE' then (
        select jsonb_agg(key) from jsonb_each(rec) e
        where e.key not in ('updated_at', 'last_update_at', 'edited_at') and (old_rec -> e.key) is distinct from e.value
      ) end
    ))
  );
  return null;
end;
$$;

create trigger log_projects after insert or update or delete on public.projects for each row execute function public.log_activity();
create trigger log_folders after insert or update or delete on public.folders for each row execute function public.log_activity();
create trigger log_components after insert or update or delete on public.components for each row execute function public.log_activity();
create trigger log_editors after insert or delete on public.component_editors for each row execute function public.log_activity();
create trigger log_updates after insert or update or delete on public.updates for each row execute function public.log_activity();
create trigger log_files after insert or update or delete on public.files for each row execute function public.log_activity();
create trigger log_comments after insert or update or delete on public.comments for each row execute function public.log_activity();
create trigger log_weeks after insert or update on public.weeks for each row execute function public.log_activity();
create trigger log_memberships after insert or delete on public.memberships for each row execute function public.log_activity();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.people            enable row level security;
alter table public.projects          enable row level security;
alter table public.memberships       enable row level security;
alter table public.folders           enable row level security;
alter table public.components        enable row level security;
alter table public.component_editors enable row level security;
alter table public.comments          enable row level security;
alter table public.updates           enable row level security;
alter table public.files             enable row level security;
alter table public.weeks             enable row level security;
alter table public.activity_log      enable row level security;

-- People: everyone signed in can see the team; you edit your own name and theme.
create policy people_read on public.people for select to authenticated using (public.is_member());
create policy people_update_self on public.people for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create or replace function public.guard_people_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.email is distinct from old.email) and not public.is_admin() then
    raise exception 'Only the admin can change roles';
  end if;
  if new.role <> 'admin' and old.role = 'admin'
     and not exists (select 1 from public.people where role = 'admin' and id <> old.id) then
    raise exception 'The library needs at least one admin';
  end if;
  return new;
end;
$$;
create trigger people_guard before update on public.people for each row execute function public.guard_people_update();

-- Projects and folders: anyone signed in. Trash is soft; only the admin sees trashed items.
-- Trashed rows stay readable (the app hides them) because Postgres requires an updated row to stay
-- visible, and anyone can trash a project. Only the admin can edit or restore a trashed one.
create policy projects_read on public.projects for select to authenticated using (public.is_member());
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_member() and created_by = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (public.is_member() and (deleted_at is null or public.is_admin()))
  with check (public.is_member());

create policy memberships_read on public.memberships for select to authenticated using (public.is_member());
create policy memberships_join on public.memberships for insert to authenticated
  with check (person_id = auth.uid() or public.is_admin());
create policy memberships_leave on public.memberships for delete to authenticated
  using (person_id = auth.uid() or public.is_admin());

create policy folders_read on public.folders for select to authenticated using (public.is_member());
create policy folders_insert on public.folders for insert to authenticated
  with check (public.is_member() and created_by = auth.uid());
create policy folders_update on public.folders for update to authenticated
  using (public.is_member() and (deleted_at is null or public.is_admin()))
  with check (public.is_member());

-- Components: everyone reads; you create your own; owner, editors and admin edit.
create policy components_read on public.components for select to authenticated using (public.is_member());
create policy components_insert on public.components for insert to authenticated
  with check (public.is_member() and owner_id = auth.uid());
create policy components_update on public.components for update to authenticated
  using (public.can_edit_component(id) and (deleted_at is null or public.is_admin())) with check (public.is_member());

create policy editors_read on public.component_editors for select to authenticated using (public.is_member());
create policy editors_grant on public.component_editors for insert to authenticated
  with check ((public.is_component_owner(component_id) or public.is_admin()) and granted_by = auth.uid());
create policy editors_revoke on public.component_editors for delete to authenticated
  using (public.is_component_owner(component_id) or public.is_admin());

-- Comments: anyone signed in comments; authors edit or delete their own; the admin can remove any.
create policy comments_read on public.comments for select to authenticated using (public.is_member());
create policy comments_insert on public.comments for insert to authenticated
  with check (public.is_member() and author_id = auth.uid());
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Updates: posted by the owner or an editor of the component.
create policy updates_read on public.updates for select to authenticated using (public.is_member());
create policy updates_insert on public.updates for insert to authenticated
  with check (author_id = auth.uid() and public.can_edit_component(component_id));
create policy updates_update on public.updates for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and public.can_edit_component(component_id));
create policy updates_delete on public.updates for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Files: uploaded by the owner or an editor.
create policy files_read on public.files for select to authenticated using (public.is_member());
create policy files_insert on public.files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_edit_component(component_id));
create policy files_update on public.files for update to authenticated
  using (public.can_edit_component(component_id)) with check (public.can_edit_component(component_id));

-- Weeks: anyone signed in can set the week's Slides link.
create policy weeks_read on public.weeks for select to authenticated using (public.is_member());
create policy weeks_insert on public.weeks for insert to authenticated with check (public.is_member());
create policy weeks_update on public.weeks for update to authenticated using (public.is_member()) with check (public.is_member());

-- Activity log: readable by everyone signed in, written only by the triggers above.
create policy activity_read on public.activity_log for select to authenticated using (public.is_member());

-- Nothing is visible to signed-out visitors.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Search across projects, folders, components, people, updates and comments.
-- security invoker, so the row-level rules above still apply.
-- ---------------------------------------------------------------------------
create or replace function public.search_library(q text)
returns table (kind text, id uuid, title text, subtitle text, component_id uuid, rank real)
language sql stable security invoker set search_path = '' as $$
  with term as (select '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as t, trim(q) as raw)
  select * from (
    select 'project', p.id, p.name, p.description, null::uuid,
           extensions.similarity(p.name, term.raw) + 1
      from public.projects p, term where p.deleted_at is null and (p.name ilike term.t or p.description ilike term.t)
    union all
    select 'folder', f.id, f.name, pr.name, null::uuid, extensions.similarity(f.name, term.raw) + 0.8
      from public.folders f join public.projects pr on pr.id = f.project_id, term
     where f.deleted_at is null and f.name ilike term.t
    union all
    select 'component', c.id, c.name, pr.name, c.id, extensions.similarity(c.name, term.raw) + 1.2
      from public.components c join public.projects pr on pr.id = c.project_id, term
     where c.deleted_at is null and (c.name ilike term.t or c.description ilike term.t)
    union all
    select 'person', pe.id, pe.name, pe.email, null::uuid, extensions.similarity(pe.name, term.raw) + 1
      from public.people pe, term where pe.name ilike term.t
    union all
    select 'update', u.id, c.name, concat_ws(' / ', nullif(u.done, ''), nullif(u.next, ''), nullif(u.blocked, '')), c.id, 0.5
      from public.updates u join public.components c on c.id = u.component_id, term
     where c.deleted_at is null and (u.done ilike term.t or u.next ilike term.t or u.blocked ilike term.t)
    union all
    select 'comment', cm.id, c.name, cm.body, c.id, 0.4
      from public.comments cm join public.components c on c.id = cm.component_id, term
     where c.deleted_at is null and cm.body ilike term.t
  ) r(kind, id, title, subtitle, component_id, rank)
  where length((select raw from term)) >= 2
  order by rank desc, title
  limit 50;
$$;

-- Similar names, so the create form can warn about duplicates.
create or replace function public.similar_components(q text)
returns table (id uuid, name text, project_name text)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.name, p.name
    from public.components c join public.projects p on p.id = c.project_id
   where c.deleted_at is null and length(trim(q)) >= 3
     and (extensions.similarity(c.name, q) > 0.35 or c.name ilike '%' || trim(q) || '%')
   order by extensions.similarity(c.name, q) desc
   limit 5;
$$;

grant execute on function public.search_library(text) to authenticated;
grant execute on function public.similar_components(text) to authenticated;
