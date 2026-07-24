-- Soft delete (trash) support for customers + goods
-- Run in Supabase → SQL Editor

alter table public.customers
  add column if not exists deleted_at timestamptz;

alter table public.goods
  add column if not exists deleted_at timestamptz;

-- Allow same phone again after soft-delete: unique only among active customers
alter table public.customers drop constraint if exists customers_phone_key;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'customers_phone_key'
  ) then
    alter table public.customers drop constraint customers_phone_key;
  end if;
exception when undefined_object then
  null;
end $$;

drop index if exists customers_phone_key;
drop index if exists customers_phone_active_unique;

create unique index customers_phone_active_unique
  on public.customers (phone)
  where deleted_at is null;

create index if not exists idx_customers_deleted_at on public.customers (deleted_at);
create index if not exists idx_goods_deleted_at on public.goods (deleted_at);
