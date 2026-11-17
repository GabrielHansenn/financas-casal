-- Accepting an invite now requires a confirmed email address.
-- Invites are matched by email; without this check, someone could sign up with another
-- person's email (never confirming it) and accept an invite meant for them.

create or replace function public.accept_workspace_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.workspace_invites;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
  ) then
    raise exception 'email not confirmed' using errcode = '42501';
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

-- CREATE OR REPLACE keeps existing privileges; restated for clarity
revoke execute on function public.accept_workspace_invite(text) from public, anon;
grant execute on function public.accept_workspace_invite(text) to authenticated;
