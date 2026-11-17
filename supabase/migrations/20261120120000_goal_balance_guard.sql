-- A goal's balance (sum of contributions; withdrawals are negative) can never go below zero.
-- Checked in the database so two members withdrawing at the same time cannot both pass:
-- the trigger locks the goal row, which serializes concurrent changes to the same goal.

create function public.assert_goal_balance()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_goal uuid := coalesce(new.goal_id, old.goal_id);
  v_total bigint;
begin
  perform 1 from public.goals where id = v_goal for update;
  if not found then
    return null; -- goal deleted (cascade)
  end if;

  select coalesce(sum(amount_cents), 0) into v_total
  from public.goal_contributions where goal_id = v_goal;

  if v_total < 0 then
    raise exception 'goal balance cannot be negative (%)', v_total using errcode = '23514';
  end if;

  -- A contribution moved to another goal: check the old goal too
  if tg_op = 'UPDATE' and old.goal_id <> new.goal_id then
    perform 1 from public.goals where id = old.goal_id for update;
    select coalesce(sum(amount_cents), 0) into v_total
    from public.goal_contributions where goal_id = old.goal_id;
    if v_total < 0 then
      raise exception 'goal balance cannot be negative (%)', v_total using errcode = '23514';
    end if;
  end if;

  return null;
end;
$$;

create trigger goal_contributions_balance_check
  after insert or update or delete on public.goal_contributions
  for each row execute function public.assert_goal_balance();

-- Trigger functions are not called directly by clients
revoke execute on function public.assert_goal_balance() from public, anon, authenticated;
