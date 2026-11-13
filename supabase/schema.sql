
create extension if not exists pgcrypto;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  description text,
  category text,
  image_url text,
  supplier_cost numeric(12,2) default 0,
  selling_price numeric(12,2) default 0,
  stock_qty integer default 0,
  weight_kg numeric(8,3),
  is_active boolean default false,
  supplier text default 'DeoDap',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  product_sku text not null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null,
  customer_name text not null,
  phone text not null,
  email text,
  address text not null,
  pincode text not null,
  payment_method text not null,
  payment_status text default 'pending',
  fulfilment_status text default 'awaiting_review',
  tracking_number text,
  courier text,
  created_at timestamptz default now()
);

create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  imported integer default 0,
  rejected integer default 0,
  created_at timestamptz default now(),
  user_id uuid
);

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.import_logs enable row level security;

create policy "Public can view active products"
on public.products for select
using (is_active = true and stock_qty > 0);

create policy "Admins can view all products"
on public.products for select to authenticated
using (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);

create policy "Admins can manage products"
on public.products for all to authenticated
using (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);

create policy "Admins can view orders"
on public.orders for select to authenticated
using (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);

create policy "Admins can view import logs"
on public.import_logs for select to authenticated
using (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);
