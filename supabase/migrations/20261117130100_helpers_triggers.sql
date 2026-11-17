-- Helper functions and triggers.
-- Helpers used by RLS policies are SECURITY DEFINER so policies on workspace_members
-- can call them without infinite recursion.

-- =====================================================================
-- Membership helpers
-- =====================================================================
create function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
  );
$$;

create function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- True if the current user shares at least one workspace with p_user_id
create function public.shares_workspace_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on b.workspace_id = a.workspace_id
    where a.user_id = (select auth.uid())
      and b.user_id = p_user_id
  );
$$;

-- Internal: membership check for an arbitrary user (used by validation triggers only)
create function public.user_is_member(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id
  );
$$;

-- =====================================================================
-- updated_at
-- =====================================================================
create function public.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.recurring_transactions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Workspace defaults: categories + one account
-- =====================================================================
create function public.seed_workspace_defaults(p_workspace_id uuid, p_account_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.categories (workspace_id, name, type, icon, color, sort_order) values
    (p_workspace_id, 'Mercado',     'expense', 'shopping-cart',  '#22c55e', 1),
    (p_workspace_id, 'Alimentação', 'expense', 'utensils',       '#f97316', 2),
    (p_workspace_id, 'Moradia',     'expense', 'house',          '#3b82f6', 3),
    (p_workspace_id, 'Transporte',  'expense', 'car',            '#eab308', 4),
    (p_workspace_id, 'Saúde',       'expense', 'heart-pulse',    '#ef4444', 5),
    (p_workspace_id, 'Lazer',       'expense', 'party-popper',   '#a855f7', 6),
    (p_workspace_id, 'Assinaturas', 'expense', 'repeat',         '#06b6d4', 7),
    (p_workspace_id, 'Compras',     'expense', 'shopping-bag',   '#ec4899', 8),
    (p_workspace_id, 'Educação',    'expense', 'graduation-cap', '#6366f1', 9),
    (p_workspace_id, 'Pets',        'expense', 'paw-print',      '#84cc16', 10),
    (p_workspace_id, 'Viagem',      'expense', 'plane',          '#14b8a6', 11),
    (p_workspace_id, 'Outros',      'expense', 'circle',         '#64748b', 99),
    (p_workspace_id, 'Salário',     'income',  'briefcase',      '#16a34a', 1),
    (p_workspace_id, 'Freelance',   'income',  'laptop',         '#0ea5e9', 2),
    (p_workspace_id, 'Rendimentos', 'income',  'trending-up',    '#8b5cf6', 3),
    (p_workspace_id, 'Outros',      'income',  'circle',         '#64748b', 99);

  insert into public.accounts (workspace_id, name, type)
  values (p_workspace_id, p_account_name, 'checking');
end;
$$;

-- =====================================================================
-- Signup: profile + personal workspace + owner membership + defaults
-- =====================================================================
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                  split_part(new.email, '@', 1)), 80)
  );

  insert into public.workspaces (name, type, created_by)
  values ('Pessoal', 'personal', new.id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner');

  perform public.seed_workspace_defaults(v_workspace_id, 'Conta principal');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Personal workspaces only ever contain their creator
-- =====================================================================
create function public.enforce_personal_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.workspaces w
    where w.id = new.workspace_id
      and w.type = 'personal'
      and w.created_by <> new.user_id
  ) then
    raise exception 'personal workspace cannot have other members' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger workspace_members_personal_guard
  before insert or update on public.workspace_members
  for each row execute function public.enforce_personal_membership();

-- =====================================================================
-- Users referenced by a row must be members of the row's workspace
-- (plpgsql compiles trigger functions per table, so each branch only
--  touches columns that exist on that table)
-- =====================================================================
create function public.enforce_member_refs()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name in ('transactions', 'recurring_transactions') then
    if new.paid_by is not null and not public.user_is_member(new.workspace_id, new.paid_by) then
      raise exception 'paid_by must be a workspace member' using errcode = '23514';
    end if;
  elsif tg_table_name = 'transaction_splits' then
    if not public.user_is_member(new.workspace_id, new.user_id) then
      raise exception 'split user must be a workspace member' using errcode = '23514';
    end if;
  elsif tg_table_name = 'settlements' then
    if not (public.user_is_member(new.workspace_id, new.from_user_id)
            and public.user_is_member(new.workspace_id, new.to_user_id)) then
      raise exception 'settlement users must be workspace members' using errcode = '23514';
    end if;
  elsif tg_table_name = 'accounts' then
    if new.owner_user_id is not null
       and not public.user_is_member(new.workspace_id, new.owner_user_id) then
      raise exception 'account owner must be a workspace member' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_member_refs before insert or update on public.transactions
  for each row execute function public.enforce_member_refs();
create trigger enforce_member_refs before insert or update on public.recurring_transactions
  for each row execute function public.enforce_member_refs();
create trigger enforce_member_refs before insert or update on public.transaction_splits
  for each row execute function public.enforce_member_refs();
create trigger enforce_member_refs before insert or update on public.settlements
  for each row execute function public.enforce_member_refs();
create trigger enforce_member_refs before insert or update on public.accounts
  for each row execute function public.enforce_member_refs();

-- =====================================================================
-- Split integrity (deferred to commit so a transaction and its splits can be
-- written in any order inside one database transaction):
--   split_type = 'none'  -> no split rows
--   split_type <> 'none' -> split rows sum exactly to amount_cents
-- =====================================================================
create function public.assert_transaction_splits(p_transaction_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_split_type public.split_type;
  v_amount     bigint;
  v_sum        bigint;
  v_count      int;
begin
  select t.split_type, t.amount_cents into v_split_type, v_amount
  from public.transactions t where t.id = p_transaction_id;

  if not found then
    return;  -- transaction was deleted (splits cascade)
  end if;

  select coalesce(sum(s.amount_cents), 0), count(*) into v_sum, v_count
  from public.transaction_splits s where s.transaction_id = p_transaction_id;

  if v_split_type = 'none' and v_count > 0 then
    raise exception 'transaction % has splits but split_type is none', p_transaction_id
      using errcode = '23514';
  elsif v_split_type <> 'none' and v_sum <> v_amount then
    raise exception 'splits sum (%) does not match transaction amount (%)', v_sum, v_amount
      using errcode = '23514';
  end if;
end;
$$;

create function public.check_splits_from_transaction()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.assert_transaction_splits(new.id);
  return null;
end;
$$;

create function public.check_splits_from_split()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.assert_transaction_splits(old.transaction_id);
  else
    perform public.assert_transaction_splits(new.transaction_id);
    if tg_op = 'UPDATE' and old.transaction_id <> new.transaction_id then
      perform public.assert_transaction_splits(old.transaction_id);
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger transactions_splits_check
  after insert or update on public.transactions
  deferrable initially deferred
  for each row execute function public.check_splits_from_transaction();

create constraint trigger transaction_splits_sum_check
  after insert or update or delete on public.transaction_splits
  deferrable initially deferred
  for each row execute function public.check_splits_from_split();
