-- ============================================================
--  SAFAR · Supabase schema
--  Run once in the SQL editor of your project.
-- ============================================================

create table if not exists public.reviews (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  card_key    text not null,
  rating      smallint not null check (rating between 1 and 4),
  reviewed_at timestamptz not null,
  source      text not null default 'game',
  device_id   text,
  telemetry   jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists reviews_user_received_idx
  on public.reviews (user_id, received_at);

create index if not exists reviews_user_card_idx
  on public.reviews (user_id, card_key);

create table if not exists public.profile (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
alter table public.profile enable row level security;

drop policy if exists "reviews_owner_all" on public.reviews;
create policy "reviews_owner_all"
  on public.reviews
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profile_owner_all" on public.profile;
create policy "profile_owner_all"
  on public.profile
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
