// Ubah error teknis (Supabase/PostgreSQL/jaringan) menjadi pesan yang bisa dibaca pengguna.
const BY_CODE = {
  23505: 'Data sudah ada (duplikat).',
  23503: 'Data masih dipakai oleh data lain sehingga tidak bisa dihapus.',
  23514: 'Data tidak memenuhi aturan validasi.',
  42501: 'Anda tidak memiliki izin untuk aksi ini.',
}

export function friendlyError(e, overrides = {}) {
  const code = e?.code
  if (code && overrides[code]) return overrides[code]
  if (code === 'P0001') return e.message // pesan dari trigger (mis. anggota nonaktif)
  if (code && BY_CODE[code]) return BY_CODE[code]
  const msg = String(e?.message || e || '')
  if (/row-level security/i.test(msg)) return BY_CODE[42501]
  if (/invalid login credentials/i.test(msg)) return 'Email atau kata sandi salah.'
  if (/failed to fetch|network/i.test(msg)) return 'Gagal terhubung ke server. Periksa koneksi internet.'
  if (/payload too large|exceeded the maximum/i.test(msg)) return 'Ukuran file maksimal 2MB.'
  return msg || 'Terjadi kesalahan. Coba lagi.'
}

// Lempar ulang sebagai Error dengan pesan ramah, tetap menyimpan error asli.
export function rethrow(e, overrides) {
  const err = new Error(friendlyError(e, overrides))
  err.cause = e
  throw err
}
