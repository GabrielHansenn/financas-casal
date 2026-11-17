-- Explicit privileges for the API roles.
-- The previous migrations relied on Supabase's default privileges (which grant everything on new
-- tables to anon/authenticated). Hosted projects can be configured differently, so privileges are
-- stated explicitly here and the schema behaves the same locally and in production.
-- RLS still decides which ROWS a user can touch; these grants decide which OPERATIONS exist at all.

grant usage on schema public to authenticated, service_role;

-- Workspace-scoped financial data: full CRUD (rows filtered by RLS)
grant select, insert, update, delete on
  public.accounts,
  public.categories,
  public.recurring_transactions,
  public.transactions,
  public.transaction_splits,
  public.settlements,
  public.goals,
  public.goal_contributions
to authenticated;

-- Identity and membership tables: writes happen through SECURITY DEFINER RPCs, so the API only
-- gets read access plus the specific column updates / deletes the RLS policies allow.
revoke all on
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.workspace_invites
from authenticated;

grant select on
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.workspace_invites
to authenticated;

grant update (display_name, avatar_url) on public.profiles to authenticated;
grant update (name) on public.workspaces to authenticated;
grant delete on public.workspaces to authenticated;
grant update (income_cents) on public.workspace_members to authenticated;
grant delete on public.workspace_members to authenticated;
grant update (status) on public.workspace_invites to authenticated;

-- Views (security_invoker, so RLS of the underlying tables applies)
grant select on public.account_balances, public.goal_progress to authenticated;

-- Server-side admin role (not used by the app, but keeps dashboard/tools working)
grant all on all tables in schema public to service_role;

-- anon never touches the public schema
revoke all on all tables in schema public from anon;
