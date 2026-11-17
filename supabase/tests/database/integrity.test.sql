-- Integrity tests: cross-workspace references, split rules, membership rules,
-- invite lifecycle, recurrence dedupe, balances and settlement ledger.
-- Run with: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- =====================================================================
-- Test helpers (rolled back with the transaction)
-- =====================================================================
create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.create_user(p_name text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (v_id, p_name || '@test.local', 'authenticated', 'authenticated',
          jsonb_build_object('display_name', p_name));
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

create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Two-person splits array: tests.splits('alice', 5001, 'bob', 5000)
create function tests.splits(n1 text, a1 bigint, n2 text, a2 bigint) returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_object('user_id', tests.uid(n1), 'amount_cents', a1),
    jsonb_build_object('user_id', tests.uid(n2), 'amount_cents', a2))
$$;

-- Runs save_transaction for an expense in "Casa" and forces deferred checks immediately
create function tests.save_expense(
  p_amount bigint, p_paid_by uuid, p_split public.split_type, p_splits jsonb, p_id uuid default null
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  v_id := public.save_transaction(
    p_id => p_id, p_workspace_id => tests.get('casa'), p_type => 'expense',
    p_account_id => tests.get('acc'), p_to_account_id => null, p_category_id => tests.get('cat'),
    p_amount_cents => p_amount, p_date => current_date, p_description => 'teste',
    p_paid_by => p_paid_by, p_split_type => p_split, p_splits => p_splits);
  set constraints all immediate;
  set constraints all deferred;
  return v_id;
end $$;

grant execute on all functions in schema tests to authenticated, anon;

-- =====================================================================
-- Setup: alice owns "Casa", bob is a member, carol and dave are not
-- =====================================================================
select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('carol');
select tests.create_user('dave');

select tests.put('alice_personal',
  (select id from public.workspaces where created_by = tests.uid('alice') and type = 'personal'));
select tests.put('alice_personal_acc',
  (select id from public.accounts where workspace_id = tests.get('alice_personal')));
select tests.put('alice_personal_cat',
  (select id from public.categories where workspace_id = tests.get('alice_personal') and type = 'expense' limit 1));

select tests.login_as('alice');
select tests.put('casa', public.create_shared_workspace('Casa'));
select tests.logout();
insert into public.workspace_members (workspace_id, user_id) values (tests.get('casa'), tests.uid('bob'));

select tests.login_as('alice');
do $$
declare v_id uuid;
begin
  perform tests.put('acc', (select id from public.accounts where workspace_id = tests.get('casa')));
  perform tests.put('cat', (select id from public.categories where workspace_id = tests.get('casa') and name = 'Mercado'));
  insert into public.accounts (workspace_id, name, type, initial_balance_cents)
  values (tests.get('casa'), 'Saldo teste', 'checking', 10000) returning id into v_id;
  perform tests.put('acc2', v_id);
  insert into public.accounts (workspace_id, name, type)
  values (tests.get('casa'), 'Destino', 'savings') returning id into v_id;
  perform tests.put('acc3', v_id);
end $$;

-- =====================================================================
-- Cross-workspace references are rejected by composite FKs
-- (alice is a member of both workspaces, so RLS alone would allow these)
-- =====================================================================
select throws_ok(
  $$ insert into public.transactions (workspace_id, type, account_id, amount_cents, date)
     values (tests.get('casa'), 'expense', tests.get('alice_personal_acc'), 100, current_date) $$,
  '23503', null, 'transaction cannot use an account from another workspace');
select throws_ok(
  $$ insert into public.transactions (workspace_id, type, account_id, category_id, amount_cents, date)
     values (tests.get('casa'), 'expense', tests.get('acc'), tests.get('alice_personal_cat'), 100, current_date) $$,
  '23503', null, 'transaction cannot use a category from another workspace');
select throws_ok(
  $$ insert into public.transactions (workspace_id, type, account_id, to_account_id, amount_cents, date)
     values (tests.get('casa'), 'transfer', tests.get('acc'), tests.get('alice_personal_acc'), 100, current_date) $$,
  '23503', null, 'transfer cannot target an account from another workspace');

-- =====================================================================
-- Split rules
-- =====================================================================
select lives_ok(
  $$ select tests.put('tx', tests.save_expense(10001, tests.uid('alice'), 'equal',
       tests.splits('alice', 5001, 'bob', 5000))) $$,
  'valid equal split (odd cent to payer) is accepted');
select throws_ok(
  $$ select tests.save_expense(10001, tests.uid('alice'), 'equal', tests.splits('alice', 5000, 'bob', 5000)) $$,
  '23514', null, 'splits that do not sum to the amount are rejected');
select throws_ok(
  $$ select tests.save_expense(100, tests.uid('alice'), 'none', tests.splits('alice', 50, 'bob', 50)) $$,
  '23514', null, 'split rows are rejected when split_type is none');
select throws_ok(
  $$ select tests.save_expense(100, tests.uid('alice'), 'custom', tests.splits('alice', 50, 'carol', 50)) $$,
  '23514', null, 'split for a non-member is rejected');
select throws_ok(
  $$ select tests.save_expense(100, tests.uid('carol'), 'none', '[]') $$,
  '23514', null, 'paid_by must be a workspace member');
select throws_ok(
  $$ select tests.save_expense(100, null, 'equal', tests.splits('alice', 50, 'bob', 50)) $$,
  '23514', null, 'a split transaction needs a payer');
select throws_ok(
  $$ insert into public.transactions (workspace_id, type, account_id, category_id, amount_cents, date, split_type, paid_by)
     values (tests.get('casa'), 'income', tests.get('acc'), null, 100, current_date, 'equal', tests.uid('alice')) $$,
  '23514', null, 'income cannot be split');
select throws_ok(
  $$ insert into public.transactions (workspace_id, type, account_id, to_account_id, category_id, amount_cents, date)
     values (tests.get('casa'), 'transfer', tests.get('acc'), tests.get('acc2'), tests.get('cat'), 100, current_date) $$,
  '23514', null, 'transfer cannot have a category');
select throws_ok(
  $$ insert into public.transactions (workspace_id, type, account_id, to_account_id, amount_cents, date)
     values (tests.get('casa'), 'transfer', tests.get('acc'), tests.get('acc'), 100, current_date) $$,
  '23514', null, 'transfer needs two different accounts');

-- Editing replaces splits atomically
select lives_ok(
  $$ select tests.save_expense(20000, tests.uid('alice'), 'equal',
       tests.splits('alice', 10000, 'bob', 10000), tests.get('tx')) $$,
  'editing a transaction replaces its splits');
select is((select sum(amount_cents)::bigint from public.transaction_splits where transaction_id = tests.get('tx')),
  20000::bigint, 'edited splits sum to the new amount');
select throws_ok(
  $$ select tests.save_expense(100, tests.uid('alice'), 'none', '[]', gen_random_uuid()) $$,
  'P0002', null, 'editing a missing transaction fails');

-- created_by is immutable
update public.transactions set created_by = tests.uid('bob') where id = tests.get('tx');
select is((select created_by from public.transactions where id = tests.get('tx')), tests.uid('alice'),
  'created_by cannot be changed');

-- =====================================================================
-- Workspaces & invites
-- =====================================================================
select throws_ok(
  $$ select public.create_workspace_invite(tests.get('alice_personal'), 'bob@test.local') $$,
  '23514', null, 'cannot invite to a personal workspace');
select throws_ok(
  $$ select public.create_workspace_invite(tests.get('casa'), 'not-an-email') $$,
  '22023', null, 'invite email is validated');
select throws_ok(
  $$ select public.create_workspace_invite(tests.get('casa'), 'BOB@test.local') $$,
  '23505', null, 'cannot invite an existing member (case-insensitive)');

do $$ begin
  perform set_config('test.token_carol', public.create_workspace_invite(tests.get('casa'), 'carol@test.local'), true);
  perform set_config('test.token_dave',  public.create_workspace_invite(tests.get('casa'), 'dave@test.local'), true);
end $$;

select tests.login_as('carol');
select lives_ok($$ select public.accept_workspace_invite(current_setting('test.token_carol')) $$,
  'invitee accepts');
select throws_ok($$ select public.accept_workspace_invite(current_setting('test.token_carol')) $$,
  'P0002', null, 'an invite cannot be used twice');

select tests.logout();
update public.workspace_invites set expires_at = now() - interval '1 minute' where email = 'dave@test.local';
select tests.login_as('dave');
select throws_ok($$ select public.accept_workspace_invite(current_setting('test.token_dave')) $$,
  'P0002', null, 'expired invites are rejected');

select tests.logout();
select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id)
     values (tests.get('alice_personal'), tests.uid('bob')) $$,
  '23514', null, 'personal workspace cannot get a second member (even bypassing RLS)');

select tests.login_as('alice');
select lives_ok($$ delete from public.workspaces where id = tests.get('alice_personal') $$,
  'deleting a personal workspace matches no rows');
select isnt_empty($$ select 1 from public.workspaces where id = tests.get('alice_personal') $$,
  'personal workspace still exists');

-- =====================================================================
-- Recurrences generate at most one transaction per date
-- =====================================================================
do $$
declare v_rec uuid;
begin
  insert into public.recurring_transactions (workspace_id, type, account_id, category_id, amount_cents, frequency, start_date, next_date)
  values (tests.get('casa'), 'expense', tests.get('acc'), tests.get('cat'), 9990, 'monthly', current_date, current_date)
  returning id into v_rec;
  perform tests.put('rec', v_rec);
  insert into public.transactions (workspace_id, type, account_id, category_id, amount_cents, date, recurring_id, source)
  values (tests.get('casa'), 'expense', tests.get('acc'), tests.get('cat'), 9990, current_date, v_rec, 'recurring');
end $$;
select throws_ok(
  $$ insert into public.transactions (workspace_id, type, account_id, category_id, amount_cents, date, recurring_id, source)
     values (tests.get('casa'), 'expense', tests.get('acc'), tests.get('cat'), 9990, current_date, tests.get('rec'), 'recurring') $$,
  '23505', null, 'same recurrence cannot generate two transactions on the same date');

-- =====================================================================
-- Balances, period summary and settlement ledger
-- =====================================================================
insert into public.transactions (workspace_id, type, account_id, to_account_id, category_id, amount_cents, date) values
  (tests.get('casa'), 'income',   tests.get('acc2'), null,             null,             5000, current_date),
  (tests.get('casa'), 'expense',  tests.get('acc2'), null,             tests.get('cat'), 2000, current_date),
  (tests.get('casa'), 'transfer', tests.get('acc2'), tests.get('acc3'), null,            1000, current_date);

select is((select balance_cents from public.account_balances where account_id = tests.get('acc2')), 12000::bigint,
  'balance = initial + income - expense - transfer out');
select is((select balance_cents from public.account_balances where account_id = tests.get('acc3')), 1000::bigint,
  'transfer in is added to the destination account');
select is(
  (select sum(total_cents)::bigint from public.get_period_summary(tests.get('casa'), current_date, current_date)
    where type = 'expense'),
  31990::bigint, 'period summary totals expenses and ignores transfers');

insert into public.settlements (workspace_id, from_user_id, to_user_id, amount_cents, date)
values (tests.get('casa'), tests.uid('bob'), tests.uid('alice'), 2000, current_date);

select results_eq(
  $$ select creditor_id, debtor_id, amount_cents from public.get_settlement_ledger(tests.get('casa'))
     order by amount_cents desc $$,
  $$ values (tests.uid('alice'), tests.uid('bob'), 10000::bigint),
            (tests.uid('bob'), tests.uid('alice'), 2000::bigint) $$,
  'ledger: bob owes alice his split; his settlement makes him creditor of the paid amount');

select tests.logout();
select * from finish();
rollback;
