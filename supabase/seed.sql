-- Local development seed. Runs on `npx supabase db reset`. NEVER run against production.
--
-- Test users (password for both: senha123):
--   ana@teste.local   (owner of the shared workspace "Casa", monthly income R$ 6.000)
--   bruno@teste.local (member of "Casa", monthly income R$ 4.000)
--
-- Dates are relative to the current month so the dashboard always has data for
-- "this month" and "last month". Everything runs in a single DO block (one statement),
-- so the deferred split checks run once, after all splits are inserted.

do $seed$
declare
  v_ana   constant uuid := '11111111-1111-1111-1111-111111111111';
  v_bruno constant uuid := '22222222-2222-2222-2222-222222222222';

  v_m0 date := date_trunc('month', current_date)::date;           -- first day of this month
  v_m1 date := (date_trunc('month', current_date) - interval '1 month')::date;

  v_ana_ws      uuid;
  v_bruno_ws    uuid;
  v_casa        uuid;
  v_casa_acc    uuid;
  v_card_acc    uuid;
  v_ana_acc     uuid;
  v_bruno_acc   uuid;
  v_rent_rec    uuid;
  v_goal        uuid;
  v_dream       uuid;
  v_tx          uuid;
  v_other       uuid;
  v_other_share bigint;
  r             record;
begin
  -- -------------------------------------------------------------------
  -- Users (the on_auth_user_created trigger creates profile + personal workspace)
  -- Token columns must be '' (not NULL) or GoTrue fails to load the user.
  -- -------------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  select
    '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
    extensions.crypt('senha123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', u.name), now(), now(),
    '', '', '', '', '', '', '', ''
  from (values (v_ana, 'ana@teste.local', 'Ana'),
               (v_bruno, 'bruno@teste.local', 'Bruno')) as u(id, email, name);

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
  from auth.users u where u.id in (v_ana, v_bruno);

  select id into v_ana_ws   from public.workspaces where created_by = v_ana   and type = 'personal';
  select id into v_bruno_ws from public.workspaces where created_by = v_bruno and type = 'personal';

  -- -------------------------------------------------------------------
  -- Shared workspace "Casa"
  -- -------------------------------------------------------------------
  insert into public.workspaces (name, type, created_by) values ('Casa', 'shared', v_ana)
  returning id into v_casa;

  insert into public.workspace_members (workspace_id, user_id, role, income_cents) values
    (v_casa, v_ana,   'owner',  600000),
    (v_casa, v_bruno, 'member', 400000);

  perform public.seed_workspace_defaults(v_casa, 'Conta do casal');

  select id into v_casa_acc from public.accounts where workspace_id = v_casa and name = 'Conta do casal';
  update public.accounts set initial_balance_cents = 800000 where id = v_casa_acc;

  insert into public.accounts (workspace_id, name, type, owner_user_id)
  values (v_casa, 'Cartão de crédito', 'credit_card', v_ana)
  returning id into v_card_acc;

  -- -------------------------------------------------------------------
  -- Personal data
  -- -------------------------------------------------------------------
  select id into v_ana_acc   from public.accounts where workspace_id = v_ana_ws;
  select id into v_bruno_acc from public.accounts where workspace_id = v_bruno_ws;
  update public.accounts set initial_balance_cents = 250000 where id = v_ana_acc;
  update public.accounts set initial_balance_cents = 120000 where id = v_bruno_acc;

  insert into public.transactions (workspace_id, type, account_id, category_id, amount_cents, date, description, paid_by, created_by)
  select ws, t.type::public.transaction_type, acc,
         (select c.id from public.categories c
           where c.workspace_id = ws and c.name = t.category and c.type::text = t.type),
         t.amount, least(t.day, current_date), t.description, usr, usr
  from (values
    (v_ana_ws,   v_ana_acc,   v_ana,   'income',  'Salário',     600000, v_m1 + 4,  'Salário'),
    (v_ana_ws,   v_ana_acc,   v_ana,   'income',  'Salário',     600000, v_m0 + 4,  'Salário'),
    (v_ana_ws,   v_ana_acc,   v_ana,   'expense', 'Compras',      18990, v_m1 + 17, 'Tênis de corrida'),
    (v_ana_ws,   v_ana_acc,   v_ana,   'expense', 'Educação',     34900, v_m0 + 1,  'Curso de inglês'),
    (v_bruno_ws, v_bruno_acc, v_bruno, 'income',  'Salário',     400000, v_m1 + 4,  'Salário'),
    (v_bruno_ws, v_bruno_acc, v_bruno, 'income',  'Salário',     400000, v_m0 + 4,  'Salário'),
    (v_bruno_ws, v_bruno_acc, v_bruno, 'income',  'Freelance',    85000, v_m1 + 20, 'Projeto de site'),
    (v_bruno_ws, v_bruno_acc, v_bruno, 'expense', 'Transporte',   21000, v_m0 + 2,  'Gasolina')
  ) as t(ws, acc, usr, type, category, amount, day, description);

  -- -------------------------------------------------------------------
  -- Recurring rent (proportional), already generated for last month and this month
  -- -------------------------------------------------------------------
  insert into public.recurring_transactions (
    workspace_id, type, account_id, category_id, amount_cents, description, paid_by,
    split_type, frequency, start_date, next_date, created_by
  ) values (
    v_casa, 'expense', v_casa_acc,
    (select id from public.categories where workspace_id = v_casa and name = 'Moradia'),
    250000, 'Aluguel', v_ana, 'proportional', 'monthly', v_m1 + 4,
    (v_m0 + interval '1 month')::date + 4, v_ana
  ) returning id into v_rent_rec;

  -- -------------------------------------------------------------------
  -- Shared expenses. Splits: equal -> payer absorbs the leftover cent;
  -- proportional -> by income (60/40), payer absorbs rounding; custom -> explicit.
  -- -------------------------------------------------------------------
  for r in
    select * from (values
      -- description,     category,      amount, date,      payer,   account,    split,          custom share of Ana, recurring
      ('Aluguel',         'Moradia',     250000::bigint, v_m1 + 4,  v_ana,   v_casa_acc, 'proportional', null::bigint, v_rent_rec),
      ('Mercado do mês',  'Mercado',      68790, v_m1 + 7,  v_bruno, v_casa_acc, 'equal',        null,         null::uuid),
      ('Jantar fora',     'Alimentação',  18999, v_m1 + 11, v_ana,   v_card_acc, 'equal',        null,         null),
      ('Internet',        'Assinaturas',   9990, v_m1 + 14, v_bruno, v_casa_acc, 'equal',        null,         null),
      ('Farmácia',        'Saúde',         4550, v_m1 + 19, v_ana,   v_card_acc, 'custom',       1550,         null),
      ('Cinema',          'Lazer',         6400, v_m1 + 21, v_bruno, v_casa_acc, 'equal',        null,         null),
      ('Aluguel',         'Moradia',     250000, v_m0 + 4,  v_ana,   v_casa_acc, 'proportional', null,         v_rent_rec),
      ('Mercado',         'Mercado',      45321, v_m0 + 2,  v_ana,   v_card_acc, 'equal',        null,         null),
      ('Uber',            'Transporte',    3275, v_m0 + 5,  v_bruno, v_casa_acc, 'equal',        null,         null),
      ('Streaming',       'Assinaturas',   5590, v_m0 + 9,  v_ana,   v_card_acc, 'equal',        null,         null),
      ('Ração',           'Pets',         12990, v_m0 + 10, v_bruno, v_casa_acc, 'proportional', null,         null),
      ('Padaria',         'Alimentação',   2733, v_m0 + 13, v_bruno, v_casa_acc, 'none',         null,         null)
    ) as t(description, category, amount, day, payer, account, split, ana_custom, recurring)
  loop
    insert into public.transactions (
      workspace_id, type, account_id, category_id, amount_cents, date, description,
      paid_by, split_type, recurring_id, source, created_by
    ) values (
      v_casa, 'expense', r.account,
      (select id from public.categories where workspace_id = v_casa and name = r.category and type = 'expense'),
      r.amount, least(r.day, current_date), r.description, r.payer, r.split::public.split_type,
      r.recurring, case when r.recurring is null then 'manual' else 'recurring' end::public.transaction_source,
      r.payer
    ) returning id into v_tx;

    if r.split <> 'none' then
      v_other := case when r.payer = v_ana then v_bruno else v_ana end;
      v_other_share := case r.split
        when 'equal'        then r.amount / 2
        when 'proportional' then r.amount * (case when v_other = v_ana then 600000 else 400000 end) / 1000000
        when 'custom'       then case when v_other = v_ana then r.ana_custom else r.amount - r.ana_custom end
      end;
      insert into public.transaction_splits (transaction_id, workspace_id, user_id, amount_cents) values
        (v_tx, v_casa, v_other, v_other_share),
        (v_tx, v_casa, r.payer, r.amount - v_other_share);
    end if;
  end loop;

  -- Bruno partially paid Ana back last month
  insert into public.settlements (workspace_id, from_user_id, to_user_id, amount_cents, date, note, created_by)
  values (v_casa, v_bruno, v_ana, 50000, v_m1 + 27, 'Pix do mês', v_bruno);

  -- -------------------------------------------------------------------
  -- Goal with contributions
  -- -------------------------------------------------------------------
  insert into public.goals (workspace_id, name, target_cents, deadline, created_by)
  values (v_casa, 'Viagem de férias', 800000, (v_m0 + interval '6 months')::date, v_ana)
  returning id into v_goal;

  insert into public.goal_contributions (goal_id, workspace_id, amount_cents, date, note, created_by) values
    (v_goal, v_casa, 50000, v_m1 + 9, 'Primeiro aporte', v_ana),
    (v_goal, v_casa, 30000, least(v_m0 + 9, current_date), null, v_bruno);

  -- -------------------------------------------------------------------
  -- Dreams board (no images: covers are optional). Positions define the manual order.
  -- -------------------------------------------------------------------
  -- Planning: linked to the "Viagem de férias" goal above
  insert into public.dreams (workspace_id, title, why, category, horizon, owner_user_id,
                             estimated_cost_cents, status, goal_id, position, created_by)
  values (v_casa, 'Viagem de férias no Nordeste', 'Uma semana inteira só nós dois, pé na areia.',
          'travel', 'short', null, 800000, 'planning', v_goal, 1, v_ana)
  returning id into v_dream;
  insert into public.dream_reactions (dream_id, workspace_id, user_id, type) values
    (v_dream, v_casa, v_bruno, 'love'),
    (v_dream, v_casa, v_bruno, 'me_too');

  insert into public.dreams (workspace_id, title, why, category, horizon, owner_user_id,
                             estimated_cost_cents, position, created_by)
  values (v_casa, 'Nosso apartamento', 'Um cantinho com varanda e espaço para receber os amigos.',
          'home', 'long', null, 5000000, 2, v_bruno)
  returning id into v_dream;
  insert into public.dream_reactions (dream_id, workspace_id, user_id, type) values
    (v_dream, v_casa, v_ana, 'love');

  insert into public.dreams (workspace_id, title, category, horizon, owner_user_id, position, created_by)
  values
    (v_casa, 'Adotar um cachorro', 'pet', 'medium', null, 3, v_ana),
    (v_casa, 'Aprender a surfar', 'experience', 'someday', v_bruno, 4, v_bruno),
    (v_casa, 'Ver a aurora boreal', 'travel', 'someday', v_ana, 5, v_ana);

  -- Achieved: shows up in "Sonhos realizados"
  insert into public.dreams (workspace_id, title, why, category, horizon, owner_user_id,
                             status, achieved_at, position, created_by)
  values (v_casa, 'Primeiro show juntos', 'O começo de tudo.', 'experience', 'short', null,
          'achieved', v_m1 + 14, 6, v_bruno);

  -- Ana's personal board
  insert into public.dreams (workspace_id, title, category, horizon, owner_user_id,
                             estimated_cost_cents, position, created_by)
  values (v_ana_ws, 'Fazer um mestrado', 'education', 'long', v_ana, 4000000, 1, v_ana);
end;
$seed$;
