-- Core schema: enums and tables.
-- Money is always stored as integer cents (bigint). Transaction dates are `date`, timestamps are `timestamptz`.

create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- Enums
-- =====================================================================
create type public.workspace_type       as enum ('personal', 'shared');
create type public.member_role          as enum ('owner', 'member');
create type public.invite_status        as enum ('pending', 'accepted', 'revoked');
create type public.account_type         as enum ('checking', 'savings', 'credit_card', 'cash');
create type public.category_type        as enum ('income', 'expense');
create type public.transaction_type     as enum ('income', 'expense', 'transfer');
create type public.split_type           as enum ('none', 'equal', 'proportional', 'custom');
create type public.recurrence_frequency as enum ('weekly', 'monthly', 'yearly');
create type public.transaction_source   as enum ('manual', 'recurring', 'import');

-- =====================================================================
-- Profiles & workspaces
-- =====================================================================
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  type       public.workspace_type not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Exactly one personal workspace per user
create unique index workspaces_one_personal_per_user
  on public.workspaces (created_by) where type = 'personal';

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.member_role not null default 'member',
  income_cents bigint check (income_cents >= 0),  -- monthly income, used for proportional split
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null check (email = lower(email)),
  token_hash   text not null unique,              -- sha256(token) hex; the plain token is never stored
  status       public.invite_status not null default 'pending',
  invited_by   uuid not null references public.profiles (id),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_by  uuid references public.profiles (id),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create unique index workspace_invites_one_pending
  on public.workspace_invites (workspace_id, email) where status = 'pending';
create index workspace_invites_workspace_idx on public.workspace_invites (workspace_id);

-- =====================================================================
-- Accounts & categories
-- (unique (id, workspace_id) is the target of composite FKs, so rows of one
--  workspace can never reference accounts/categories of another workspace)
-- =====================================================================
create table public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  name                  text not null check (char_length(name) between 1 and 60),
  type                  public.account_type not null,
  initial_balance_cents bigint not null default 0,
  owner_user_id         uuid references public.profiles (id) on delete set null,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, workspace_id)
);
create index accounts_workspace_id_idx on public.accounts (workspace_id);

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  type         public.category_type not null,
  icon         text not null default 'circle',      -- lucide icon name
  color        text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order   int not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index categories_unique_name on public.categories (workspace_id, type, lower(name));

-- =====================================================================
-- Recurring transactions (templates)
-- =====================================================================
create table public.recurring_transactions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type         public.transaction_type not null check (type in ('income', 'expense')),
  account_id   uuid not null,
  category_id  uuid,
  amount_cents bigint not null check (amount_cents > 0),
  description  text check (char_length(description) <= 200),
  paid_by      uuid references public.profiles (id),
  split_type   public.split_type not null default 'none' check (split_type <> 'custom'),
  frequency    public.recurrence_frequency not null,
  start_date   date not null,                       -- anchor day for monthly/yearly recurrences
  next_date    date not null,
  end_date     date,
  active       boolean not null default true,
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (account_id, workspace_id)  references public.accounts (id, workspace_id),
  foreign key (category_id, workspace_id) references public.categories (id, workspace_id),
  check (split_type = 'none' or paid_by is not null),
  check (type = 'expense' or split_type = 'none'),
  check (end_date is null or end_date >= start_date)
);
create index recurring_due_idx on public.recurring_transactions (workspace_id, next_date) where active;

-- =====================================================================
-- Transactions & splits
-- =====================================================================
create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  type          public.transaction_type not null,
  account_id    uuid not null,
  to_account_id uuid,                               -- destination account, transfers only
  category_id   uuid,
  amount_cents  bigint not null check (amount_cents > 0),
  date          date not null,
  description   text check (char_length(description) <= 200),
  paid_by       uuid references public.profiles (id),
  split_type    public.split_type not null default 'none',
  recurring_id  uuid,
  source        public.transaction_source not null default 'manual',
  external_id   text,                               -- OFX FITID / CSV row hash (import phase)
  created_by    uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (account_id, workspace_id)    references public.accounts (id, workspace_id),
  foreign key (to_account_id, workspace_id) references public.accounts (id, workspace_id),
  foreign key (category_id, workspace_id)   references public.categories (id, workspace_id),
  foreign key (recurring_id, workspace_id)  references public.recurring_transactions (id, workspace_id)
    on delete set null (recurring_id),
  constraint transactions_transfer_has_destination check ((type = 'transfer') = (to_account_id is not null)),
  constraint transactions_transfer_distinct_accounts check (to_account_id is distinct from account_id),
  constraint transactions_transfer_no_category check (type <> 'transfer' or category_id is null),
  constraint transactions_only_expenses_split check (type = 'expense' or split_type = 'none'),
  constraint transactions_split_needs_payer check (split_type = 'none' or paid_by is not null)
);
create index transactions_ws_date_idx     on public.transactions (workspace_id, date desc);
create index transactions_ws_category_idx on public.transactions (workspace_id, category_id);
create index transactions_ws_account_idx  on public.transactions (workspace_id, account_id);
create index transactions_to_account_idx  on public.transactions (to_account_id) where to_account_id is not null;
-- A recurrence generates at most one transaction per date (prevents duplicates from concurrent runs)
create unique index transactions_recurring_once
  on public.transactions (recurring_id, date) where recurring_id is not null;
-- Import deduplication
create unique index transactions_import_dedupe
  on public.transactions (account_id, external_id) where external_id is not null;

create table public.transaction_splits (
  transaction_id uuid not null,
  workspace_id   uuid not null,                     -- denormalized for RLS and indexing
  user_id        uuid not null references public.profiles (id),
  amount_cents   bigint not null check (amount_cents >= 0),
  primary key (transaction_id, user_id),
  foreign key (transaction_id, workspace_id)
    references public.transactions (id, workspace_id) on delete cascade
);
create index transaction_splits_ws_user_idx on public.transaction_splits (workspace_id, user_id);

-- =====================================================================
-- Settlements (couple paying each other back; not income/expense)
-- =====================================================================
create table public.settlements (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id),  -- who paid the debt
  to_user_id   uuid not null references public.profiles (id),  -- who received the money
  amount_cents bigint not null check (amount_cents > 0),
  date         date not null,
  note         text check (char_length(note) <= 200),
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);
create index settlements_ws_date_idx on public.settlements (workspace_id, date desc);

-- =====================================================================
-- Goals
-- =====================================================================
create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  target_cents bigint not null check (target_cents > 0),
  deadline     date,
  archived_at  timestamptz,
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, workspace_id)
);
create index goals_workspace_id_idx on public.goals (workspace_id);

create table public.goal_contributions (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null,
  workspace_id uuid not null,
  amount_cents bigint not null check (amount_cents <> 0),  -- negative = withdrawal
  date         date not null,
  note         text check (char_length(note) <= 200),
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  foreign key (goal_id, workspace_id) references public.goals (id, workspace_id) on delete cascade
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id);
create index goal_contributions_ws_idx on public.goal_contributions (workspace_id);
