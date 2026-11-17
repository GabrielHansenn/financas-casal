-- Dreams board: status lifecycle, dream -> goal conversion, reactions and RLS for tables and
-- Storage (an outsider can't see or touch dreams or their images).
-- Run with: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-- =====================================================================
-- Test helpers (rolled back with the transaction)
-- =====================================================================
create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.create_user(p_name text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (v_id, p_name || '@test.local', 'authenticated', 'authenticated',
          jsonb_build_object('display_name', p_name), now());
  perform set_config('test.user_' || p_name, v_id::text, true);
  return v_id;
end $$;

create function tests.uid(p_name text) returns uuid language sql stable as $$
  select current_setting('test.user_' || p_name)::uuid
$$;
create function tests.put(p_key text, p_value uuid) returns void language plpgsql as $$
begin perform set_config('test.' || p_key, p_value::text, true); end $$;
create function tests.get(p_key text) returns uuid language sql stable as $$
  select current_setting('test.' || p_key)::uuid
$$;
create function tests.login_as(p_name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', tests.uid(p_name), 'email', p_name || '@test.local', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- Path of an image inside a dream's folder
create function tests.img(p_ws text, p_dream text, p_file text default 'cover.webp') returns text
language sql stable as $$ select tests.get(p_ws) || '/' || tests.get(p_dream) || '/' || p_file $$;

grant execute on all functions in schema tests to authenticated, anon;

-- =====================================================================
-- Setup: alice + bob share "Casa"; carol is an outsider
-- =====================================================================
select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('carol');
select tests.put('alice_personal',
  (select id from public.workspaces where created_by = tests.uid('alice') and type = 'personal'));

select tests.login_as('alice');
select tests.put('casa', public.create_shared_workspace('Casa'));
do $$ begin
  perform set_config('test.token', public.create_workspace_invite(tests.get('casa'), 'bob@test.local'), true);
end $$;
select tests.login_as('bob');
select public.accept_workspace_invite(current_setting('test.token'));

select tests.login_as('alice');
do $$
declare v_id uuid;
begin
  insert into public.dreams (workspace_id, title, category, horizon, estimated_cost_cents)
  values (tests.get('casa'), 'Viagem ao Japão', 'travel', 'medium', 1500050) returning id into v_id;
  perform tests.put('trip', v_id);
  insert into public.dreams (workspace_id, title, owner_user_id) values (tests.get('casa'), 'Violão', tests.uid('bob'))
  returning id into v_id;
  perform tests.put('guitar', v_id);
  insert into public.dreams (workspace_id, title) values (tests.get('alice_personal'), 'Mestrado')
  returning id into v_id;
  perform tests.put('personal_dream', v_id);
  insert into public.goals (workspace_id, name, target_cents) values (tests.get('alice_personal'), 'Reserva', 1000)
  returning id into v_id;
  perform tests.put('personal_goal', v_id);
end $$;

-- =====================================================================
-- Integrity
-- =====================================================================
select is((select status::text from public.dreams where id = tests.get('trip')), 'dreaming', 'new dream starts as dreaming');
select is((select created_by from public.dreams where id = tests.get('trip')), tests.uid('alice'), 'created_by is the current user');
select throws_ok(
  $$ insert into public.dreams (workspace_id, title, owner_user_id) values (tests.get('casa'), 'x', tests.uid('carol')) $$,
  '23514', null, 'owner must be a member of the workspace');
select throws_ok(
  $$ insert into public.dreams (workspace_id, title, created_by) values (tests.get('casa'), 'x', tests.uid('bob')) $$,
  '42501', null, 'cannot create a dream on behalf of someone else');
select throws_ok(
  $$ insert into public.dreams (workspace_id, title, estimated_cost_cents) values (tests.get('casa'), 'x', 0) $$,
  '23514', null, 'estimated cost must be positive');
select throws_ok(
  $$ update public.dreams set status = 'planning' where id = tests.get('guitar') $$,
  '23514', null, 'planning requires a linked goal');
select throws_ok(
  $$ update public.dreams set status = 'achieved' where id = tests.get('guitar') $$,
  '23514', null, 'achieved requires a date');
select throws_ok(
  $$ update public.dreams set cover_image_path = tests.get('casa') || '/' || tests.get('trip') || '/x.webp'
     where id = tests.get('guitar') $$,
  '23514', null, 'cover image must be inside the dream''s own folder');
select lives_ok(
  $$ update public.dreams set cover_image_path = tests.img('casa', 'guitar') where id = tests.get('guitar') $$,
  'cover image in the dream folder is accepted');

-- =====================================================================
-- Dream -> goal conversion
-- =====================================================================
select lives_ok(
  $$ select tests.put('trip_goal', public.convert_dream_to_goal(tests.get('trip'), '  Viagem ao Japão ', 1500050, '2028-06-30')) $$,
  'convert a dreaming dream into a goal');
select results_eq(
  $$ select status::text, goal_id from public.dreams where id = tests.get('trip') $$,
  $$ values ('planning', tests.get('trip_goal')) $$,
  'dream becomes planning and is linked to the new goal');
select results_eq(
  $$ select workspace_id, name, target_cents, deadline from public.goals where id = tests.get('trip_goal') $$,
  $$ values (tests.get('casa'), 'Viagem ao Japão', 1500050::bigint, '2028-06-30'::date) $$,
  'goal created in the dream''s workspace with exact cents, trimmed name and chosen deadline');
select throws_ok(
  $$ select public.convert_dream_to_goal(tests.get('trip'), 'Outra', 100) $$,
  '23514', null, 'a dream that is already planning cannot be converted again');
select throws_ok(
  $$ select public.convert_dream_to_goal(tests.get('guitar'), 'Violão', 0) $$,
  '23514', null, 'goal target must be positive (conversion is atomic: nothing changes)');
select is((select status::text from public.dreams where id = tests.get('guitar')), 'dreaming',
  'failed conversion leaves the dream untouched');
select throws_ok(
  $$ update public.dreams set status = 'planning', goal_id = tests.get('personal_goal') where id = tests.get('guitar') $$,
  '23503', null, 'cannot link a goal from another workspace');
select throws_ok(
  $$ update public.dreams set status = 'planning', goal_id = tests.get('trip_goal') where id = tests.get('guitar') $$,
  '23505', null, 'a goal can back only one dream');

-- Deleting the linked goal sends the dream back to dreaming
delete from public.goals where id = tests.get('trip_goal');
select results_eq(
  $$ select status::text, goal_id from public.dreams where id = tests.get('trip') $$,
  $$ values ('dreaming', null::uuid) $$,
  'deleting the linked goal unlinks it and the dream returns to dreaming');

-- Achieved: date required; goal deletion keeps achieved dreams achieved
select tests.put('trip_goal2', public.convert_dream_to_goal(tests.get('trip'), 'Japão', 900000));
select lives_ok(
  $$ update public.dreams set status = 'achieved', achieved_at = '2028-07-10',
       achieved_image_path = tests.img('casa', 'trip', 'achieved.webp') where id = tests.get('trip') $$,
  'mark as achieved with date and photo (goal stays linked)');
delete from public.goals where id = tests.get('trip_goal2');
select results_eq(
  $$ select status::text, goal_id, achieved_at from public.dreams where id = tests.get('trip') $$,
  $$ values ('achieved', null::uuid, '2028-07-10'::date) $$,
  'deleting the goal of an achieved dream keeps it achieved');
select throws_ok(
  $$ update public.dreams set status = 'dreaming' where id = tests.get('trip') $$,
  '23514', null, 'leaving achieved requires clearing the date');
select lives_ok(
  $$ update public.dreams set status = 'dreaming', achieved_at = null, achieved_image_path = null where id = tests.get('trip') $$,
  'undo achieved clears date and photo');

-- Manual order
select public.reorder_dreams(tests.get('casa'), array[tests.get('guitar'), tests.get('trip')]);
select results_eq(
  $$ select id, position from public.dreams where workspace_id = tests.get('casa') order by position $$,
  $$ values (tests.get('guitar'), 1), (tests.get('trip'), 2) $$,
  'reorder_dreams stores the array order');

-- =====================================================================
-- Reactions
-- =====================================================================
select tests.login_as('bob');
select lives_ok(
  $$ insert into public.dream_reactions (dream_id, workspace_id, type) values (tests.get('trip'), tests.get('casa'), 'love') $$,
  'member reacts to a shared dream');
select throws_ok(
  $$ insert into public.dream_reactions (dream_id, workspace_id, type) values (tests.get('trip'), tests.get('casa'), 'love') $$,
  '23505', null, 'same reaction twice is rejected (toggle removes it)');
select throws_ok(
  $$ insert into public.dream_reactions (dream_id, workspace_id, user_id, type)
     values (tests.get('trip'), tests.get('casa'), tests.uid('alice'), 'me_too') $$,
  '42501', null, 'cannot react on behalf of someone else');
select tests.login_as('alice');
select lives_ok(
  $$ insert into public.dream_reactions (dream_id, workspace_id, type) values (tests.get('trip'), tests.get('casa'), 'me_too') $$,
  'partner reacts too');
select throws_ok(
  $$ insert into public.dream_reactions (dream_id, workspace_id, type)
     values (tests.get('personal_dream'), tests.get('alice_personal'), 'love') $$,
  '42501', null, 'no reactions in a personal workspace');
delete from public.dream_reactions where dream_id = tests.get('trip') and user_id = tests.uid('bob');
select is((select count(*)::int from public.dream_reactions where user_id = tests.uid('bob')), 1,
  'cannot remove someone else''s reaction');
select throws_ok(
  $$ insert into public.dream_reactions (dream_id, workspace_id, type) values (tests.get('trip'), tests.get('alice_personal'), 'love') $$,
  '42501', null, 'reaction workspace must match the dream (RLS on the given workspace)');

-- =====================================================================
-- Storage policies (bucket dream-images, path {workspace}/{dream}/{file})
-- =====================================================================
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('dream-images', tests.img('casa', 'trip')) $$,
  'member uploads into a dream folder of their workspace');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('dream-images', tests.get('casa') || '/' || gen_random_uuid() || '/x.webp') $$,
  '42501', null, 'cannot upload into the folder of a dream that does not exist');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('dream-images', 'not-a-uuid/x.webp') $$,
  '42501', null, 'malformed path is denied (no cast error)');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('dream-images', tests.get('casa') || '/x.webp') $$,
  '42501', null, 'file must be inside a dream folder');

select tests.login_as('bob');
select is((select count(*)::int from storage.objects where bucket_id = 'dream-images'), 1,
  'partner sees the shared dream image');

-- =====================================================================
-- Outsider: nothing visible, nothing writable
-- =====================================================================
select tests.login_as('carol');
select is_empty($$ select 1 from public.dreams where workspace_id = tests.get('casa') $$, 'outsider: dreams hidden');
select is_empty($$ select 1 from public.dream_reactions where workspace_id = tests.get('casa') $$, 'outsider: reactions hidden');
select is_empty($$ select 1 from storage.objects where bucket_id = 'dream-images' $$, 'outsider: images hidden');
select is_empty(
  $$ update public.dreams set title = 'hacked' where workspace_id = tests.get('casa') returning 1 $$,
  'outsider: cannot update dreams');
select is_empty(
  $$ delete from public.dreams where workspace_id = tests.get('casa') returning 1 $$,
  'outsider: cannot delete dreams');
select throws_ok(
  $$ insert into public.dreams (workspace_id, title) values (tests.get('casa'), 'intruso') $$,
  '42501', null, 'outsider: cannot create dreams in the workspace');
select throws_ok(
  $$ select public.convert_dream_to_goal(tests.get('guitar'), 'x', 100) $$,
  'P0002', null, 'outsider: cannot convert a dream they cannot see');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('dream-images', tests.img('casa', 'guitar', 'evil.webp')) $$,
  '42501', null, 'outsider: cannot upload into the workspace folder');
select ok(not public.can_access_dream_object(tests.img('casa', 'trip'), false),
  'outsider: cannot delete the workspace images');
select public.reorder_dreams(tests.get('casa'), array[tests.get('trip'), tests.get('guitar')]);

select tests.logout();
select results_eq(
  $$ select position from public.dreams where id = tests.get('trip') $$, $$ values (2) $$,
  'outsider: reorder has no effect');

select tests.login_anon();
select throws_ok($$ select 1 from public.dreams $$, '42501', null, 'anon: no access to dreams');

select tests.logout();
select * from finish();
rollback;
