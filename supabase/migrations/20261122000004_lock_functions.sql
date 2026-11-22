-- Postgres lets everyone call new functions by default. Lock them down:
-- trigger functions are never called directly, and the permission helpers
-- are only needed by signed-in users (row rules call them).
revoke execute on function public.handle_new_user(), public.log_activity(), public.touch_component_on_update()
  from public, anon, authenticated;
revoke execute on function public.is_member(), public.is_admin(), public.is_component_owner(uuid), public.can_edit_component(uuid)
  from public, anon;
grant execute on function public.is_member(), public.is_admin(), public.is_component_owner(uuid), public.can_edit_component(uuid)
  to authenticated;
