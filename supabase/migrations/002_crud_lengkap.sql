-- =====================================================================
--  Migrasi 002 — CRUD lengkap (transaksi, periode, kategori)
--  Jalankan di Supabase Dashboard → SQL Editor setelah schema.sql.
--  Aman dijalankan ulang. RLS tidak diubah.
-- =====================================================================

-- ---------- 1. Transaksi otomatis dari iuran dikunci ----------------
-- Transaksi dengan dues_payment_id hanya boleh berubah lewat menu Iuran.
-- Pengecualian: DELETE karena cascade saat iuran dibatalkan (baris
-- dues_payments induk sudah terhapus) dan UPDATE karena cascade FK.
create or replace function public.guard_dues_transaction()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.dues_payment_id is null then
    if new.dues_payment_id is not null and pg_trigger_depth() = 1 then
      raise exception 'Transaksi manual tidak boleh ditautkan ke iuran.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.dues_payment_id is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.dues_payments where id = old.dues_payment_id) then
    return old;
  end if;
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    return new;
  end if;
  raise exception 'Transaksi ini dibuat otomatis dari iuran. Ubah atau batalkan lewat menu Iuran.' using errcode = 'P0001';
end $$;

drop trigger if exists transactions_guard_dues on public.transactions;
create trigger transactions_guard_dues before update or delete on public.transactions
  for each row execute function public.guard_dues_transaction();

-- ---------- 2. Periode tidak boleh tumpang tindih -------------------
-- GiST untuk tipe range sudah bawaan PostgreSQL, jadi btree_gist tidak diperlukan.
-- Jika langkah ini gagal, berarti data periode yang ada sudah tumpang tindih:
-- perbaiki dulu tanggalnya di Table Editor → periods, lalu jalankan ulang.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'periods_no_overlap') then
    alter table public.periods add constraint periods_no_overlap
      exclude using gist (daterange(start_date, end_date, '[]') with &&);
  end if;
end $$;

-- Hapus periode yang sudah punya pembayaran iuran ditolak oleh FK
-- dues_payments.period_id (on delete restrict) yang sudah ada di schema.sql.

-- ---------- 3. Kategori ---------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_name_not_blank') then
    alter table public.categories add constraint categories_name_not_blank check (length(trim(name)) > 0);
  end if;
end $$;

-- 'Iuran anggota' dipakai trigger after_dues_payment, jadi tidak boleh diubah/dihapus.
-- Hapus kategori yang dipakai transaksi ditolak oleh FK transactions(category, type).
create or replace function public.guard_locked_category()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.name = 'Iuran anggota' and old.type = 'in' then
    raise exception 'Kategori "Iuran anggota" dikunci karena dipakai otomatis oleh menu Iuran.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists categories_guard_locked on public.categories;
create trigger categories_guard_locked before update or delete on public.categories
  for each row execute function public.guard_locked_category();

-- ---------- 4. Audit periode & kategori -----------------------------
drop trigger if exists audit_periods on public.periods;
create trigger audit_periods after insert or update or delete on public.periods
  for each row execute function public.write_audit();
drop trigger if exists audit_categories on public.categories;
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.write_audit();
