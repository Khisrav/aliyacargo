-- Auto-purge soft-deleted rows older than 14 days (daily at 03:00 UTC)

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.purge_expired_trash()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := timezone('utc', now()) - interval '14 days';
begin
  delete from public.goods
  where deleted_at is not null
    and deleted_at < cutoff;

  delete from public.finance_records
  where deleted_at is not null
    and deleted_at < cutoff;

  delete from public.clients
  where deleted_at is not null
    and deleted_at < cutoff;
end;
$$;

revoke all on function public.purge_expired_trash() from public;
revoke all on function public.purge_expired_trash() from anon, authenticated;
grant execute on function public.purge_expired_trash() to service_role;

-- Avoid duplicate jobs if migration re-runs
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-expired-trash') then
    perform cron.unschedule('purge-expired-trash');
  end if;
  perform cron.schedule('purge-expired-trash', '0 3 * * *', 'select public.purge_expired_trash()');
exception
  when undefined_table then
    -- pg_cron catalog not ready; purge still runs via /api/trash
    null;
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end;
$$;
