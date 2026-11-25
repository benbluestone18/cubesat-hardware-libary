-- The activity log missed two kinds of change: a person's name or role, and the whole satellite's
-- mass and power limits. Theme switches are left out on purpose, so the log stays readable.

-- A rename also records the old name, so @mentions written with it still point at the person.
create or replace function public.log_person()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_log (actor_id, action, entity, entity_id, detail)
  values (
    auth.uid(), 'edited', 'people', new.id,
    jsonb_strip_nulls(jsonb_build_object(
      'label', new.name,
      'old_name', case when old.name is distinct from new.name then old.name end,
      'changed', (
        select jsonb_agg(k) from unnest(array['name', 'role']) k
        where (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k)
      )
    ))
  );
  return null;
end;
$$;
revoke execute on function public.log_person() from public, anon, authenticated;

create trigger log_people after update of name, role on public.people
  for each row when (old.name is distinct from new.name or old.role is distinct from new.role)
  execute function public.log_person();

-- The mission table has a true/false id, not a uuid, so it gets its own small logger.
create or replace function public.log_mission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_log (actor_id, action, entity, entity_id, detail)
  values (
    auth.uid(), 'edited', 'mission', null,
    jsonb_strip_nulls(jsonb_build_object(
      'changed', (
        select jsonb_agg(key) from jsonb_each(to_jsonb(new)) e
        where e.key <> 'updated_at' and (to_jsonb(old) -> e.key) is distinct from e.value
      ),
      'mass_limit_g', new.mass_limit_g,
      'power_limit_w', new.power_limit_w
    ))
  );
  return null;
end;
$$;
revoke execute on function public.log_mission() from public, anon, authenticated;

create trigger log_mission after update on public.mission
  for each row when (old.mass_limit_g is distinct from new.mass_limit_g or old.power_limit_w is distinct from new.power_limit_w)
  execute function public.log_mission();
