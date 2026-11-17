-- Montage (editing generated videos) and file transfer links. Additive only.

create table if not exists platform.montages(
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  status text not null default 'processing'
    check (status in ('processing','importing','succeeded','failed')),
  sources jsonb not null,
  options jsonb not null,
  engine_state text,
  object_key text,
  duration numeric(8,2),
  error_code text,
  free boolean not null default false,
  checked_at timestamptz not null default now(),
  import_started_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  deleted_at timestamptz
);
create index if not exists montages_user_idx on platform.montages(user_id, created_at desc);
alter table platform.montages enable row level security;
revoke all on platform.montages from public, anon, authenticated;

-- A transfer is an owner-created, expiring, unguessable link to one file.
create table if not exists platform.transfers(
  token text primary key check (length(token) >= 32),
  user_id uuid not null references auth.users(id),
  object_key text not null,
  file_name text not null,
  content_type text not null default 'video/mp4',
  message text check (message is null or length(message) <= 280),
  expires_at timestamptz not null,
  downloads integer not null default 0,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists transfers_user_idx on platform.transfers(user_id, created_at desc);
alter table platform.transfers enable row level security;
revoke all on platform.transfers from public, anon, authenticated;
