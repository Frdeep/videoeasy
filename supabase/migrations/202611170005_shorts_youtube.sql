-- Shorts from a YouTube link: the video is fetched by a relay (Francis's
-- Chromebook, home connection) that polls VideoEasy, then processed as usual.
-- Additive: new 'fetching' status and two columns.

alter table platform.shorts_jobs drop constraint if exists shorts_jobs_status_check;
alter table platform.shorts_jobs add constraint shorts_jobs_status_check
  check (status in ('fetching','uploading','processing','importing','succeeded','failed'));
alter table platform.shorts_jobs add column if not exists source_url text
  check (source_url is null or length(source_url) <= 300);
alter table platform.shorts_jobs add column if not exists relay_claimed_at timestamptz;
create index if not exists shorts_fetching_idx on platform.shorts_jobs(created_at) where status = 'fetching';
