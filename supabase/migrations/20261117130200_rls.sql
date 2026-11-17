-- Row Level Security.
-- Rule: a user can only read/write rows of workspaces they are a member of.
-- Workspaces, memberships and invites are created only through SECURITY DEFINER RPCs
-- (see next migration), so those tables have no INSERT policy.

alter table public.profiles               enable row level security;
alter table public.workspaces             enable row level security;
alter table public.workspace_members      enable row level security;
alter table public.workspace_invites      enable row level security;
alter table public.accounts               enable row level security;
alter table public.categories             enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.transactions           enable row level security;
alter table public.transaction_splits     enable row level security;
alter table public.settlements            enable row level security;
alter table public.goals                  enable row level security;
alter table public.goal_contributions     enable row level security;

-- =====================================================================
-- profiles: see yourself and people you share a workspace with; edit only yourself
-- =====================================================================
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_workspace_with(id));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- =====================================================================
-- workspaces
-- =====================================================================
create policy workspaces_select on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(id));

create policy workspaces_update on public.workspaces
  for update to authenticated
  using (public.is_workspace_owner(id))
  with check (public.is_workspace_owner(id));

-- Personal workspaces cannot be deleted
create policy workspaces_delete on public.workspaces
  for delete to authenticated
  using (public.is_workspace_owner(id) and type = 'shared');

revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

-- =====================================================================
-- workspace_members: members may only change income_cents (column grant);
-- non-owners can leave a shared workspace, owners can remove non-owners
-- =====================================================================
create policy members_select on public.workspace_members
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy members_update on public.workspace_members
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy members_delete on public.workspace_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = (select auth.uid()) or public.is_workspace_owner(workspace_id))
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.type = 'shared'
    )
  );

revoke update on public.workspace_members from authenticated;
grant update (income_cents) on public.workspace_members to authenticated;

-- =====================================================================
-- workspace_invites: owners list and revoke; creation/acceptance via RPC
-- =====================================================================
create policy invites_select on public.workspace_invites
  for select to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy invites_update on public.workspace_invites
  for update to authenticated
  using (public.is_workspace_owner(workspace_id) and status = 'pending')
  with check (status = 'revoked');

revoke update on public.workspace_invites from authenticated;
grant update (status) on public.workspace_invites to authenticated;

-- =====================================================================
-- Workspace-scoped financial data: full CRUD for members.
-- Tables with created_by also require created_by = current user on insert.
-- =====================================================================
do $$
declare
  v_table text;
  v_insert_check text;
begin
  foreach v_table in array array[
    'accounts', 'categories', 'recurring_transactions', 'transactions',
    'transaction_splits', 'settlements', 'goals', 'goal_contributions'
  ] loop
    if v_table in ('recurring_transactions', 'transactions', 'settlements', 'goals', 'goal_contributions') then
      v_insert_check := 'public.is_workspace_member(workspace_id) and created_by = (select auth.uid())';
    else
      v_insert_check := 'public.is_workspace_member(workspace_id)';
    end if;

    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using (public.is_workspace_member(workspace_id))', v_table);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check (%2$s)', v_table, v_insert_check);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using (public.is_workspace_member(workspace_id))
         with check (public.is_workspace_member(workspace_id))', v_table);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated
         using (public.is_workspace_member(workspace_id))', v_table);
  end loop;
end;
$$;

-- created_by is set once and never changed. (A column-level REVOKE would not work here:
-- it does not override the table-level UPDATE grant, so a trigger pins the value instead.)
create function public.keep_created_by()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'recurring_transactions', 'transactions', 'settlements', 'goals', 'goal_contributions'
  ] loop
    execute format(
      'create trigger keep_created_by before update on public.%I
         for each row execute function public.keep_created_by()', v_table);
  end loop;
end;
$$;
