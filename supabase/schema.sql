-- E-Drug Planet Pharmacy: initial Supabase schema
-- Run in Supabase SQL Editor. Never put the service-role key in browser code.
create extension if not exists pgcrypto;

create or replace function public.is_edp_admin()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text unique not null,
  description text not null default '',
  category text not null check (category in ('OTC Medicines','Vitamins & Supplements','Skincare','Baby Care','First Aid','Medical Devices','Hygiene Products')),
  price_ngn integer check (price_ngn is null or price_ngn >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  requires_prescription boolean not null default false,
  image_url text,
  active boolean not null default false,
  pharmacist_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('EDP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (char_length(customer_phone) between 7 and 30),
  customer_email text,
  fulfillment text not null check (fulfillment in ('pickup_main','pickup_location_road','delivery')),
  delivery_address text,
  payment_method text not null default 'contact_ceo' check (payment_method in ('contact_ceo')),
  payment_status text not null default 'not_paid' check (payment_status in ('not_paid','awaiting_confirmation','paid','refunded')),
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation','confirmed','preparing','ready_for_pickup','out_for_delivery','completed','cancelled')),
  subtotal_ngn integer not null check (subtotal_ngn >= 0),
  delivery_fee_ngn integer not null default 0 check (delivery_fee_ngn >= 0),
  total_ngn integer not null check (total_ngn >= 0),
  customer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  unit_price_ngn integer not null check (unit_price_ngn >= 0),
  quantity integer not null check (quantity between 1 and 50),
  line_total_ngn integer not null check (line_total_ngn >= 0)
);

create table if not exists public.prescription_requests (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  private_object_path text not null,
  status text not null default 'awaiting_pharmacist_review' check (status in ('awaiting_pharmacist_review','reviewing','approved','rejected','more_information_needed')),
  pharmacist_note text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.refill_reminders (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 2 and 120),
  next_reminder_date date not null,
  cadence_days integer check (cadence_days is null or cadence_days between 1 and 365),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.prescription_requests enable row level security;
alter table public.refill_reminders enable row level security;

-- Visitors can only see active, pharmacist-approved products.
drop policy if exists "public can read listed products" on public.products;
create policy "public can read listed products" on public.products for select using (active = true and pharmacist_approved = true);
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products for all to authenticated using (public.is_edp_admin()) with check (public.is_edp_admin());

drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders for select to authenticated using (public.is_edp_admin());
drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders for update to authenticated using (public.is_edp_admin()) with check (public.is_edp_admin());
drop policy if exists "admins read order items" on public.order_items;
create policy "admins read order items" on public.order_items for select to authenticated using (public.is_edp_admin());

drop policy if exists "customers read own prescription requests" on public.prescription_requests;
create policy "customers read own prescription requests" on public.prescription_requests for select to authenticated using (customer_user_id = auth.uid());
drop policy if exists "customers create own prescription requests" on public.prescription_requests;
create policy "customers create own prescription requests" on public.prescription_requests for insert to authenticated with check (customer_user_id = auth.uid());
drop policy if exists "admins manage prescription requests" on public.prescription_requests;
create policy "admins manage prescription requests" on public.prescription_requests for all to authenticated using (public.is_edp_admin()) with check (public.is_edp_admin());

drop policy if exists "customers manage own refill reminders" on public.refill_reminders;
create policy "customers manage own refill reminders" on public.refill_reminders for all to authenticated using (customer_user_id = auth.uid()) with check (customer_user_id = auth.uid());

-- Private bucket: do not make prescriptions public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prescriptions', 'prescriptions', false, 10485760, array['image/jpeg','image/png','application/pdf','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','application/pdf','image/webp'];

drop policy if exists "customers upload to own prescription folder" on storage.objects;
create policy "customers upload to own prescription folder" on storage.objects for insert to authenticated with check (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "customers read own prescription files" on storage.objects;
create policy "customers read own prescription files" on storage.objects for select to authenticated using (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "admins read prescription files" on storage.objects;
create policy "admins read prescription files" on storage.objects for select to authenticated using (bucket_id = 'prescriptions' and public.is_edp_admin());

-- Admin users must be assigned app_metadata.role = "admin" from the Supabase dashboard.
-- Do not allow browser users to grant themselves admin status.
