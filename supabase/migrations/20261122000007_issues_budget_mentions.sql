-- Issues, mass and power budget, and @mentions.

-- Issues are comments marked as an issue when they are posted. They stay open until the
-- comment's author, the part's owner or editors, or an admin resolves them.
alter table public.comments
  add column is_issue boolean not null default false,
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.people (id);
create index comments_open_issues on public.comments (component_id) where is_issue and resolved_at is null;

create or replace function public.guard_comment_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.component_id is distinct from old.component_id or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    raise exception 'A comment cannot be moved';
  end if;
  -- People other than the author may only resolve or reopen an issue.
  if auth.uid() is distinct from old.author_id
     and (new.body is distinct from old.body or new.is_issue is distinct from old.is_issue) then
    raise exception 'Only the author can change a comment';
  end if;
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  -- The database, not the browser, records when and by whom an issue was resolved.
  if not new.is_issue then
    new.resolved_at := null; new.resolved_by := null;
  elsif new.resolved_at is not null and old.resolved_at is null then
    new.resolved_at := now(); new.resolved_by := auth.uid();
  elsif new.resolved_at is null then
    new.resolved_by := null;
  else
    new.resolved_at := old.resolved_at; new.resolved_by := old.resolved_by;
  end if;
  return new;
end;
$$;
create trigger comments_guard before update on public.comments
  for each row execute function public.guard_comment_update();

-- New comments can't arrive already resolved.
create or replace function public.fresh_comment()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.resolved_at := null; new.resolved_by := null; new.edited_at := null;
  return new;
end;
$$;
create trigger comments_fresh before insert on public.comments
  for each row execute function public.fresh_comment();

drop policy comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid() or public.can_edit_component(component_id))
  with check (author_id = auth.uid() or public.can_edit_component(component_id));

-- Mass and power, all optional. Mass in grams, power as average draw in watts.
alter table public.components
  add column mass_g numeric(10, 2) check (mass_g is null or (mass_g >= 0 and mass_g <= 100000)),
  add column power_w numeric(10, 3) check (power_w is null or (power_w >= 0 and power_w <= 1000));

-- What each team is allowed to use, also optional.
alter table public.projects
  add column mass_budget_g numeric(10, 2) check (mass_budget_g is null or (mass_budget_g > 0 and mass_budget_g <= 100000)),
  add column power_budget_w numeric(10, 3) check (power_budget_w is null or (power_budget_w > 0 and power_budget_w <= 1000));

-- Limits for the whole satellite: one row, which only admins change.
create table public.mission (
  id             boolean primary key default true check (id),
  mass_limit_g   numeric(10, 2) check (mass_limit_g is null or (mass_limit_g > 0 and mass_limit_g <= 100000)),
  power_limit_w  numeric(10, 3) check (power_limit_w is null or (power_limit_w > 0 and power_limit_w <= 1000)),
  updated_at     timestamptz not null default now()
);
insert into public.mission (id) values (true);
alter table public.mission enable row level security;
create policy mission_read on public.mission for select to authenticated using (public.is_member());
create policy mission_admin on public.mission for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.mission to authenticated;
grant update (mass_limit_g, power_limit_w, updated_at) on public.mission to authenticated;

-- Who each comment mentions. Written by the comment's author when they post it.
create table public.comment_mentions (
  comment_id  uuid not null references public.comments (id) on delete cascade,
  person_id   uuid not null references public.people (id) on delete cascade,
  primary key (comment_id, person_id)
);
create index comment_mentions_person on public.comment_mentions (person_id);
alter table public.comment_mentions enable row level security;
create policy comment_mentions_read on public.comment_mentions for select to authenticated using (public.is_member());
create policy comment_mentions_add on public.comment_mentions for insert to authenticated
  with check (exists (select 1 from public.comments c where c.id = comment_id and c.author_id = auth.uid()));
grant select, insert on public.comment_mentions to authenticated;
