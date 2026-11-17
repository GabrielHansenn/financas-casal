-- Dreams board ("Quadro dos Sonhos"): visual wishes of a workspace, optionally linked to a goal.
-- Lifecycle: dreaming -> planning (linked goal) -> achieved. Deleting the linked goal sends a
-- planning dream back to dreaming. Images live in the private bucket "dream-images" under
-- {workspace_id}/{dream_id}/{file}.

create type public.dream_category as enum
  ('travel', 'home', 'vehicle', 'experience', 'career', 'pet', 'wedding', 'education', 'other');
create type public.dream_horizon as enum ('short', 'medium', 'long', 'someday');
create type public.dream_status as enum ('dreaming', 'planning', 'achieved');
create type public.dream_reaction_type as enum ('love', 'me_too');

-- =====================================================================
-- Tables
-- =====================================================================
create table public.dreams (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 80),
  why                  text check (char_length(why) <= 280),
  category             public.dream_category not null default 'other',
  horizon              public.dream_horizon not null default 'someday',
  -- Whose dream it is: a member, or NULL for "ours". Stored as a user id (not 'mine'/'partner',
  -- which would point to different people depending on who reads it).
  owner_user_id        uuid references public.profiles (id) on delete set null,
  estimated_cost_cents bigint check (estimated_cost_cents > 0),
  cover_image_path     text,
  status               public.dream_status not null default 'dreaming',
  goal_id              uuid,
  achieved_at          date,  -- the day the dream came true (a calendar date, chosen by the user)
  achieved_image_path  text,
  position             integer not null default 0,
  created_by           uuid not null default auth.uid() references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, workspace_id),
  unique (goal_id),  -- a goal backs at most one dream (and a dream has at most one goal)
  -- Same-workspace goal only; deleting the goal unlinks it (status handled by trigger below)
  foreign key (goal_id, workspace_id) references public.goals (id, workspace_id)
    on delete set null (goal_id),
  constraint dreams_planning_has_goal check (status <> 'planning' or goal_id is not null),
  constraint dreams_dreaming_has_no_goal check (status <> 'dreaming' or goal_id is null),
  constraint dreams_achieved_date check ((status = 'achieved') = (achieved_at is not null)),
  constraint dreams_achieved_image check (status = 'achieved' or achieved_image_path is null),
  -- Images must live in this dream's own folder: {workspace_id}/{dream_id}/...
  constraint dreams_cover_path check (
    cover_image_path is null or cover_image_path like workspace_id::text || '/' || id::text || '/%'),
  constraint dreams_achieved_path check (
    achieved_image_path is null or achieved_image_path like workspace_id::text || '/' || id::text || '/%')
);
create index dreams_ws_status_position_idx on public.dreams (workspace_id, status, position);

create table public.dream_reactions (
  dream_id     uuid not null,
  workspace_id uuid not null,  -- denormalized for RLS
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type         public.dream_reaction_type not null,
  created_at   timestamptz not null default now(),
  primary key (dream_id, user_id, type),
  foreign key (dream_id, workspace_id) references public.dreams (id, workspace_id) on delete cascade
);
create index dream_reactions_ws_idx on public.dream_reactions (workspace_id);

-- =====================================================================
-- Helpers & triggers
-- =====================================================================
create function public.is_shared_workspace(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspaces where id = p_workspace_id and type = 'shared');
$$;

-- Owner must be a member. When the linked goal is removed (goal_id goes from a value to NULL,
-- e.g. ON DELETE SET NULL), a planning dream goes back to 'dreaming'. FK actions fire row
-- triggers, so this runs before the check constraints. Only an actual unlink is handled:
-- setting 'planning' without ever having a goal still fails the check constraint.
create function public.dreams_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_user_id is not null and not public.user_is_member(new.workspace_id, new.owner_user_id) then
    raise exception 'dream owner must be a workspace member' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.goal_id is not null and new.goal_id is null and new.status = 'planning' then
    new.status := 'dreaming';
  end if;
  return new;
end;
$$;

create trigger dreams_before_write before insert or update on public.dreams
  for each row execute function public.dreams_before_write();
create trigger set_updated_at before update on public.dreams
  for each row execute function public.set_updated_at();
create trigger keep_created_by before update on public.dreams
  for each row execute function public.keep_created_by();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.dreams enable row level security;
alter table public.dream_reactions enable row level security;

create policy dreams_select on public.dreams for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy dreams_insert on public.dreams for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = (select auth.uid()));
create policy dreams_update on public.dreams for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy dreams_delete on public.dreams for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Reactions: visible to members; each user adds/removes only their own; shared workspaces only
create policy dream_reactions_select on public.dream_reactions for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy dream_reactions_insert on public.dream_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
    and public.is_shared_workspace(workspace_id));
create policy dream_reactions_delete on public.dream_reactions for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

-- =====================================================================
-- RPCs (security invoker: RLS applies)
-- =====================================================================
-- Atomically creates a goal from a 'dreaming' dream and links them
create function public.convert_dream_to_goal(
  p_dream_id uuid, p_name text, p_target_cents bigint, p_deadline date default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_dream public.dreams;
  v_goal uuid;
begin
  select * into v_dream from public.dreams where id = p_dream_id for update;
  if not found then
    raise exception 'dream not found' using errcode = 'P0002';
  end if;
  if v_dream.status <> 'dreaming' then
    raise exception 'only a dream in dreaming status can become a goal' using errcode = '23514';
  end if;

  insert into public.goals (workspace_id, name, target_cents, deadline)
  values (v_dream.workspace_id, trim(p_name), p_target_cents, p_deadline)
  returning id into v_goal;

  update public.dreams set status = 'planning', goal_id = v_goal where id = p_dream_id;
  return v_goal;
end;
$$;

-- Saves the manual order: position = index in the given array
create function public.reorder_dreams(p_workspace_id uuid, p_ids uuid[])
returns void language sql security invoker set search_path = '' as $$
  update public.dreams d set position = o.ord::int
  from unnest(p_ids) with ordinality as o(id, ord)
  where d.id = o.id and d.workspace_id = p_workspace_id;
$$;

-- =====================================================================
-- Storage: private bucket, path {workspace_id}/{dream_id}/{file}
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dream-images', 'dream-images', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- First folder must be a workspace the user belongs to (validated as a uuid before casting,
-- so malformed paths are denied instead of raising). When p_require_dream, the second folder
-- must be an existing dream of that workspace (prevents uploads to arbitrary folders).
create function public.can_access_dream_object(p_name text, p_require_dream boolean)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_parts text[] := storage.foldername(p_name);
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if coalesce(array_length(v_parts, 1), 0) <> 2
     or v_parts[1] !~ v_uuid or v_parts[2] !~ v_uuid then
    return false;
  end if;
  if not public.is_workspace_member(v_parts[1]::uuid) then
    return false;
  end if;
  return not p_require_dream or exists (
    select 1 from public.dreams where id = v_parts[2]::uuid and workspace_id = v_parts[1]::uuid);
end;
$$;

create policy dream_images_select on storage.objects for select to authenticated
  using (bucket_id = 'dream-images' and public.can_access_dream_object(name, true));
create policy dream_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dream-images' and public.can_access_dream_object(name, true));
create policy dream_images_update on storage.objects for update to authenticated
  using (bucket_id = 'dream-images' and public.can_access_dream_object(name, true))
  with check (bucket_id = 'dream-images' and public.can_access_dream_object(name, true));
-- Delete needs membership only, so leftover files can be cleaned even after the dream row is gone
create policy dream_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dream-images' and public.can_access_dream_object(name, false));

-- =====================================================================
-- Privileges (project convention: revoke from everyone, grant explicitly)
-- =====================================================================
revoke execute on function
  public.is_shared_workspace(uuid),
  public.dreams_before_write(),
  public.convert_dream_to_goal(uuid, text, bigint, date),
  public.reorder_dreams(uuid, uuid[]),
  public.can_access_dream_object(text, boolean)
from public, anon, authenticated;

grant execute on function
  public.is_shared_workspace(uuid),
  public.convert_dream_to_goal(uuid, text, bigint, date),
  public.reorder_dreams(uuid, uuid[]),
  public.can_access_dream_object(text, boolean)
to authenticated;

grant select, insert, update, delete on public.dreams to authenticated;
grant select, insert, delete on public.dream_reactions to authenticated;
grant all on public.dreams, public.dream_reactions to service_role;
revoke all on public.dreams, public.dream_reactions from anon;
