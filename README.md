# Kas HMPS Informatika: Laporan Pengujian
 
Dokumen ini berisi hasil pengujian aplikasi beserta arti tiap tes. Semua angka di bawah berasal dari hasil menjalankan perintah yang tercantum, pada 24 November 2026.
 
## Cara menjalankan
 
```
npm install
npm test                        # unit test (vitest)
node scripts/smoke-test.mjs     # smoke test aplikasi (build, server, rute)
npm audit                       # pemeriksaan kerentanan dependensi
```
 
Smoke test membutuhkan berkas `.env.local` (tidak ikut git). Isi `VITE_DATA_SOURCE`, `VITE_SUPABASE_URL`, dan `VITE_SUPABASE_ANON_KEY`. Unit test tidak membutuhkannya karena memaksa mode memori.
 
## Ringkasan hasil
 
| Jenis | Berkas | Hasil |
|---|---|---|
| Unit test | `src/utils/format.test.js` | 9 tes lulus |
| Unit test | `src/tests/server-validate.test.js` | 20 tes lulus |
| Unit test | `src/tests/kas.store.test.js` | 19 tes lulus, 4 expected fail |
| Smoke test (aplikasi) | `scripts/smoke-test.mjs` | 23 dari 23 pemeriksaan lulus |
| Audit dependensi | `npm audit` | 0 kerentanan |
 
`npm test`: **3 berkas, 52 tes, 48 lulus, 4 expected fail**, tanpa kegagalan tak terduga.
 
## Cara membaca hasil
 
- **Lulus:** perilaku sesuai yang diharapkan.
- **Expected fail:** tes yang sengaja dibuat untuk mendokumentasikan sebuah celah (`it.fails`). Tes ini dianggap lulus selama celahnya masih ada. Begitu celahnya diperbaiki, tes ini akan gagal dan harus diubah menjadi `it()` biasa.
- **Unit test:** menguji satu fungsi atau satu aturan secara terpisah.
- **Smoke test:** pemeriksaan cepat bahwa aplikasi "hidup" (bisa dibangun, dijalankan, dan dibuka). Smoke test tidak membuktikan bahwa fitur berjalan benar.
## Arti tiap tes
 
### Format angka (`format.test.js`, 9 tes)
 
| Tes | Artinya |
|---|---|
| positif | 70000 tampil `Rp 70.000` |
| negatif memakai minus U+2212 | -70000 tampil `−Rp 70.000` (tanda minus tipografis) |
| nol | 0 tampil `Rp 0` |
| -0 tidak bertanda | Hasil hitungan -0 tidak tampil `−Rp 0` |
| mempertahankan tanda | -70000 tampil `−70.000` tanpa "Rp" |
| positif tanpa tanda | 1500000 tampil `1.500.000` |
| MINUS adalah U+2212 | Karakter minus bukan tanda hubung biasa |
| membuang tanda | Nominal transaksi selalu tampil positif |
| positif (formatAmount) | Nominal positif tetap `Rp 70.000` |
 
### Validasi Scan Nota dan pesan error (`server-validate.test.js`, 20 tes)
 
| Kelompok | Jumlah | Artinya |
|---|---|---|
| validDate | 6 | Tanggal hari ini diterima. Tanggal masa depan, lebih dari 1 tahun lalu, 30 Februari, format `15/11/2026`, dan non-teks ditolak |
| validate | 6 | Data benar lolos dan nama toko dirapikan. Total desimal, negatif, atau terlalu besar menjadi kosong. Kategori di luar daftar dikosongkan. Tingkat keyakinan dijepit 0 sampai 1. Daftar barang dibatasi 50. Input rusak tidak membuat program crash |
| sniffImage | 3 | JPEG dan PNG dikenali. PDF yang diberi ekstensi gambar ditolak |
| friendlyError | 5 | Kode database dan kesalahan umum berubah menjadi kalimat Indonesia yang ramah |
 
### Logika kas (`kas.store.test.js`, 23 tes)
 
| Kelompok | Jumlah | Artinya |
|---|---|---|
| TC-SALDO | 2 | Saldo akhir = awal + masuk − keluar (Agustus 2026: 3.000.000 + 1.850.000 − 620.000 = 4.230.000). Baris terakhir buku kas sama dengan saldo akhir |
| TC-IURAN | 5 | Tandai lunas menambah pemasukan. Bayar ganda dan anggota nonaktif ditolak. Transaksi dari iuran tidak bisa diedit atau dihapus manual. Batal lunas menghapus pemasukannya |
| TC-ANGGOTA | 3 | NRP kembar ditolak. Anggota baru tersimpan. NRP bukan angka (expected fail) |
| TC-PERIODE | 4 | Periode tumpang tindih dan nama kembar ditolak. Tanggal terbalik dan iuran nol (expected fail) |
| TC-KATEGORI | 3 | Kategori "Iuran anggota" dikunci. Kategori yang dipakai transaksi tidak bisa dihapus. Kategori kembar ditolak |
| TC-TRANSAKSI | 6 | Pengeluaran mengurangi saldo. Deteksi duplikat nominal dan tanggal. Tanggal di luar semua periode ditolak saat menambah maupun mengubah tanggal. Batas awal dan akhir periode (1 dan 31 Agustus) diterima. Nominal nol (expected fail) |
 
### Empat expected fail
 
| Celah | Kondisi di aplikasi nyata |
|---|---|
| NRP bukan 10 digit angka | Ditutup oleh validasi form dan constraint database |
| Tanggal selesai lebih awal dari tanggal mulai periode | Ditutup oleh validasi form dan constraint database |
| Nominal iuran 0 atau negatif | Ditutup oleh validasi form dan constraint database |
| Nominal transaksi 0 atau negatif | Ditutup oleh validasi form dan constraint database |
 
Keempatnya hanya terbuka di lapisan store (mode memori), bukan di aplikasi yang memakai form dan database.
 
### Smoke test aplikasi (`scripts/smoke-test.mjs`, 23 pemeriksaan)
 
| Tahap | Pemeriksaan | Jumlah |
|---|---|---|
| 1. Berkas penting | package.json, index.html, main.js, router, store, schema.sql, fungsi scan-nota, dependensi terpasang | 8 |
| 2. Konfigurasi | `.env.local` ada, URL dan kunci Supabase terisi (nilainya tidak dicetak) | 3 |
| 3. Build produksi | `vite build` sukses, `dist/index.html` terbentuk | 2 |
| 4. Server dan halaman | Server preview menyala, GET / = 200, elemen `#app` ada, bundel JS dan CSS termuat, rute `/login`, `/dashboard`, `/transaksi`, `/iuran`, `/laporan` bisa dibuka | 10 |
 
## Perbaikan yang tercakup tes
 
**Transaksi di luar periode.** Sebelumnya, transaksi bertanggal di luar semua periode tersimpan tetapi tidak masuk saldo periode mana pun. Sekarang ditolak di tiga lapis:
 
| Lapis | Mekanisme |
|---|---|
| Form | Pesan di bawah kolom tanggal dan tombol Simpan menolak |
| Store | `addTransaction` menolak; `updateTransaction` menolak bila tanggal diubah ke luar periode |
| Database | Trigger `transactions_guard_period` (`supabase/migrations/004_transaksi_dalam_periode.sql`). Transaksi otomatis dari iuran dikecualikan |
 
Lapis form dan store diuji oleh tes TC-TRANSAKSI. Lapis database belum dijalankan di Supabase, hanya diverifikasi dari membaca SQL.
 
## Pengujian manual di Supabase
 
Tes otomatis berjalan pada data contoh (mode memori). Skenario berikut harus dijalankan manual pada aplikasi yang terhubung ke Supabase. Kolom Status diisi saat pengujian.
 
**Prasyarat:** `schema.sql` dan migrasi 002, 003, 004 sudah dijalankan. Edge Function `scan-nota` sudah di-deploy dan `GEMINI_API_KEY` sudah diset. Ada satu akun bendahara dan satu akun pengurus.
 
| No | Skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| 1 | Login bendahara | Masuk ke dashboard, peran Bendahara | ☐ |
| 2 | Login pengurus | Masuk ke dashboard, peran Pengurus | ☐ |
| 3 | Login dengan kata sandi salah | Pesan "Email atau kata sandi salah." | ☐ |
| 4 | Tambah anggota dengan NRP kembar | Ditolak | ☐ |
| 5 | Buat periode yang tumpang tindih | Ditolak | ☐ |
| 6 | Tandai iuran lunas | Pemasukan "Iuran anggota" muncul otomatis | ☐ |
| 7 | Tandai lunas dua kali | Ditolak | ☐ |
| 8 | Batal lunas | Pemasukannya ikut hilang | ☐ |
| 9 | Catat pengeluaran | Saldo di Dashboard dan Laporan berkurang sesuai | ☐ |
| 10 | Catat transaksi bertanggal di luar semua periode | Ditolak oleh form dan oleh database | ☐ |
| 11 | Scan Nota dengan foto nota yang jelas | Form terisi (nominal, tanggal, kategori), bisa disimpan | ☐ |
| 12 | Scan Nota dengan foto buram | Banner "Scan nota gagal", form tetap bisa diisi manual | ☐ |
| 13 | Setelah menyimpan hasil scan, cek tabel `receipt_scans` | Kolom `transaction_id` terisi | ☐ |
| 14 | Unggah bukti lalu klik "lihat" | Foto terbuka | ☐ |
| 15 | Pengurus mencoba menambah, mengubah, atau menghapus data | Tidak bisa (tombol tidak ada atau ditolak RLS) | ☐ |
| 16 | Pengurus mencoba menulis langsung ke database | Ditolak RLS | ☐ |
| 17 | Pengurus mencoba memakai Scan Nota | Tidak bisa | ☐ |
| 18 | Refresh halaman saat sedang login | Sesi tetap ada | ☐ |
| 19 | Buka `/dashboard` tanpa login | Diarahkan ke halaman login | ☐ |
 
## Celah yang diketahui dan belum ditangani
 
| Celah | Dampak |
|---|---|
| Tandai iuran lunas memakai tanggal hari ini | Jika hari ini di luar periode yang dipilih, pemasukannya tidak masuk saldo periode itu |
| Mengubah rentang atau menghapus periode yang sudah punya transaksi | Transaksinya bisa jatuh di luar semua periode |
 
## Batasan pengujian
 
- Tes otomatis berjalan pada data contoh (mode memori), tidak pada database Supabase yang live. Aturan RLS dan trigger (termasuk migrasi 004) diverifikasi dari membaca SQL, bukan dijalankan oleh tes.
- Scan Nota dengan Gemini yang sebenarnya belum diuji otomatis, hanya validasi hasilnya.
- Status 200 pada rute berarti server mengirim halaman aplikasi, bukan bahwa isinya tampil benar. Pengujian tampilan dan alur dilakukan manual di browser (lihat tabel pengujian manual).
- Sampai kolom Status pada tabel pengujian manual diisi, perilaku aplikasi di Supabase belum terbukti oleh laporan ini.
 
