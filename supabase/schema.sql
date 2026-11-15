-- =====================================================================
--  Skema basis data Sistem Informasi Kas HMPS Informatika (Supabase)
--  Jalankan SEKALI di Supabase Dashboard → SQL Editor → New query → Run.
--  Aman dijalankan ulang di project kosong; JANGAN dijalankan ulang
--  di project yang sudah berisi data tanpa membaca bagian DROP di bawah.
-- =====================================================================

-- ---------- 1. Profil & peran pengguna ------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  role       text not null default 'pengurus' check (role in ('bendahara', 'pengurus')),
  created_at timestamptz not null default now()
);

-- Setiap user baru (dibuat lewat Dashboard → Authentication) otomatis
-- mendapat baris profil dengan peran 'pengurus'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper untuk policy: apakah user yang login adalah bendahara?
create or replace function public.is_bendahara()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'bendahara');
$$;

-- ---------- 2. Data master ------------------------------------------
create table if not exists public.members (
  id         bigint generated always as identity primary key,
  name       text not null check (length(trim(name)) > 0),
  nrp        text not null unique check (nrp ~ '^[0-9]{10}$'),
  year       smallint not null check (year between 2000 and 2100),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id   bigint generated always as identity primary key,
  name text not null,
  type text not null check (type in ('in', 'out')),
  unique (name, type)
);

create table if not exists public.periods (
  id              bigint generated always as identity primary key,
  name            text not null unique,                 -- mis. 'Agustus 2026'
  start_date      date not null,
  end_date        date not null,
  opening_balance numeric(14, 0) not null default 0,    -- saldo awal periode
  dues_amount     numeric(14, 0) not null check (dues_amount > 0),
  check (end_date >= start_date)
);

-- ---------- 3. Transaksi & iuran ------------------------------------
create table if not exists public.dues_payments (
  id         bigint generated always as identity primary key,
  member_id  bigint not null references public.members (id) on delete restrict,
  period_id  bigint not null references public.periods (id) on delete restrict,
  amount     numeric(14, 0) not null check (amount > 0),
  paid_at    date not null default current_date,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  unique (member_id, period_id)                         -- cegah bayar ganda
);

create table if not exists public.transactions (
  id              bigint generated always as identity primary key,
  date            date not null default current_date,
  type            text not null check (type in ('in', 'out')),
  category        text not null,
  note            text not null check (length(trim(note)) > 0),
  amount          numeric(14, 0) not null check (amount > 0),  -- rupiah bulat, bukan float
  proof_path      text,                                        -- path di bucket 'bukti'
  dues_payment_id bigint unique references public.dues_payments (id) on delete cascade,
  created_by      uuid default auth.uid() references auth.users (id),
  created_at      timestamptz not null default now(),
  foreign key (category, type) references public.categories (name, type) on update cascade
);
create index if not exists transactions_date_idx on public.transactions (date desc, id desc);

-- ---------- 4. Audit log --------------------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  bigint,
  action     text not null,           -- INSERT / UPDATE / DELETE
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);

create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, record_id, action, old_data, new_data)
  values (
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id')::bigint, (to_jsonb(old) ->> 'id')::bigint),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

drop trigger if exists audit_transactions on public.transactions;
create trigger audit_transactions after insert or update or delete on public.transactions
  for each row execute function public.write_audit();
drop trigger if exists audit_members on public.members;
create trigger audit_members after insert or update or delete on public.members
  for each row execute function public.write_audit();
drop trigger if exists audit_dues on public.dues_payments;
create trigger audit_dues after insert or update or delete on public.dues_payments
  for each row execute function public.write_audit();

-- ---------- 5. Aturan bisnis iuran (dijamin di server) ---------------
-- a) Nominal diambil dari periode bila tidak dikirim; anggota nonaktif ditolak.
create or replace function public.before_dues_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.members where id = new.member_id and active) then
    raise exception 'Anggota nonaktif tidak dapat membayar iuran' using errcode = 'P0001';
  end if;
  if new.amount is null then
    select dues_amount into new.amount from public.periods where id = new.period_id;
  end if;
  return new;
end $$;

drop trigger if exists dues_before_insert on public.dues_payments;
create trigger dues_before_insert before insert on public.dues_payments
  for each row execute function public.before_dues_payment();

-- b) Setiap pembayaran iuran otomatis tercatat sebagai PEMASUKAN di buku kas.
--    (Memperbaiki bug: sebelumnya tandai lunas tidak menambah saldo.)
create or replace function public.after_dues_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_member text;
  v_period text;
begin
  select name into v_member from public.members where id = new.member_id;
  select name into v_period from public.periods where id = new.period_id;
  insert into public.transactions (date, type, category, note, amount, dues_payment_id, created_by)
  values (new.paid_at, 'in', 'Iuran anggota', 'Iuran ' || v_member || ' – ' || v_period,
          new.amount, new.id, new.created_by);
  return new;
end $$;

drop trigger if exists dues_after_insert on public.dues_payments;
create trigger dues_after_insert after insert on public.dues_payments
  for each row execute function public.after_dues_payment();

-- ---------- 6. Row Level Security -----------------------------------
alter table public.profiles      enable row level security;
alter table public.members       enable row level security;
alter table public.categories    enable row level security;
alter table public.periods       enable row level security;
alter table public.transactions  enable row level security;
alter table public.dues_payments enable row level security;
alter table public.audit_log     enable row level security;

-- Semua user yang login boleh MEMBACA data kas (Bendahara & Pengurus).
drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['members', 'categories', 'periods', 'transactions', 'dues_payments'] loop
    execute format('drop policy if exists "read %1$s" on public.%1$I', t);
    execute format('create policy "read %1$s" on public.%1$I for select to authenticated using (true)', t);
    -- Hanya bendahara yang boleh MENULIS (insert/update/delete).
    execute format('drop policy if exists "write %1$s" on public.%1$I', t);
    execute format('create policy "write %1$s" on public.%1$I for all to authenticated using (public.is_bendahara()) with check (public.is_bendahara())', t);
  end loop;
end $$;

-- Audit log hanya bisa dibaca bendahara; ditulis lewat trigger saja.
drop policy if exists "read audit" on public.audit_log;
create policy "read audit" on public.audit_log for select to authenticated using (public.is_bendahara());

-- ---------- 7. Storage untuk bukti transaksi ------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bukti', 'bukti', false, 2097152, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "bukti read" on storage.objects;
create policy "bukti read" on storage.objects for select to authenticated
  using (bucket_id = 'bukti');
drop policy if exists "bukti write" on storage.objects;
create policy "bukti write" on storage.objects for insert to authenticated
  with check (bucket_id = 'bukti' and public.is_bendahara());
drop policy if exists "bukti delete" on storage.objects;
create policy "bukti delete" on storage.objects for delete to authenticated
  using (bucket_id = 'bukti' and public.is_bendahara());

-- ---------- 8. Data awal --------------------------------------------
insert into public.categories (name, type) values
  ('Iuran anggota', 'in'), ('Iuran mingguan', 'in'), ('Sponsorship', 'in'), ('Lainnya', 'in'),
  ('Konsumsi', 'out'), ('ATK', 'out'), ('Lainnya', 'out')
on conflict (name, type) do nothing;

-- Periode bulan berjalan (nama otomatis, mis. 'Oktober 2026').
-- Setelah menjalankan skrip, UBAH opening_balance menjadi saldo kas nyata saat ini
-- (Table Editor → periods) dan dues_amount sesuai nominal iuran HMPS.
insert into public.periods (name, start_date, end_date, opening_balance, dues_amount)
select (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'])[extract(month from d)::int]
         || ' ' || extract(year from d)::int,
       d, (d + interval '1 month - 1 day')::date, 0, 20000
from (select date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date as d) x
on conflict (name) do nothing;
