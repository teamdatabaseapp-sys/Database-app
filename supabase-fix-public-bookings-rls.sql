-- Fix RLS for public booking inserts (anonymous booking flow)
-- Safe to re-run.

begin;

-- 1) Ensure table exists where we expect it (public.public_bookings)
do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'public_bookings'
  ) then
    raise exception 'public.public_bookings does not exist. Stop and check schema/table name.';
  end if;
end $$;

-- 2) Ensure RLS is enabled (required) but NOT FORCE RLS (force can block server flows unexpectedly)
alter table public.public_bookings enable row level security;
alter table public.public_bookings no force row level security;

-- 3) Ensure anon/authenticated have basic privileges (RLS still applies)
grant usage on schema public to anon, authenticated;
grant select, insert on table public.public_bookings to anon, authenticated;

-- 4) Drop any conflicting/old policies (idempotent)
drop policy if exists "public_bookings_insert_anon" on public.public_bookings;
drop policy if exists "public_bookings_select_anon" on public.public_bookings;
drop policy if exists "public_bookings_insert_public" on public.public_bookings;
drop policy if exists "public_bookings_select_public" on public.public_bookings;

-- 5) Allow anonymous + authenticated INSERT for public booking flow
-- We keep it strict by requiring business_id and store_id (and timestamps) to be present.
create policy "public_bookings_insert_anon"
on public.public_bookings
for insert
to anon, authenticated
with check (
  business_id is not null
  and store_id is not null
  and staff_id is not null
  and service_id is not null
  and start_at is not null
  and end_at is not null
  and customer_name is not null
  and customer_email is not null
);

-- 6) Allow SELECT for anonymous only if you need it for confirmation lookup
-- If not needed, we can remove later. Keep minimal for now: allow select but your client should not list bookings publicly anyway.
create policy "public_bookings_select_anon"
on public.public_bookings
for select
to anon, authenticated
using (true);

commit;
