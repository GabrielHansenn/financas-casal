-- RLS tests: an outsider can't see or change anything in a workspace they don't belong to;
-- members can't escalate privileges; anon can't read anything.
-- Run with: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

-- =====================================================================
-- Test helpers (rolled back with the transaction)
-- =====================================================================
create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.create_user(p_name text, p_confirmed boolean default true) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (v_id, p_name || '@test.local', 'authenticated', 'authenticated',
          jsonb_build_object('display_name', p_name), case when p_confirmed then now() end);
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

grant execute on all functions in schema tests to authenticated, anon;

-- =====================================================================
-- Setup: alice owns shared "Casa", bob is invited and accepts, carol is an outsider
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

-- Invite acceptance
select tests.login_as('carol');
select throws_ok(
  $$ select public.accept_workspace_invite(current_setting('test.token')) $$,
  '42501', null, 'outsider cannot accept an invite sent to another email');

select tests.login_as('bob');
select lives_ok(
  $$ select public.accept_workspace_invite(current_setting('test.token')) $$,
  'invited user accepts the invite');

-- Alice creates one row in every workspace-scoped table
select tests.login_as('alice');
do $$
declare
  v_casa uuid := tests.get('casa');
  v_acc  uuid := (select id from public.accounts where workspace_id = v_casa limit 1);
  v_cat  uuid := (select id from public.categories where workspace_id = v_casa and type = 'expense' limit 1);
  v_goal uuid;
begin
  perform tests.put('casa_acc', v_acc);
  perform tests.put('tx', public.save_transaction(
    p_id => null, p_workspace_id => v_casa, p_type => 'expense', p_account_id => v_acc,
    p_to_account_id => null, p_category_id => v_cat, p_amount_cents => 10001, p_date => current_date,
    p_description => 'Jantar', p_paid_by => tests.uid('alice'), p_split_type => 'equal',
    p_splits => jsonb_build_array(
      jsonb_build_object('user_id', tests.uid('alice'), 'amount_cents', 5001),
      jsonb_build_object('user_id', tests.uid('bob'),   'amount_cents', 5000))));

  insert into public.settlements (workspace_id, from_user_id, to_user_id, amount_cents, date)
  values (v_casa, tests.uid('bob'), tests.uid('alice'), 1000, current_date);

  insert into public.goals (workspace_id, name, target_cents) values (v_casa, 'Viagem', 100000)
  returning id into v_goal;
  insert into public.goal_contributions (goal_id, workspace_id, amount_cents, date)
  values (v_goal, v_casa, 5000, current_date);

  insert into public.recurring_transactions (workspace_id, type, account_id, amount_cents, frequency, start_date, next_date)
  values (v_casa, 'expense', v_acc, 9990, 'monthly', current_date, current_date);

  -- pending invite for someone else, so the invites table has a visible row for owners
  perform public.create_workspace_invite(v_casa, 'dave@test.local');

  -- validate splits now instead of at commit
  set constraints all immediate;
end $$;

-- =====================================================================
-- Outsider (carol): sees nothing
-- =====================================================================
select tests.login_as('carol');

select is_empty($$ select 1 from public.workspaces where id = tests.get('casa') $$, 'outsider: workspaces hidden');
select is_empty($$ select 1 from public.workspace_members where workspace_id = tests.get('casa') $$, 'outsider: members hidden');
select is_empty($$ select 1 from public.workspace_invites where workspace_id = tests.get('casa') $$, 'outsider: invites hidden');
select is_empty($$ select 1 from public.accounts where workspace_id = tests.get('casa') $$, 'outsider: accounts hidden');
select is_empty($$ select 1 from public.categories where workspace_id = tests.get('casa') $$, 'outsider: categories hidden');
select is_empty($$ select 1 from public.transactions where workspace_id = tests.get('casa') $$, 'outsider: transactions hidden');
select is_empty($$ select 1 from public.transaction_splits where workspace_id = tests.get('casa') $$, 'outsider: splits hidden');
select is_empty($$ select 1 from public.settlements where workspace_id = tests.get('casa') $$, 'outsider: settlements hidden');
select is_empty($$ select 1 from public.goals where workspace_id = tests.get('casa') $$, 'outsider: goals hidden');
select is_empty($$ select 1 from public.goal_contributions where workspace_id = tests.get('casa') $$, 'outsider: goal contributions hidden');
select is_empty($$ select 1 from public.recurring_transactions where workspace_id = tests.get('casa') $$, 'outsider: recurrences hidden');
select is_empty($$ select 1 from public.account_balances where workspace_id = tests.get('casa') $$, 'outsider: account_balances view hidden');
select is_empty($$ select 1 from public.goal_progress where workspace_id = tests.get('casa') $$, 'outsider: goal_progress view hidden');
select is_empty($$ select * from public.get_settlement_ledger(tests.get('casa')) $$, 'outsider: settlement ledger empty');
select is_empty($$ select * from public.get_period_summary(tests.get('casa'), '2000-01-01', '2100-01-01') $$, 'outsider: period summary empty');
select is_empty($$ select 1 from public.profiles where id = tests.uid('alice') $$, 'outsider: profiles of non-partners hidden');
select isnt_empty($$ select 1 from public.workspaces where created_by = tests.uid('carol') $$, 'outsider still sees own personal workspace');

-- ... and cannot write
select throws_ok(
  $$ insert into public.accounts (workspace_id, name, type) values (tests.get('casa'), 'Hack', 'cash') $$,
  '42501', null, 'outsider: cannot insert accounts');
select throws_ok(
  $$ select public.save_transaction(p_workspace_id => tests.get('casa'), p_type => 'expense',
       p_account_id => tests.get('casa_acc'), p_amount_cents => 100, p_date => current_date) $$,
  '42501', null, 'outsider: cannot insert transactions via RPC');
select throws_ok(
  $$ insert into public.workspaces (name, type, created_by) values ('Fake', 'shared', tests.uid('carol')) $$,
  '42501', null, 'outsider: cannot insert workspaces directly');
select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id) values (tests.get('casa'), tests.uid('carol')) $$,
  '42501', null, 'outsider: cannot add self as member');
select throws_ok(
  $$ select public.create_workspace_invite(tests.get('casa'), 'carol2@test.local') $$,
  '42501', null, 'outsider: cannot create invites');
select lives_ok(
  $$ update public.transactions set description = 'hacked' where id = tests.get('tx') $$,
  'outsider: update runs but matches no rows');
select lives_ok(
  $$ delete from public.transactions where id = tests.get('tx') $$,
  'outsider: delete runs but matches no rows');
select lives_ok(
  $$ update public.workspaces set name = 'hacked' where id = tests.get('casa') $$,
  'outsider: workspace rename matches no rows');

select tests.logout();
select is((select description from public.transactions where id = tests.get('tx')), 'Jantar',
  'transaction unchanged after outsider update');
select is((select name from public.workspaces where id = tests.get('casa')), 'Casa',
  'workspace unchanged after outsider update');

-- =====================================================================
-- Member (bob): sees shared data, cannot escalate or see owner-only data
-- =====================================================================
select tests.login_as('bob');

select is((select count(*)::int from public.transactions where workspace_id = tests.get('casa')), 1,
  'member: sees shared transactions');
select isnt_empty($$ select 1 from public.profiles where id = tests.uid('alice') $$,
  'member: sees partner profile');
select is_empty($$ select 1 from public.workspaces where id = tests.get('alice_personal') $$,
  'member: partner personal workspace hidden');
select is_empty($$ select 1 from public.accounts where workspace_id = tests.get('alice_personal') $$,
  'member: partner personal accounts hidden');
select is_empty($$ select 1 from public.workspace_invites where workspace_id = tests.get('casa') $$,
  'member: invites are owner-only');
select throws_ok(
  $$ update public.workspace_members set role = 'owner' where user_id = tests.uid('bob') $$,
  '42501', null, 'member: cannot promote self to owner');
select lives_ok(
  $$ update public.workspace_members set income_cents = 400000
      where workspace_id = tests.get('casa') and user_id = tests.uid('bob') $$,
  'member: can set own income');
select throws_ok(
  $$ select public.seed_workspace_defaults(tests.get('casa'), 'x') $$,
  '42501', null, 'member: internal functions are not callable');
select lives_ok(
  $$ delete from public.workspace_members where user_id = tests.uid('alice') $$,
  'member: removing the owner matches no rows');
select lives_ok(
  $$ delete from public.workspaces where id = tests.get('casa') $$,
  'member: deleting the workspace matches no rows');

select tests.logout();
select is((select count(*)::int from public.workspace_members where workspace_id = tests.get('casa')), 2,
  'both members still present');

-- =====================================================================
-- Anonymous: nothing
-- =====================================================================
select tests.login_anon();
select throws_ok($$ select 1 from public.transactions $$, '42501', null, 'anon: cannot read transactions');
select throws_ok($$ select 1 from public.profiles $$, '42501', null, 'anon: cannot read profiles');
select throws_ok($$ select * from public.get_invite_preview('x') $$, '42501', null, 'anon: cannot call RPCs');
select tests.logout();

select * from finish();
rollback;
