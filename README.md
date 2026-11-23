# Kas HMPS Informatika: Hasil Pengujian

Dokumen ini berisi hasil pengujian otomatis aplikasi beserta arti tiap tes.

## Cara menjalankan

```
npm install
npm test                        # unit test + smoke test data
node scripts/smoke-test.mjs     # smoke test aplikasi (build, server, rute)
```

## Ringkasan hasil

| Jenis | Berkas | Hasil |
|---|---|---|
| Unit test | `src/utils/format.test.js` | 9 tes lulus |
| Unit test | `src/tests/server-validate.test.js` | 20 tes lulus |
| Unit test | `src/tests/kas.store.test.js` | 16 tes lulus, 5 expected fail |
| Smoke test (data) | `src/tests/smoke.test.js` | 4 tes lulus |
| Smoke test (aplikasi) | `scripts/smoke-test.mjs` | 23 dari 23 pemeriksaan lulus |

`npm test`: **4 berkas, 54 tes, 49 lulus, 5 expected fail**, tanpa kegagalan tak terduga.
`npm audit`: 0 vulnerabilities.

## Cara membaca hasil

- **Lulus (✓):** perilaku sesuai yang diharapkan.
- **Expected fail:** tes yang sengaja dibuat untuk mendokumentasikan sebuah celah (`it.fails`). Tes ini dianggap lulus selama celahnya masih ada. Begitu celahnya diperbaiki, tes ini akan gagal dan harus diubah menjadi `it()` biasa.
- **Unit test:** menguji satu fungsi atau satu aturan secara terpisah.
- **Smoke test:** pemeriksaan cepat bahwa aplikasi "hidup" (bisa dibangun, dijalankan, dan dibuka).

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

### Logika kas (`kas.store.test.js`, 21 tes)

| Kelompok | Jumlah | Artinya |
|---|---|---|
| TC-SALDO | 2 | Saldo akhir = awal + masuk − keluar (Agustus 2026: 3.000.000 + 1.850.000 − 620.000 = 4.230.000). Baris terakhir buku kas sama dengan saldo akhir |
| TC-IURAN | 5 | Tandai lunas menambah pemasukan. Bayar ganda dan anggota nonaktif ditolak. Transaksi dari iuran tidak bisa diedit atau dihapus manual. Batal lunas menghapus pemasukannya |
| TC-ANGGOTA | 3 | NRP kembar ditolak. Anggota baru tersimpan. NRP bukan angka (expected fail) |
| TC-PERIODE | 4 | Periode tumpang tindih dan nama kembar ditolak. Tanggal terbalik dan iuran nol (expected fail) |
| TC-KATEGORI | 3 | Kategori "Iuran anggota" dikunci. Kategori yang dipakai transaksi tidak bisa dihapus. Kategori kembar ditolak |
| TC-TRANSAKSI | 4 | Pengeluaran mengurangi saldo. Deteksi duplikat nominal dan tanggal. Nominal nol dan tanggal di luar periode (expected fail) |

### Lima expected fail

| Celah | Kondisi di aplikasi nyata |
|---|---|
| NRP bukan 10 digit angka | Ditutup oleh validasi form dan constraint database |
| Tanggal selesai lebih awal dari tanggal mulai periode | Ditutup oleh validasi form dan constraint database |
| Nominal iuran 0 atau negatif | Ditutup oleh validasi form dan constraint database |
| Nominal transaksi 0 atau negatif | Ditutup oleh validasi form dan constraint database |
| Transaksi bertanggal di luar semua periode | Celah nyata: uang tercatat tetapi tidak masuk saldo periode mana pun |

### Smoke test data (`smoke.test.js`, 4 tes)

Data anggota, periode, kategori, dan transaksi termuat. Ada periode aktif. Angka saldo valid. Saldo akhir = awal + masuk − keluar.

### Smoke test aplikasi (`scripts/smoke-test.mjs`, 23 pemeriksaan)

| Tahap | Pemeriksaan | Jumlah |
|---|---|---|
| 1. Berkas penting | package.json, index.html, main.js, router, store, schema.sql, fungsi scan-nota, dependensi terpasang | 8 |
| 2. Konfigurasi | `.env.local` ada, URL dan kunci Supabase terisi (nilainya tidak dicetak) | 3 |
| 3. Build produksi | `vite build` sukses, `dist/index.html` terbentuk | 2 |
| 4. Server dan halaman | Server preview menyala, GET / = 200, elemen `#app` ada, bundel JS dan CSS termuat, rute `/login`, `/dashboard`, `/transaksi`, `/iuran`, `/laporan` bisa dibuka | 10 |

## Batasan pengujian

- Tes berjalan pada data contoh (mode memori), tidak pada database Supabase yang live. Aturan RLS dan trigger diverifikasi dari membaca SQL, bukan dijalankan.
- Scan Nota dengan Gemini yang sebenarnya belum diuji otomatis, hanya validasi hasilnya.
- Status 200 pada rute berarti server mengirim halaman aplikasi, bukan bahwa isinya tampil benar. Pengujian tampilan dan alur dilakukan manual di browser.
