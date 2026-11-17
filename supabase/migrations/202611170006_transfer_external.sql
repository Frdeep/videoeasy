-- Transfers can be delivered through a temporary external host (Litterbox,
-- ≤ 72 h). Additive only.
alter table platform.transfers add column if not exists external_url text
  check (external_url is null or external_url like 'https://litter.catbox.moe/%');
