-- Apply with a privileged server connection on Supabase. Nothing in this schema is exposed to PostgREST.
create schema if not exists billing;
revoke all on schema billing from public, anon, authenticated;
create table billing.customers (
 user_id uuid primary key references auth.users(id) on delete restrict,
 customer_id text unique,
 email_snapshot text,
 creation_key uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now()
);
create table billing.checkout_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references billing.customers(user_id),
 plan text not null check(plan in ('standard','metal','gold')),
 session_id text unique,
 price_id text not null,
 app_origin text not null,
 expires_at bigint not null,
 created_at timestamptz not null default now(),
 closed boolean not null default false
);
create unique index checkout_one_open on billing.checkout_attempts(user_id) where not closed;
create table billing.subscriptions (
 id text primary key,
 user_id uuid not null references billing.customers(user_id),
 status text not null,
 price_id text,
 plan text,
 period_start bigint,
 period_end bigint,
 cancel_at bigint,
 cancel_at_period_end boolean not null,
 synced_at timestamptz not null default now()
);
create index on billing.subscriptions(user_id);
create table billing.invoices (
 id text primary key,
 user_id uuid not null references billing.customers(user_id),
 subscription_id text,
 status text,
 billing_reason text,
 amount_paid bigint not null,
 currency text not null,
 hosted_invoice_url text,
 synced_at timestamptz not null default now()
);
create table billing.events (
 id text primary key,
 type text not null,
 created bigint not null,
 processed_at timestamptz not null default now()
);
create table billing.credit_grants (
 invoice_id text primary key references billing.invoices(id),
 user_id uuid not null references billing.customers(user_id),
 subscription_id text not null,
 plan text not null check(plan in ('standard','metal','gold')),
 period_start bigint not null,
 period_end bigint not null check(period_end > period_start),
 credits integer not null check(credits > 0),
 remaining integer not null check(remaining >= 0 and remaining <= credits),
 unique(subscription_id, period_start)
);
create index on billing.credit_grants(user_id, period_end);
create table billing.reservations (
 id uuid primary key,
 user_id uuid not null references billing.customers(user_id),
 invoice_id text not null references billing.credit_grants(invoice_id),
 credits integer not null check(credits > 0),
 state text not null default 'reserved' check(state in ('reserved','consumed','released')),
 created_at timestamptz not null default now()
);
create table billing.credit_movements (
 id bigint generated always as identity primary key,
 user_id uuid not null references billing.customers(user_id),
 invoice_id text not null references billing.credit_grants(invoice_id),
 reservation_id uuid references billing.reservations(id),
 kind text not null check(kind in ('grant','expire','reserve','consume','release','release_expired')),
 credits integer not null,
 created_at timestamptz not null default now()
);
-- Defense in depth: clients receive no privileges and RLS has no client policies.
do $$ declare t text; begin
 foreach t in array array['customers','checkout_attempts','subscriptions','invoices','events','credit_grants','reservations','credit_movements'] loop
  execute format('alter table billing.%I enable row level security',t);
  execute format('revoke all on billing.%I from public, anon, authenticated',t);
 end loop;
end $$;
revoke all on all sequences in schema billing from public, anon, authenticated;

-- Generation integration boundary. User and cost MUST be selected by authenticated server code.
-- Locks use exactly the same key as Checkout/webhooks. Existing reservations survive renewal.
create function billing.reserve_credits(p_user uuid, p_job uuid, p_cost integer) returns uuid
language plpgsql security definer set search_path = pg_catalog, billing as $$
declare g billing.credit_grants; r billing.reservations; cap integer; v_epoch bigint := extract(epoch from now());
begin
 if p_cost <= 0 then raise exception 'invalid_cost'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into r from billing.reservations where id=p_job;
 if found then
  if r.user_id<>p_user or r.credits<>p_cost then raise exception 'reservation_mismatch'; end if;
  return r.id;
 end if;
 select cg.* into g from billing.credit_grants cg join billing.subscriptions s on s.id=cg.subscription_id
 where cg.user_id=p_user and s.user_id=p_user and s.status='active' and s.plan=cg.plan
 and s.synced_at>now()-interval '15 minutes'
 and s.period_start=cg.period_start and s.period_end=cg.period_end
 and cg.period_start<=v_epoch and cg.period_end>v_epoch
 and (s.cancel_at is null or s.cancel_at>v_epoch)
 order by cg.period_start desc limit 1 for update of cg;
 if not found then raise exception 'payment_required'; end if;
 if (select count(*) from billing.subscriptions where user_id=p_user and status not in ('canceled','incomplete_expired')) <> 1 then raise exception 'subscription_conflict'; end if;
 cap := case g.plan when 'standard' then 1 when 'metal' then 2 when 'gold' then 3 else 0 end;
 if (select count(*) from billing.reservations where user_id=p_user and state='reserved') >= cap then raise exception 'concurrency_limit'; end if;
 if g.remaining<p_cost then raise exception 'insufficient_credits'; end if;
 update billing.credit_grants set remaining=remaining-p_cost where invoice_id=g.invoice_id;
 insert into billing.reservations(id,user_id,invoice_id,credits) values(p_job,p_user,g.invoice_id,p_cost);
 insert into billing.credit_movements(user_id,invoice_id,reservation_id,kind,credits) values(p_user,g.invoice_id,p_job,'reserve',-p_cost);
 return p_job;
end $$;
create function billing.settle_reservation(p_user uuid, p_job uuid, p_success boolean) returns void
language plpgsql security definer set search_path = pg_catalog, billing as $$
declare r billing.reservations; g billing.credit_grants;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into r from billing.reservations where id=p_job and user_id=p_user for update;
 if not found then raise exception 'reservation_missing'; end if;
 if r.state<>'reserved' then return; end if;
 select * into g from billing.credit_grants where invoice_id=r.invoice_id for update;
 update billing.reservations set state=case when p_success then 'consumed' else 'released' end where id=p_job;
 if not p_success and g.period_end>extract(epoch from now()) then
  update billing.credit_grants set remaining=remaining+r.credits where invoice_id=g.invoice_id;
 end if;
 insert into billing.credit_movements(user_id,invoice_id,reservation_id,kind,credits)
 values(p_user,g.invoice_id,p_job,case when p_success then 'consume' when g.period_end>extract(epoch from now()) then 'release' else 'release_expired' end,
 case when not p_success and g.period_end>extract(epoch from now()) then r.credits else 0 end);
end $$;
revoke all on all functions in schema billing from public, anon, authenticated;
