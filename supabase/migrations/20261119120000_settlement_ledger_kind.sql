-- The settlement ledger now tells apart debts created by shared expenses ('split') from
-- payments already made between members ('settlement'), so the app can explain the balance.
-- The return type changes, so the function is dropped and recreated (privileges restated).

drop function public.get_settlement_ledger(uuid);

create function public.get_settlement_ledger(p_workspace_id uuid)
returns table (kind text, creditor_id uuid, debtor_id uuid, amount_cents bigint)
language sql stable security invoker set search_path = ''
as $$
  -- Each split owed by someone other than the payer is a debt to the payer
  select 'split'::text, t.paid_by, s.user_id, sum(s.amount_cents)::bigint
  from public.transaction_splits s
  join public.transactions t on t.id = s.transaction_id
  where s.workspace_id = p_workspace_id
    and s.user_id <> t.paid_by
  group by t.paid_by, s.user_id

  union all

  -- Paying back makes the payer a creditor of the receiver, cancelling the debt
  select 'settlement'::text, st.from_user_id, st.to_user_id, sum(st.amount_cents)::bigint
  from public.settlements st
  where st.workspace_id = p_workspace_id
  group by st.from_user_id, st.to_user_id;
$$;

revoke execute on function public.get_settlement_ledger(uuid) from public, anon, authenticated;
grant execute on function public.get_settlement_ledger(uuid) to authenticated;
