-- File storage for KiCad zips, PDFs and images. Private: only signed-in members can download.
-- Objects live at <component_id>/<revision>/<random>-<filename>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'component-files', 'component-files', false, 20 * 1024 * 1024,
  array['application/zip', 'application/x-zip-compressed', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

create or replace function public.storage_component_id(object_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create policy component_files_read on storage.objects for select to authenticated
  using (bucket_id = 'component-files' and public.is_member());

create policy component_files_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'component-files'
    and public.can_edit_component(public.storage_component_id(name))
  );
