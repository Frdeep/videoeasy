-- Shorts (long video -> clips) processed by the external engine on Modal.
-- Additive only. One row per user request; clips are imported into the
-- private `media` bucket under <user>/shorts/<id>/clipN.mp4.

create table if not exists platform.shorts_jobs(
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  status text not null default 'uploading'
    check (status in ('uploading','processing','importing','succeeded','failed')),
  source_key text not null,
  source_bytes bigint not null check (source_bytes > 0),
  options jsonb not null,
  engine_state text,
  clips jsonb not null default '[]'::jsonb,
  error_code text,
  free boolean not null default false,
  checked_at timestamptz,
  import_started_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  deleted_at timestamptz
);
create index if not exists shorts_user_idx on platform.shorts_jobs(user_id, created_at desc);
create index if not exists shorts_active_idx on platform.shorts_jobs(status) where status in ('processing','importing');
alter table platform.shorts_jobs enable row level security;
revoke all on platform.shorts_jobs from public, anon, authenticated;
