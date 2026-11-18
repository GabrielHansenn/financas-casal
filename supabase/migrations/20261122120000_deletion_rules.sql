-- Deletion rules and data consistency.
--
-- 1. Member references (paid_by, owners, settlement users) are validated only when they change,
--    so records that mention someone who left the workspace stay editable.
-- 2. Settlements may involve a former member who still has history in the workspace.
-- 3. Profiles of people you share history with stay visible (names don't turn into "Usuário").
-- 4. Leaving a workspace clears the leaver's ownership of accounts/dreams and pauses the
--    recurrences they pay for.
-- 5. Archiving an account or category pauses the recurrences that use it.
-- 6. New references to archived accounts/categories, and categories of the wrong type, are rejected.
-- 7. RPCs: delete_account / delete_category (optionally moving linked records), transfer of
--    workspace ownership, and deletion of the user's own account (LGPD).
-- 8. Deleting an auth user (app or dashboard) keeps an anonymized profile ("Ex-membro") so the
--    shared history and the couple's balance stay consistent.

-- =====================================================================
-- Helpers
-- =====================================================================
-- Internal: p_user_id appears in the financial history of the workspace
create function public.has_workspace_history(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.transactions t
                 where t.workspace_id = p_workspace_id and t.paid_by = p_user_id)
      or exists (select 1 from public.transaction_splits s
                 where s.workspace_id = p_workspace_id and s.user_id = p_user_id)
      or exists (select 1 from public.settlements st
                 where st.workspace_id = p_workspace_id
                   and (st.from_user_id = p_user_id or st.to_user_id = p_user_id));
$$;

-- True if p_user_id appears in the history of a workspace the current user belongs to
create function public.shares_history_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.user_id = (select auth.uid())
      and (
        exists (select 1 from public.transactions t
                where t.workspace_id = m.workspace_id
                  and (t.paid_by = p_user_id or t.created_by = p_user_id))
        or exists (select 1 from public.transaction_splits s
                   where s.workspace_id = m.workspace_id and s.user_id = p_user_id)
        or exists (select 1 from public.settlements st
                   where st.workspace_id = m.workspace_id
                     and (st.from_user_id = p_user_id or st.to_user_id = p_user_id))
        or exists (select 1 from public.goal_contributions c
                   where c.workspace_id = m.workspace_id and c.created_by = p_user_id)
      )
  );
$$;

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.shares_workspace_with(id)
    or public.shares_history_with(id)
  );

-- =====================================================================
-- 1 + 2. Member references: validate only new or changed values
-- =====================================================================
create or replace function public.enforce_member_refs()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_is_insert boolean := tg_op = 'INSERT';
begin
  if tg_table_name in ('transactions', 'recurring_transactions') then
    if new.paid_by is not null
       and (v_is_insert or new.paid_by is distinct from old.paid_by or new.workspace_id <> old.workspace_id)
       and not public.user_is_member(new.workspace_id, new.paid_by) then
      raise exception 'paid_by must be a workspace member' using errcode = '23514';
    end if;
  elsif tg_table_name = 'transaction_splits' then
    if (v_is_insert or new.user_id <> old.user_id or new.workspace_id <> old.workspace_id)
       and not public.user_is_member(new.workspace_id, new.user_id) then
      raise exception 'split user must be a workspace member' using errcode = '23514';
    end if;
  elsif tg_table_name = 'settlements' then
    -- A former member with history in the workspace can still settle up
    if not ((public.user_is_member(new.workspace_id, new.from_user_id)
             or public.has_workspace_history(new.workspace_id, new.from_user_id))
        and (public.user_is_member(new.workspace_id, new.to_user_id)
             or public.has_workspace_history(new.workspace_id, new.to_user_id))) then
      raise exception 'settlement users must be workspace members' using errcode = '23514';
    end if;
    -- At least one side must still be a member
    if not (public.user_is_member(new.workspace_id, new.from_user_id)
            or public.user_is_member(new.workspace_id, new.to_user_id)) then
      raise exception 'settlement users must be workspace members' using errcode = '23514';
    end if;
  elsif tg_table_name = 'accounts' then
    if new.owner_user_id is not null
       and (v_is_insert or new.owner_user_id is distinct from old.owner_user_id)
       and not public.user_is_member(new.workspace_id, new.owner_user_id) then
      raise exception 'account owner must be a workspace member' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.dreams_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_user_id is not null
     and (tg_op = 'INSERT' or new.owner_user_id is distinct from old.owner_user_id)
     and not public.user_is_member(new.workspace_id, new.owner_user_id) then
    raise exception 'dream owner must be a workspace member' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.goal_id is not null and new.goal_id is null and new.status = 'planning' then
    new.status := 'dreaming';
  end if;
  return new;
end;
$$;

-- =====================================================================
-- 4. Leaving a workspace (also fires for removals and account deletion)
-- =====================================================================
create function public.handle_member_left()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- The whole workspace is being deleted (cascade): nothing to clean up
  if not exists (select 1 from public.workspaces where id = old.workspace_id) then
    return null;
  end if;

  update public.accounts set owner_user_id = null
   where workspace_id = old.workspace_id and owner_user_id = old.user_id;

  -- The dream becomes "ours"
  update public.dreams set owner_user_id = null
   where workspace_id = old.workspace_id and owner_user_id = old.user_id;

  -- Nobody would pay these anymore: pause instead of generating failing occurrences
  update public.recurring_transactions set active = false
   where workspace_id = old.workspace_id and paid_by = old.user_id and active;

  return null;
end;
$$;

create trigger workspace_members_after_delete
  after delete on public.workspace_members
  for each row execute function public.handle_member_left();

-- =====================================================================
-- 5. Archiving pauses linked recurrences
-- =====================================================================
create function public.pause_recurrences_on_archive()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    if tg_table_name = 'accounts' then
      update public.recurring_transactions set active = false
       where account_id = new.id and active;
    else
      update public.recurring_transactions set active = false
       where category_id = new.id and active;
    end if;
  end if;
  return null;
end;
$$;

create trigger pause_recurrences_on_archive
  after update of archived_at on public.accounts
  for each row execute function public.pause_recurrences_on_archive();
create trigger pause_recurrences_on_archive
  after update of archived_at on public.categories
  for each row execute function public.pause_recurrences_on_archive();

-- =====================================================================
-- 6. Active, type-consistent references on new or changed values
-- =====================================================================
create function public.enforce_active_refs()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_is_insert boolean := tg_op = 'INSERT';
  v_category public.categories;
begin
  if (v_is_insert or new.account_id <> old.account_id)
     and exists (select 1 from public.accounts where id = new.account_id and archived_at is not null) then
    raise exception 'account is archived' using errcode = '23514';
  end if;

  -- Nested IF: plpgsql would fail evaluating new.to_account_id on recurring_transactions
  if tg_table_name = 'transactions' then
    if new.to_account_id is not null
       and (v_is_insert or new.to_account_id is distinct from old.to_account_id)
       and exists (select 1 from public.accounts where id = new.to_account_id and archived_at is not null) then
      raise exception 'account is archived' using errcode = '23514';
    end if;
  end if;

  if new.category_id is not null
     and (v_is_insert or new.category_id is distinct from old.category_id or new.type <> old.type) then
    select * into v_category from public.categories where id = new.category_id;
    if found then
      if v_category.type::text <> new.type::text then
        raise exception 'category type does not match' using errcode = '23514';
      end if;
      if v_category.archived_at is not null
         and (v_is_insert or new.category_id is distinct from old.category_id) then
        raise exception 'category is archived' using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_active_refs before insert or update on public.transactions
  for each row execute function public.enforce_active_refs();
create trigger enforce_active_refs before insert or update on public.recurring_transactions
  for each row execute function public.enforce_active_refs();

-- =====================================================================
-- 7a. Delete an account, optionally moving its records to another account
-- SECURITY INVOKER: RLS applies (outsiders see nothing, so they get 'not found').
-- Without p_move_to, the account must have no transactions or recurrences.
-- With p_move_to, transfers between the two accounts are deleted (they would become
-- transfers from an account to itself) and everything else is moved.
-- =====================================================================
create function public.delete_account(p_account_id uuid, p_move_to uuid default null)
returns table (moved_transactions int, moved_recurrences int, deleted_transfers int)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_account public.accounts;
  v_target  public.accounts;
  v_tx  int := 0;
  v_rec int := 0;
  v_tr  int := 0;
  v_n   int;
begin
  select * into v_account from public.accounts where id = p_account_id for update;
  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  if p_move_to is null then
    if exists (select 1 from public.transactions
               where account_id = p_account_id or to_account_id = p_account_id)
       or exists (select 1 from public.recurring_transactions where account_id = p_account_id) then
      raise exception 'account has linked records' using errcode = '23503';
    end if;
  else
    select * into v_target from public.accounts
     where id = p_move_to and workspace_id = v_account.workspace_id
     for update;
    if not found or v_target.id = v_account.id or v_target.archived_at is not null then
      raise exception 'invalid target account' using errcode = '22023';
    end if;

    delete from public.transactions
     where type = 'transfer'
       and ((account_id = p_account_id and to_account_id = p_move_to)
         or (account_id = p_move_to and to_account_id = p_account_id));
    get diagnostics v_tr = row_count;

    update public.transactions set account_id = p_move_to where account_id = p_account_id;
    get diagnostics v_n = row_count;
    v_tx := v_n;
    update public.transactions set to_account_id = p_move_to where to_account_id = p_account_id;
    get diagnostics v_n = row_count;
    v_tx := v_tx + v_n;

    update public.recurring_transactions set account_id = p_move_to where account_id = p_account_id;
    get diagnostics v_rec = row_count;
  end if;

  delete from public.accounts where id = p_account_id;
  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  return query select v_tx, v_rec, v_tr;
end;
$$;

-- =====================================================================
-- 7b. Delete a category, optionally moving its records to another category of the
-- same type (p_move_to) or leaving them without a category (p_uncategorize).
-- =====================================================================
create function public.delete_category(
  p_category_id uuid,
  p_move_to uuid default null,
  p_uncategorize boolean default false
)
returns table (moved_transactions int, moved_recurrences int)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_category public.categories;
  v_target   public.categories;
  v_tx  int := 0;
  v_rec int := 0;
begin
  select * into v_category from public.categories where id = p_category_id for update;
  if not found then
    raise exception 'category not found' using errcode = 'P0002';
  end if;

  if p_move_to is not null then
    select * into v_target from public.categories
     where id = p_move_to and workspace_id = v_category.workspace_id
     for update;
    if not found or v_target.id = v_category.id or v_target.type <> v_category.type
       or v_target.archived_at is not null then
      raise exception 'invalid target category' using errcode = '22023';
    end if;
  end if;

  if p_move_to is not null or p_uncategorize then
    update public.transactions set category_id = p_move_to where category_id = p_category_id;
    get diagnostics v_tx = row_count;
    update public.recurring_transactions set category_id = p_move_to where category_id = p_category_id;
    get diagnostics v_rec = row_count;
  elsif exists (select 1 from public.transactions where category_id = p_category_id)
     or exists (select 1 from public.recurring_transactions where category_id = p_category_id) then
    raise exception 'category has linked records' using errcode = '23503';
  end if;

  delete from public.categories where id = p_category_id;
  if not found then
    raise exception 'category not found' using errcode = 'P0002';
  end if;

  return query select v_tx, v_rec;
end;
$$;

-- =====================================================================
-- 7c. Transfer ownership of a shared workspace to another member
-- =====================================================================
create function public.transfer_workspace_ownership(p_workspace_id uuid, p_new_owner uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'only the owner can transfer the workspace' using errcode = '42501';
  end if;
  if not public.is_shared_workspace(p_workspace_id) then
    raise exception 'personal workspaces cannot be transferred' using errcode = '23514';
  end if;
  if p_new_owner = auth.uid() or not public.user_is_member(p_workspace_id, p_new_owner) then
    raise exception 'new owner must be another member' using errcode = '22023';
  end if;

  update public.workspace_members set role = 'owner'
   where workspace_id = p_workspace_id and user_id = p_new_owner;
  update public.workspace_members set role = 'member'
   where workspace_id = p_workspace_id and user_id = auth.uid();
end;
$$;

-- =====================================================================
-- 8. User deletion. Profiles outlive auth users as anonymized tombstones, because
-- transactions, splits and settlements of shared workspaces still reference them.
-- =====================================================================
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add column deleted_at timestamptz;

-- Runs for any deletion of an auth user (the app's "Excluir minha conta" or the dashboard)
create function public.handle_user_deleted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ws record;
begin
  -- Shared workspaces the user owns: hand over to the longest-standing member, or delete when alone
  for v_ws in
    select m.workspace_id
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.user_id = old.id and m.role = 'owner' and w.type = 'shared'
  loop
    update public.workspace_members set role = 'owner'
     where (workspace_id, user_id) = (
       select o.workspace_id, o.user_id from public.workspace_members o
       where o.workspace_id = v_ws.workspace_id and o.user_id <> old.id
       order by o.joined_at
       limit 1);
    if not found then
      delete from public.workspaces where id = v_ws.workspace_id;
    end if;
  end loop;

  delete from public.workspaces where created_by = old.id and type = 'personal';
  -- Leaves the remaining shared workspaces (handle_member_left cleans up owner refs)
  delete from public.workspace_members where user_id = old.id;
  delete from public.dream_reactions where user_id = old.id;
  -- Invites carry the user's email address
  delete from public.workspace_invites where email = lower(old.email);

  update public.profiles
     set display_name = 'Ex-membro', avatar_url = null, deleted_at = now()
   where id = old.id;

  return old;
end;
$$;

create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.handle_user_deleted();

-- The app's entry point: the user deletes their own account
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- =====================================================================
-- Privileges (project convention: revoke from everyone, grant explicitly)
-- =====================================================================
revoke execute on function
  public.has_workspace_history(uuid, uuid),
  public.shares_history_with(uuid),
  public.handle_member_left(),
  public.pause_recurrences_on_archive(),
  public.enforce_active_refs(),
  public.delete_account(uuid, uuid),
  public.delete_category(uuid, uuid, boolean),
  public.transfer_workspace_ownership(uuid, uuid),
  public.handle_user_deleted(),
  public.delete_my_account()
from public, anon, authenticated;

grant execute on function
  public.shares_history_with(uuid),
  public.delete_account(uuid, uuid),
  public.delete_category(uuid, uuid, boolean),
  public.transfer_workspace_ownership(uuid, uuid),
  public.delete_my_account()
to authenticated;
