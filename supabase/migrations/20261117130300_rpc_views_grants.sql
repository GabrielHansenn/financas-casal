-- RPCs, views and privileges.

-- =====================================================================
-- Workspaces & invites (SECURITY DEFINER: these perform writes that RLS
-- intentionally does not allow directly, after checking authorization)
-- =====================================================================
create function public.create_shared_workspace(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.workspaces (name, type, created_by)
  values (trim(p_name), 'shared', v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');

  perform public.seed_workspace_defaults(v_workspace_id, 'Conta do casal');
  return v_workspace_id;
end;
$$;

-- Creates an invite and returns the plain token exactly once (only its hash is stored).
-- Re-inviting the same email revokes the previous pending invite.
create function public.create_workspace_invite(p_workspace_id uuid, p_email text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_email text := lower(trim(p_email));
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'only workspace owners can invite' using errcode = '42501';
  end if;

  if (select w.type from public.workspaces w where w.id = p_workspace_id) <> 'shared' then
    raise exception 'cannot invite to a personal workspace' using errcode = '23514';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id and lower(u.email) = v_email
  ) then
    raise exception 'user is already a member' using errcode = '23505';
  end if;

  update public.workspace_invites
     set status = 'revoked'
   where workspace_id = p_workspace_id and email = v_email and status = 'pending';

  insert into public.workspace_invites (workspace_id, email, token_hash, invited_by)
  values (p_workspace_id, v_email, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());

  return v_token;
end;
$$;

-- Preview for the invite page. The invitee is not a member yet, so RLS would hide the invite;
-- knowing the token is the authorization.
create function public.get_invite_preview(p_token text)
returns table (
  workspace_name  text,
  invited_by_name text,
  email           text,
  status          public.invite_status,
  expires_at      timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select w.name, p.display_name, i.email, i.status, i.expires_at
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  join public.profiles p on p.id = i.invited_by
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create function public.accept_workspace_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.workspace_invites;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_invite
  from public.workspace_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found or v_invite.status <> 'pending' or v_invite.expires_at < now() then
    raise exception 'invite is invalid or expired' using errcode = 'P0002';
  end if;

  if lower(coalesce(auth.jwt() ->> 'email', '')) <> v_invite.email then
    raise exception 'invite was sent to a different email' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), 'member')
  on conflict do nothing;

  update public.workspace_invites
     set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
   where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

-- =====================================================================
-- Transactions: atomic insert/update of a transaction and its splits.
-- SECURITY INVOKER: RLS applies normally. Split amounts are computed in the
-- app (src/lib/splits.ts) and validated here by the deferred constraint trigger.
-- p_splits: [{"user_id": "...", "amount_cents": 123}, ...]
-- Optional params have defaults so generated TS types mark them optional (call by name).
-- On update (p_id given) every column is overwritten, so an omitted optional param means NULL.
-- =====================================================================
create function public.save_transaction(
  p_workspace_id  uuid,
  p_type          public.transaction_type,
  p_account_id    uuid,
  p_amount_cents  bigint,
  p_date          date,
  p_split_type    public.split_type default 'none',
  p_id            uuid default null,
  p_to_account_id uuid default null,
  p_category_id   uuid default null,
  p_description   text default null,
  p_paid_by       uuid default null,
  p_splits        jsonb default '[]'::jsonb,
  p_recurring_id  uuid default null,
  p_source        public.transaction_source default 'manual'
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id          uuid;
  v_description text := nullif(trim(p_description), '');
begin
  if p_id is null then
    insert into public.transactions (
      workspace_id, type, account_id, to_account_id, category_id, amount_cents,
      date, description, paid_by, split_type, recurring_id, source
    ) values (
      p_workspace_id, p_type, p_account_id, p_to_account_id, p_category_id, p_amount_cents,
      p_date, v_description, p_paid_by, p_split_type, p_recurring_id, p_source
    )
    returning id into v_id;
  else
    update public.transactions
       set type          = p_type,
           account_id    = p_account_id,
           to_account_id = p_to_account_id,
           category_id   = p_category_id,
           amount_cents  = p_amount_cents,
           date          = p_date,
           description   = v_description,
           paid_by       = p_paid_by,
           split_type    = p_split_type
     where id = p_id and workspace_id = p_workspace_id
    returning id into v_id;

    if v_id is null then
      raise exception 'transaction not found' using errcode = 'P0002';
    end if;

    delete from public.transaction_splits where transaction_id = v_id;
  end if;

  insert into public.transaction_splits (transaction_id, workspace_id, user_id, amount_cents)
  select v_id, p_workspace_id, (s ->> 'user_id')::uuid, (s ->> 'amount_cents')::bigint
  from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) as s;

  return v_id;
end;
$$;

-- =====================================================================
-- Settlement ledger: "creditor is owed amount_cents by debtor".
-- Netting and debt simplification happen in the app (src/lib/settlement.ts, unit tested).
-- =====================================================================
create function public.get_settlement_ledger(p_workspace_id uuid)
returns table (creditor_id uuid, debtor_id uuid, amount_cents bigint)
language sql stable security invoker set search_path = ''
as $$
  -- Each split owed by someone other than the payer is a debt to the payer
  select t.paid_by, s.user_id, sum(s.amount_cents)::bigint
  from public.transaction_splits s
  join public.transactions t on t.id = s.transaction_id
  where s.workspace_id = p_workspace_id
    and s.user_id <> t.paid_by
  group by t.paid_by, s.user_id

  union all

  -- Paying back makes the payer a creditor of the receiver, cancelling the debt
  select st.from_user_id, st.to_user_id, sum(st.amount_cents)::bigint
  from public.settlements st
  where st.workspace_id = p_workspace_id
  group by st.from_user_id, st.to_user_id;
$$;

-- =====================================================================
-- Dashboard aggregates for a date range (transfers excluded)
-- =====================================================================
create function public.get_period_summary(p_workspace_id uuid, p_from date, p_to date)
returns table (category_id uuid, type public.transaction_type, total_cents bigint)
language sql stable security invoker set search_path = ''
as $$
  select t.category_id, t.type, sum(t.amount_cents)::bigint
  from public.transactions t
  where t.workspace_id = p_workspace_id
    and t.date between p_from and p_to
    and t.type <> 'transfer'
  group by t.category_id, t.type;
$$;

-- =====================================================================
-- Views (security_invoker: RLS of the querying user applies)
-- =====================================================================
create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.workspace_id,
  (a.initial_balance_cents + coalesce(sum(
    case
      when t.to_account_id = a.id then t.amount_cents   -- transfer in
      when t.type = 'income'      then t.amount_cents
      else -t.amount_cents                              -- expense or transfer out
    end
  ), 0))::bigint as balance_cents
from public.accounts a
left join public.transactions t
  on t.account_id = a.id or t.to_account_id = a.id
group by a.id;

create view public.goal_progress
with (security_invoker = true)
as
select
  g.id as goal_id,
  g.workspace_id,
  g.target_cents,
  coalesce(sum(c.amount_cents), 0)::bigint as current_cents
from public.goals g
left join public.goal_contributions c on c.goal_id = g.id
group by g.id;

-- =====================================================================
-- Privileges
-- =====================================================================
-- Functions: nothing is callable unless explicitly granted below.
-- (Supabase grants EXECUTE to anon/authenticated by default; internal helpers such as
--  seed_workspace_defaults must not be callable through the API.)
-- CONVENTION for future migrations: Postgres also grants EXECUTE to PUBLIC on every new
-- function, so each new function must be followed by
--   revoke execute on function ... from public, anon, authenticated;
-- and an explicit grant if the app needs to call it.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

grant execute on function
  public.is_workspace_member(uuid),
  public.is_workspace_owner(uuid),
  public.shares_workspace_with(uuid),
  public.create_shared_workspace(text),
  public.create_workspace_invite(uuid, text),
  public.get_invite_preview(text),
  public.accept_workspace_invite(text),
  public.save_transaction(uuid, public.transaction_type, uuid, bigint, date, public.split_type,
                          uuid, uuid, uuid, text, uuid, jsonb, uuid, public.transaction_source),
  public.get_settlement_ledger(uuid),
  public.get_period_summary(uuid, date, date)
to authenticated;

-- Tables and views: anonymous users get nothing (the app requires login everywhere).
revoke all on all tables in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
