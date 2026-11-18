-- Deletion rules (migration 20261122120000_deletion_rules.sql):
-- outsiders can't delete anything; accounts/categories with links are protected and can be
-- moved; archiving pauses recurrences; the couple's balance follows deletions; leaving a
-- workspace keeps history editable; ownership transfer; account deletion (LGPD).
-- Run with: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

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

create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- A shared workspace with two members: p_owner creates it, p_member accepts the invite
create function tests.make_couple(p_owner text, p_member text, p_name text) returns uuid language plpgsql as $$
declare v_ws uuid; v_token text;
begin
  perform tests.login_as(p_owner);
  v_ws := public.create_shared_workspace(p_name);
  v_token := public.create_workspace_invite(v_ws, p_member || '@test.local');
  perform tests.login_as(p_member);
  perform public.accept_workspace_invite(v_token);
  return v_ws;
end $$;

-- What p_debtor owes p_creditor from shared expenses in a workspace
create function tests.split_debt(p_ws uuid, p_creditor text, p_debtor text) returns bigint language sql as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.get_settlement_ledger(p_ws)
  where kind = 'split' and creditor_id = tests.uid(p_creditor) and debtor_id = tests.uid(p_debtor)
$$;

grant execute on all functions in schema tests to authenticated, anon;

-- =====================================================================
-- Setup: alice + bob share "Casa"; carol is an outsider
-- =====================================================================
select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('carol');
select tests.put('casa', tests.make_couple('alice', 'bob', 'Casa'));

select tests.login_as('alice');
do $$
declare v uuid; v_ws uuid := tests.get('casa');
begin
  perform tests.put('acc_a', (select id from public.accounts where workspace_id = v_ws));
  insert into public.accounts (workspace_id, name, type) values (v_ws, 'Nubank', 'checking') returning id into v;
  perform tests.put('acc_b', v);
  insert into public.accounts (workspace_id, name, type) values (v_ws, 'Vazia', 'cash') returning id into v;
  perform tests.put('acc_empty', v);
  perform tests.put('cat_mercado', (select id from public.categories where workspace_id = v_ws and name = 'Mercado'));
  perform tests.put('cat_lazer', (select id from public.categories where workspace_id = v_ws and name = 'Lazer'));
  perform tests.put('cat_salario', (select id from public.categories where workspace_id = v_ws and name = 'Salário'));

  -- Shared expense on A: alice paid 100,00, split 50/50
  perform tests.put('tx_shared', public.save_transaction(
    p_workspace_id => v_ws, p_type => 'expense', p_account_id => tests.get('acc_a'), p_amount_cents => 10000,
    p_date => current_date, p_category_id => tests.get('cat_mercado'), p_paid_by => tests.uid('alice'),
    p_split_type => 'equal',
    p_splits => jsonb_build_array(
      jsonb_build_object('user_id', tests.uid('alice'), 'amount_cents', 5000),
      jsonb_build_object('user_id', tests.uid('bob'), 'amount_cents', 5000))));
  -- Transfer A -> B, and an income on B
  perform public.save_transaction(p_workspace_id => v_ws, p_type => 'transfer', p_account_id => tests.get('acc_a'),
    p_to_account_id => tests.get('acc_b'), p_amount_cents => 2000, p_date => current_date);
  perform public.save_transaction(p_workspace_id => v_ws, p_type => 'income', p_account_id => tests.get('acc_b'),
    p_category_id => tests.get('cat_salario'), p_amount_cents => 300000, p_date => current_date);
  -- Recurrence on A / Lazer
  insert into public.recurring_transactions (workspace_id, type, account_id, category_id, amount_cents, frequency, start_date, next_date)
  values (v_ws, 'expense', tests.get('acc_a'), tests.get('cat_lazer'), 3990, 'monthly', current_date + 30, current_date + 30)
  returning id into v;
  perform tests.put('rec_a', v);
  -- A goal with a deposit and a dream
  insert into public.goals (workspace_id, name, target_cents) values (v_ws, 'Viagem', 100000) returning id into v;
  perform tests.put('goal', v);
  insert into public.goal_contributions (goal_id, workspace_id, amount_cents, date) values (v, v_ws, 1000, current_date);
  insert into public.dreams (workspace_id, title) values (v_ws, 'Japão') returning id into v;
  perform tests.put('dream', v);
end $$;

-- =====================================================================
-- Outsider: every DELETE matches no rows; RPCs refuse
-- =====================================================================
select tests.login_as('carol');
delete from public.accounts where workspace_id = tests.get('casa');
delete from public.categories where workspace_id = tests.get('casa');
delete from public.recurring_transactions where workspace_id = tests.get('casa');
delete from public.transaction_splits where workspace_id = tests.get('casa');
delete from public.transactions where workspace_id = tests.get('casa');
delete from public.settlements where workspace_id = tests.get('casa');
delete from public.goal_contributions where workspace_id = tests.get('casa');
delete from public.goals where workspace_id = tests.get('casa');
delete from public.dreams where workspace_id = tests.get('casa');
delete from public.workspace_members where workspace_id = tests.get('casa');
delete from public.workspaces where id = tests.get('casa');

select throws_ok($$ select public.delete_account(tests.get('acc_empty')) $$,
  'P0002', null, 'outsider: delete_account finds nothing');
select throws_ok($$ select public.delete_category(tests.get('cat_lazer'), tests.get('cat_mercado')) $$,
  'P0002', null, 'outsider: delete_category finds nothing');
select throws_ok($$ select public.transfer_workspace_ownership(tests.get('casa'), tests.uid('carol')) $$,
  '42501', null, 'outsider: cannot take over a workspace');

select tests.logout();
select is((select count(*)::int from public.accounts where workspace_id = tests.get('casa')), 3, 'outsider: accounts intact');
select is((select count(*)::int from public.categories where workspace_id = tests.get('casa')), 16, 'outsider: categories intact');
select is((select count(*)::int from public.recurring_transactions where workspace_id = tests.get('casa')), 1, 'outsider: recurrences intact');
select is((select count(*)::int from public.transactions where workspace_id = tests.get('casa')), 3, 'outsider: transactions intact');
select is((select count(*)::int from public.transaction_splits where workspace_id = tests.get('casa')), 2, 'outsider: splits intact');
select is((select count(*)::int from public.goals where workspace_id = tests.get('casa')), 1, 'outsider: goals intact');
select is((select count(*)::int from public.goal_contributions where workspace_id = tests.get('casa')), 1, 'outsider: contributions intact');
select is((select count(*)::int from public.dreams where workspace_id = tests.get('casa')), 1, 'outsider: dreams intact');
select is((select count(*)::int from public.workspace_members where workspace_id = tests.get('casa')), 2, 'outsider: members intact');
select is((select count(*)::int from public.workspaces where id = tests.get('casa')), 1, 'outsider: workspace intact');

-- =====================================================================
-- Accounts: protected when linked, deletable when empty, movable
-- =====================================================================
select tests.login_as('bob');
select throws_ok($$ select public.delete_account(tests.get('acc_a')) $$,
  '23503', null, 'account with transactions cannot be deleted directly');
select throws_ok($$ delete from public.accounts where id = tests.get('acc_a') $$,
  '23503', null, 'plain DELETE of a linked account is still blocked by the foreign keys');
select throws_ok($$ select public.delete_account(tests.get('acc_a'), tests.get('acc_a')) $$,
  '22023', null, 'cannot move an account into itself');

select lives_ok($$ select public.delete_account(tests.get('acc_empty')) $$, 'empty account is deleted');
select is((select count(*)::int from public.accounts where id = tests.get('acc_empty')), 0, 'empty account is gone');

select results_eq(
  $$ select moved_transactions, moved_recurrences, deleted_transfers
     from public.delete_account(tests.get('acc_a'), tests.get('acc_b')) $$,
  $$ values (1, 1, 1) $$,
  'moving A into B: 1 transaction and 1 recurrence moved, the A->B transfer deleted');
select is((select account_id from public.transactions where id = tests.get('tx_shared')), tests.get('acc_b'),
  'the shared expense now belongs to B');
select is((select account_id from public.recurring_transactions where id = tests.get('rec_a')), tests.get('acc_b'),
  'the recurrence now uses B');
select is((select count(*)::int from public.transactions where type = 'transfer' and workspace_id = tests.get('casa')), 0,
  'no transfer from B to itself was left behind');
select is((select count(*)::int from public.transaction_splits where transaction_id = tests.get('tx_shared')), 2,
  'moving keeps the splits');

-- =====================================================================
-- Categories
-- =====================================================================
select throws_ok($$ select public.delete_category(tests.get('cat_lazer')) $$,
  '23503', null, 'category used by a recurrence cannot be deleted directly');
select throws_ok($$ select public.delete_category(tests.get('cat_lazer'), tests.get('cat_salario')) $$,
  '22023', null, 'cannot move an expense category into an income category');
select lives_ok($$ select public.delete_category(tests.get('cat_lazer'), tests.get('cat_mercado')) $$,
  'category moved into another of the same type and deleted');
select is((select category_id from public.recurring_transactions where id = tests.get('rec_a')), tests.get('cat_mercado'),
  'the recurrence moved to Mercado');
select lives_ok($$ select public.delete_category(tests.get('cat_mercado'), null, true) $$,
  'category deleted leaving its records without a category');
select is((select category_id from public.transactions where id = tests.get('tx_shared')), null::uuid,
  'the expense is now uncategorized');

-- =====================================================================
-- Archiving and active references
-- =====================================================================
update public.accounts set archived_at = now() where id = tests.get('acc_b');
select is((select active from public.recurring_transactions where id = tests.get('rec_a')), false,
  'archiving an account pauses its recurrences');
select throws_like(
  $$ select public.save_transaction(p_workspace_id => tests.get('casa'), p_type => 'income',
       p_account_id => tests.get('acc_b'), p_amount_cents => 100, p_date => current_date) $$,
  '%account is archived%', 'new transactions cannot use an archived account');
select lives_ok($$ update public.transactions set description = 'Mercado do mês' where id = tests.get('tx_shared') $$,
  'old transactions on an archived account stay editable');
update public.accounts set archived_at = null where id = tests.get('acc_b');
select throws_like(
  $$ select public.save_transaction(p_workspace_id => tests.get('casa'), p_type => 'expense',
       p_account_id => tests.get('acc_b'), p_category_id => tests.get('cat_salario'),
       p_amount_cents => 100, p_date => current_date) $$,
  '%category type does not match%', 'an expense cannot use an income category');

-- =====================================================================
-- The couple's balance follows deletions
-- =====================================================================
select is(tests.split_debt(tests.get('casa'), 'alice', 'bob'), 5000::bigint, 'bob owes alice 50,00');
do $$ begin
  perform tests.put('tx_dinner', public.save_transaction(
    p_workspace_id => tests.get('casa'), p_type => 'expense', p_account_id => tests.get('acc_b'),
    p_amount_cents => 8000, p_date => current_date, p_paid_by => tests.uid('alice'), p_split_type => 'equal',
    p_splits => jsonb_build_array(
      jsonb_build_object('user_id', tests.uid('alice'), 'amount_cents', 4000),
      jsonb_build_object('user_id', tests.uid('bob'), 'amount_cents', 4000))));
end $$;
select is(tests.split_debt(tests.get('casa'), 'alice', 'bob'), 9000::bigint, 'a new shared dinner adds 40,00');
delete from public.transactions where id = tests.get('tx_dinner');
select is(tests.split_debt(tests.get('casa'), 'alice', 'bob'), 5000::bigint, 'deleting it brings the debt back to 50,00');
select is((select count(*)::int from public.transaction_splits where transaction_id = tests.get('tx_dinner')), 0,
  'its splits are gone too');

-- =====================================================================
-- Ownership transfer
-- =====================================================================
select throws_ok($$ select public.transfer_workspace_ownership(tests.get('casa'), tests.uid('alice')) $$,
  '42501', null, 'a member cannot transfer the workspace');
select tests.login_as('alice');
select lives_ok($$ select public.transfer_workspace_ownership(tests.get('casa'), tests.uid('bob')) $$,
  'owner transfers the workspace');
select is((select role::text from public.workspace_members where workspace_id = tests.get('casa') and user_id = tests.uid('bob')),
  'owner', 'bob is the owner now');
select is((select role::text from public.workspace_members where workspace_id = tests.get('casa') and user_id = tests.uid('alice')),
  'member', 'alice became a member');
select tests.login_as('bob');
select lives_ok($$ select public.transfer_workspace_ownership(tests.get('casa'), tests.uid('alice')) $$,
  'and back');

-- =====================================================================
-- A member leaves: history stays consistent and editable
-- =====================================================================
update public.accounts set owner_user_id = tests.uid('bob') where id = tests.get('acc_b');
insert into public.recurring_transactions (workspace_id, type, account_id, amount_cents, paid_by, split_type, frequency, start_date, next_date)
values (tests.get('casa'), 'expense', tests.get('acc_b'), 12000, tests.uid('bob'), 'equal', 'monthly', current_date + 30, current_date + 30);
delete from public.workspace_members where workspace_id = tests.get('casa') and user_id = tests.uid('bob');

select tests.login_as('alice');
select is((select owner_user_id from public.accounts where id = tests.get('acc_b')), null::uuid,
  'the account bob owned became joint');
select is((select count(*)::int from public.recurring_transactions where workspace_id = tests.get('casa') and paid_by = tests.uid('bob') and active), 0,
  'recurrences paid by bob were paused');
select lives_ok($$ update public.transactions set description = 'Feira' where id = tests.get('tx_shared') $$,
  'an expense split with bob is still editable');
select is((select display_name from public.profiles where id = tests.uid('bob')), 'bob',
  'bob''s name stays visible to who shares history with him');
select lives_ok(
  $$ insert into public.settlements (workspace_id, from_user_id, to_user_id, amount_cents, date)
     values (tests.get('casa'), tests.uid('bob'), tests.uid('alice'), 5000, current_date) $$,
  'alice can record that bob (former member) paid her back');
select is((tests.split_debt(tests.get('casa'), 'alice', 'bob')
          - (select coalesce(sum(amount_cents), 0) from public.get_settlement_ledger(tests.get('casa')) where kind = 'settlement'))::bigint,
  0::bigint, 'and they are even');
select throws_ok(
  $$ insert into public.settlements (workspace_id, from_user_id, to_user_id, amount_cents, date)
     values (tests.get('casa'), tests.uid('carol'), tests.uid('alice'), 100, current_date) $$,
  '23514', null, 'someone who never was in the workspace cannot be part of a settlement');

-- =====================================================================
-- Account deletion (LGPD)
-- =====================================================================
select tests.logout();
select tests.create_user('dave');
select tests.create_user('erin');
select tests.put('dupla', tests.make_couple('dave', 'erin', 'Dupla'));
select tests.login_as('dave');
do $$ begin
  perform public.save_transaction(
    p_workspace_id => tests.get('dupla'), p_type => 'expense',
    p_account_id => (select id from public.accounts where workspace_id = tests.get('dupla')),
    p_amount_cents => 6000, p_date => current_date, p_paid_by => tests.uid('dave'), p_split_type => 'equal',
    p_splits => jsonb_build_array(
      jsonb_build_object('user_id', tests.uid('dave'), 'amount_cents', 3000),
      jsonb_build_object('user_id', tests.uid('erin'), 'amount_cents', 3000)));
end $$;
select tests.put('dave_personal',
  (select id from public.workspaces where created_by = tests.uid('dave') and type = 'personal'));

select lives_ok($$ select public.delete_my_account() $$, 'dave deletes his own account');
select tests.logout();
select is((select count(*)::int from auth.users where id = tests.uid('dave')), 0, 'the auth user is gone');
select is((select count(*)::int from public.workspaces where id = tests.get('dave_personal')), 0, 'his personal workspace is gone');
select is((select role::text from public.workspace_members where workspace_id = tests.get('dupla') and user_id = tests.uid('erin')),
  'owner', 'the shared workspace was handed to erin');
select is((select display_name from public.profiles where id = tests.uid('dave')), 'Ex-membro', 'his profile is anonymized');
select is(tests.split_debt(tests.get('dupla'), 'dave', 'erin'), 3000::bigint, 'the shared history (and the balance) stays');

-- Alone in a shared workspace: it is deleted with the account
select tests.login_as('carol');
select tests.put('solo', public.create_shared_workspace('Solo'));
select lives_ok($$ select public.delete_my_account() $$, 'carol deletes her account');
select tests.logout();
select is((select count(*)::int from public.workspaces where id = tests.get('solo')), 0,
  'a shared workspace with no one else is deleted too');

select * from finish();
rollback;
