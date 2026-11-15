-- =====================================================================
--  Migrasi 003 — Scan Nota
--  Jalankan di Supabase Dashboard → SQL Editor setelah 002_crud_lengkap.sql.
--  Aman dijalankan ulang.
-- =====================================================================

-- Setiap pemanggilan Edge Function `scan-nota` dicatat di sini (berhasil maupun gagal).
-- transaction_id diisi saat bendahara menyimpan transaksi dari hasil scan, sehingga
-- akurasi scan bisa diukur: bandingkan raw_result->'validated' dengan baris transaksinya.
create table if not exists public.receipt_scans (
  id             bigint generated always as identity primary key,
  created_by     uuid not null default auth.uid() references auth.users (id),
  proof_path     text not null,                -- path di bucket 'bukti'
  status         text not null default 'ok' check (status in ('ok', 'failed')),
  raw_result     jsonb,                        -- { model, raw, validated, error, usage }
  transaction_id bigint references public.transactions (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists receipt_scans_created_idx on public.receipt_scans (created_at desc);

-- Hanya bendahara yang boleh membaca & menulis (pengurus tidak punya policy apa pun).
alter table public.receipt_scans enable row level security;

drop policy if exists "read receipt_scans" on public.receipt_scans;
create policy "read receipt_scans" on public.receipt_scans for select to authenticated
  using (public.is_bendahara());
drop policy if exists "insert receipt_scans" on public.receipt_scans;
create policy "insert receipt_scans" on public.receipt_scans for insert to authenticated
  with check (public.is_bendahara() and created_by = auth.uid());
drop policy if exists "update receipt_scans" on public.receipt_scans;
create policy "update receipt_scans" on public.receipt_scans for update to authenticated
  using (public.is_bendahara()) with check (public.is_bendahara());
-- Tidak ada policy DELETE: riwayat scan dipertahankan untuk pengukuran akurasi.

-- Contoh query akurasi (jalankan manual di SQL Editor):
--   select s.id,
--          (s.raw_result->'validated'->>'total')::bigint = t.amount       as total_benar,
--          (s.raw_result->'validated'->>'date')::date    = t.date         as tanggal_benar,
--          s.raw_result->'validated'->>'category'        = t.category     as kategori_benar
--   from receipt_scans s join transactions t on t.id = s.transaction_id;
