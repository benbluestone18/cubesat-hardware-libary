-- Permission rules, checked against the real database. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- Start from an empty library, even when local test data is loaded. All of this rolls back.
truncate public.activity_log, public.comments, public.updates, public.files, public.component_editors, public.components,
  public.folders, public.memberships, public.projects, public.weeks, public.people cascade;
delete from auth.users;

-- Act as a signed-in person.
create or replace function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Sign-ups
select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000ff', 'someone@gmail.com', '{}') $$,
  'P0001', 'Only @lgsstudent.org accounts can use the hardware library', 'A personal Gmail is refused');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'Ben.B@lgsstudent.org', '{"full_name":"Ben"}'),
  ('00000000-0000-0000-0000-00000000000b', 'alex@lgsstudent.org', '{"full_name":"Alex"}'),
  ('00000000-0000-0000-0000-00000000000c', 'skyler@lgsstudent.org', '{"name":"Skyler"}');

select is((select role from people where name = 'Ben'), 'admin', 'The first person to sign in is the admin');
select is((select role from people where name = 'Alex'), 'member', 'Everyone after is a member');
select is((select email from people where name = 'Ben'), 'ben.b@lgsstudent.org', 'Emails are stored lowercase');

-- Alex: projects, folders, components
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into projects (id, name) values ('10000000-0000-0000-0000-000000000001', 'ADCS');
insert into folders (id, project_id, name) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Reaction wheels');
insert into folders (id, project_id, parent_id, name) values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Mounts');
select throws_ok(
  $$ update folders set parent_id = '20000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001' $$,
  'P0001', 'A folder cannot be moved inside itself', 'A folder cannot go inside its own child');
insert into components (id, project_id, folder_id, name, status) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Reaction wheel mount', 'in_design');
select is((select owner_id from components where id = '30000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-00000000000b'::uuid, 'The creator owns the component');
select throws_ok(
  $$ update people set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'P0001', 'Only the admin can change roles', 'A member cannot make themselves admin');
select throws_ok(
  $$ insert into components (project_id, name, owner_id) values ('10000000-0000-0000-0000-000000000001', 'Sneaky', '00000000-0000-0000-0000-00000000000c') $$,
  '42501', null, 'You cannot create a component owned by someone else');

-- Skyler: can read and comment, cannot edit
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from components), 1, 'Everyone can see every component');
update components set name = 'Hijacked' where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.reset_role();
select is((select name from components where id = '30000000-0000-0000-0000-000000000001'), 'Reaction wheel mount', 'A non-editor''s edit changes nothing');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ insert into comments (component_id, body) values ('30000000-0000-0000-0000-000000000001', 'Is the 2 mm wall enough?') $$, 'Anyone can comment');
select throws_ok(
  $$ insert into updates (component_id, week_start, done) values ('30000000-0000-0000-0000-000000000001', '2026-11-16', 'x') $$,
  '42501', null, 'A non-editor cannot post an update');
select throws_ok(
  $$ insert into component_editors (component_id, person_id) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c') $$,
  '42501', null, 'You cannot grant yourself edit rights');
select lives_ok($$ update projects set description = 'Attitude determination and control' where id = '10000000-0000-0000-0000-000000000001' $$, 'Anyone can edit a project');

-- Alex grants Skyler edit rights
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ insert into component_editors (component_id, person_id) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c') $$, 'The owner can grant an editor');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ update components set revision = 'B' where id = '30000000-0000-0000-0000-000000000001' $$, 'An editor can edit');
select lives_ok($$ insert into updates (component_id, week_start, done, blocked) values ('30000000-0000-0000-0000-000000000001', '2026-11-16', 'Reprinted the mount', 'Waiting on wheel dimensions') $$, 'An editor can post an update');
select throws_ok(
  $$ update components set owner_id = '00000000-0000-0000-0000-00000000000c' where id = '30000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Only the owner can hand off a component', 'An editor cannot take ownership');
select throws_ok(
  $$ insert into updates (component_id, week_start, done) values ('30000000-0000-0000-0000-000000000001', '2026-11-18', 'x') $$,
  '23514', null, 'Updates must be filed under a Monday');

-- Trash
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update folders set deleted_at = now() where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
update folders set deleted_at = null where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.reset_role();
select ok((select deleted_at is not null from folders where id = '20000000-0000-0000-0000-000000000002'), 'Only the admin can restore from trash');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update folders set deleted_at = null where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.reset_role();
select ok((select deleted_at is null from folders where id = '20000000-0000-0000-0000-000000000002'), 'The admin can restore it');

-- Teams: leads and admins manage members; anyone can join or leave
select pg_temp.reset_role();
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000d', 'jordan@lgsstudent.org', '{"full_name":"Jordan"}');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into projects (id, name) values ('10000000-0000-0000-0000-000000000002', 'Power');
select lives_ok($$ insert into memberships (person_id, project_id, lead) values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000002', true) $$, 'Whoever makes a project can lead it');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ insert into memberships (person_id, project_id, lead) values ('00000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000002', true) $$, '42501', null, 'You cannot join as a lead');
select lives_ok($$ insert into memberships (person_id, project_id) values ('00000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000002') $$, 'Anyone can join a team');
select throws_ok($$ insert into memberships (person_id, project_id) values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002') $$, '42501', null, 'A member who is not a lead cannot add others');
update memberships set lead = true where person_id = '00000000-0000-0000-0000-00000000000d';
select is((select lead from memberships where person_id = '00000000-0000-0000-0000-00000000000d'), false, 'A member cannot make themselves lead');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ insert into memberships (person_id, project_id) values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002') $$, 'A lead can add people');
select lives_ok($$ update memberships set lead = true where person_id = '00000000-0000-0000-0000-00000000000d' and project_id = '10000000-0000-0000-0000-000000000002' $$, 'A lead can make someone else a lead');
select throws_ok($$ update memberships set person_id = '00000000-0000-0000-0000-00000000000a' where person_id = '00000000-0000-0000-0000-00000000000d' $$, '42501', null, 'Only the lead flag can change');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
delete from memberships where person_id = '00000000-0000-0000-0000-00000000000b' and project_id = '10000000-0000-0000-0000-000000000002';
select is((select count(*)::int from memberships where person_id = '00000000-0000-0000-0000-00000000000b' and project_id = '10000000-0000-0000-0000-000000000002'), 0, 'A new lead can remove people');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ insert into memberships (person_id, project_id, lead) values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002', true) $$, 'The admin can add anyone as a lead');

-- Links (Google Drive and the like): editors add them, everyone sees them
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ insert into component_links (component_id, url, label) values ('30000000-0000-0000-0000-000000000001', 'https://drive.google.com/file/d/x', 'Drawing') $$, '42501', null, 'Someone who cannot edit the part cannot add links');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ insert into component_links (component_id, url, label) values ('30000000-0000-0000-0000-000000000001', 'https://drive.google.com/file/d/x', 'Drawing') $$, 'The owner can add a link');
select throws_ok($$ insert into component_links (component_id, url, label) values ('30000000-0000-0000-0000-000000000001', 'javascript:alert(1)', 'Bad') $$, '23514', null, 'Only https links are allowed');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from component_links), 1, 'Everyone can see links');

-- Search, activity, signed-out
select ok((select count(*) from search_library('wheel')) >= 2, 'Search finds the component and its folder');
select ok((select count(*) from activity_log where action in ('trashed','restored') and entity = 'folders') = 2, 'Trashing and restoring are logged');
select pg_temp.reset_role();
select ok((select last_update_at is not null from components where id = '30000000-0000-0000-0000-000000000001'), 'Posting an update refreshes the component');
insert into updates (component_id, author_id, week_start, done) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', date_trunc('week', now())::date - 7, 'older');
select is((select done from latest_updates where component_id = '30000000-0000-0000-0000-000000000001'), (select done from updates where component_id = '30000000-0000-0000-0000-000000000001' order by week_start desc limit 1), 'latest_updates picks the newest week');
select is((select count(*)::int from latest_updates where component_id = '30000000-0000-0000-0000-000000000001'), 1, 'latest_updates has one row per component');
set local role anon;
select throws_ok($$ select count(*) from components $$, '42501', null, 'Signed-out visitors see nothing');

select * from finish();
rollback;
