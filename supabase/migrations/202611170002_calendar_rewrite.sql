-- Personal publishing calendar + script rewrite quota. Additive only.

alter table platform.jobs add column if not exists scheduled_at timestamptz;
alter table platform.jobs add column if not exists schedule_channel text
  check (schedule_channel is null or schedule_channel in ('tiktok','instagram','youtube','facebook','linkedin','autre'));
alter table platform.jobs add column if not exists schedule_note text
  check (schedule_note is null or length(schedule_note) <= 280);
create index if not exists jobs_schedule_idx on platform.jobs(user_id, scheduled_at) where scheduled_at is not null;

-- One row per automatic script rewrite, used to cap daily usage per account.
create table if not exists platform.rewrites(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists rewrites_user_day_idx on platform.rewrites(user_id, created_at desc);
alter table platform.rewrites enable row level security;
revoke all on platform.rewrites from public, anon, authenticated;
