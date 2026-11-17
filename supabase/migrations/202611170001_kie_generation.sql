-- Real provider generation (Kie.ai) — additive, non-destructive.
-- Durable provider tracking on jobs; server-fixed provider configuration on models.

alter table platform.models add column if not exists provider_model text;
alter table platform.models add column if not exists provider_input jsonb not null default '{}'::jsonb;
alter table platform.models add column if not exists provider_cost_usd numeric(10,4);
alter table platform.models add column if not exists description text not null default '';

alter table platform.jobs add column if not exists provider_model text;
alter table platform.jobs add column if not exists provider_input jsonb;
alter table platform.jobs add column if not exists provider_task_id text unique;
alter table platform.jobs add column if not exists provider_state text;
alter table platform.jobs add column if not exists provider_credits numeric(12,2);
alter table platform.jobs add column if not exists attempts integer not null default 0;
alter table platform.jobs add column if not exists submitted_at timestamptz;
alter table platform.jobs add column if not exists checked_at timestamptz;
alter table platform.jobs add column if not exists import_started_at timestamptz;
alter table platform.jobs add column if not exists content_type text;
alter table platform.jobs add column if not exists size_bytes bigint;
alter table platform.jobs add column if not exists error_code text;

create index if not exists jobs_active_idx on platform.jobs(status, checked_at) where status in ('queued','running');

-- First real model: ByteDance Seedance 2 Fast via Kie.ai, text-to-video,
-- 720p, 5 s, audio on. Kie price 17/11/2026: 24.8 credits/s (no video input)
-- = 124 Kie credits = 0.62 USD per video; failed tasks are not charged.
-- 75 VideoEasy credits (100 = 1 EUR budget) keeps a buffer for FX/price drift.
insert into platform.models(id,name,kind,provider,enabled,credits,allowed_plans,updated_at,provider_model,provider_input,provider_cost_usd,description)
values
 ('seedance-2-fast-16x9','Seedance 2 Fast · Paysage 16:9','video','kie',true,75,array['standard','metal','gold'],now(),
  'bytedance/seedance-2-fast','{"resolution":"720p","aspect_ratio":"16:9","duration":5,"generate_audio":true}'::jsonb,0.62,
  'Vidéo 5 s, 720p, avec son'),
 ('seedance-2-fast-9x16','Seedance 2 Fast · Vertical 9:16','video','kie',true,75,array['standard','metal','gold'],now(),
  'bytedance/seedance-2-fast','{"resolution":"720p","aspect_ratio":"9:16","duration":5,"generate_audio":true}'::jsonb,0.62,
  'Vidéo 5 s, 720p, avec son, format réseaux sociaux')
on conflict (id) do nothing;
