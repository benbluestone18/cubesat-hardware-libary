-- Local test data only. `npx supabase db reset` loads it; production never does.
-- Fictional people, all on the school domain. The first one becomes admin.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, '', now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', name), now() - (days || ' days')::interval, now(), '', '', '', ''
from (values
  ('11111111-0000-0000-0000-000000000001', 'alex.rivera@lgsstudent.org', 'Alex Rivera', 80),
  ('11111111-0000-0000-0000-000000000002', 'priya.shah@lgsstudent.org', 'Priya Shah', 75),
  ('11111111-0000-0000-0000-000000000003', 'owen.park@lgsstudent.org', 'Owen Park', 70),
  ('11111111-0000-0000-0000-000000000004', 'maya.chen@lgsstudent.org', 'Maya Chen', 66),
  ('11111111-0000-0000-0000-000000000005', 'leo.martins@lgsstudent.org', 'Leo Martins', 60),
  ('11111111-0000-0000-0000-000000000006', 'sam.okafor@lgsstudent.org', 'Sam Okafor', 20)
) as t(id, email, name, days)
order by days desc;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now() from auth.users;

update public.people p set created_at = u.created_at from auth.users u where u.id = p.id;

insert into public.projects (id, name, description, created_by) values
  ('22222222-0000-0000-0000-000000000001', 'ADCS', 'Attitude determination and control: magnetorquers, sun sensors, IMU.', '11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000002', 'Biomission', 'The payload: growth chamber, optics and life support for the experiment.', '11111111-0000-0000-0000-000000000002'),
  ('22222222-0000-0000-0000-000000000003', 'EPS', 'Power: solar panels, battery pack and the power board.', '11111111-0000-0000-0000-000000000004'),
  ('22222222-0000-0000-0000-000000000004', 'Structures', '1U frame, rails, standoffs and the deployment switch.', '11111111-0000-0000-0000-000000000003');

insert into public.memberships (person_id, project_id) values
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004'),
  ('11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002'),
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004'),
  ('11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000003'),
  ('11111111-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000002'),
  ('11111111-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000003')
-- Each project's creator is already on it as lead and owner.
on conflict (person_id, project_id) do nothing;

insert into public.folders (id, project_id, parent_id, name, created_by) values
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', null, 'Magnetorquers', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', null, 'Sensors', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Sun sensors', '11111111-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002', null, 'Growth chamber', '11111111-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000003', null, 'Boards', '11111111-0000-0000-0000-000000000004'),
  ('33333333-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000004', null, 'Frame', '11111111-0000-0000-0000-000000000003');

insert into public.components (id, project_id, folder_id, name, description, owner_id, status, revision, onshape_url, created_at) values
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Magnetorquer coil, X axis', 'Air-core coil, 200 turns of 32 AWG. Drives 0.2 A·m² at 5 V.', '11111111-0000-0000-0000-000000000001', 'in_review', 'B', 'https://cad.onshape.com/documents/example1', now() - interval '50 days'),
  ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Magnetorquer driver board', 'H-bridge board for all three coils.', '11111111-0000-0000-0000-000000000001', 'in_design', 'A', null, now() - interval '40 days'),
  ('44444444-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003', 'Coarse sun sensor', 'Six photodiodes, one per face.', '11111111-0000-0000-0000-000000000003', 'in_design', 'A', null, now() - interval '45 days'),
  ('44444444-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'IMU breakout', 'BMI270 on a small carrier.', '11111111-0000-0000-0000-000000000003', 'released', 'C', null, now() - interval '60 days'),
  ('44444444-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004', 'Growth chamber enclosure', 'Sealed chamber with a viewing window.', '11111111-0000-0000-0000-000000000002', 'in_design', 'A', 'https://cad.onshape.com/documents/example2', now() - interval '30 days'),
  ('44444444-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004', 'LED grow light board', 'Red and blue LEDs with a constant-current driver.', '11111111-0000-0000-0000-000000000005', 'in_design', 'A', null, now() - interval '35 days'),
  ('44444444-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000002', null, 'Camera module mount', 'Holds the camera over the chamber window.', '11111111-0000-0000-0000-000000000005', 'planned', 'A', null, now() - interval '5 days'),
  ('44444444-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000005', 'Power distribution board', '3.3 V and 5 V rails with load switches.', '11111111-0000-0000-0000-000000000004', 'in_review', 'B', null, now() - interval '55 days'),
  ('44444444-0000-0000-0000-000000000009', '22222222-0000-0000-0000-000000000003', null, 'Battery pack', '2S Li-ion with protection board.', '11111111-0000-0000-0000-000000000006', 'on_hold', 'A', null, now() - interval '18 days'),
  ('44444444-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000006', '1U frame', 'Aluminium 6061 frame to the CubeSat spec.', '11111111-0000-0000-0000-000000000003', 'built', 'D', 'https://cad.onshape.com/documents/example3', now() - interval '70 days'),
  ('44444444-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-000000000004', null, 'Deployment switch bracket', 'Holds the kill switch at the rail foot.', '11111111-0000-0000-0000-000000000001', 'in_design', 'A', null, now() - interval '25 days');

insert into public.component_editors (component_id, person_id, granted_by) values
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001'),
  ('44444444-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000004');

insert into public.comments (component_id, author_id, body, created_at) values
  ('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'Board outline is 90 × 90 mm with 3.2 mm corner holes. I''ll upload the DXF this week.', now() - interval '1 day'),
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004', 'What current does it pull at full duty? I need it for the power budget.', now() - interval '2 days');
