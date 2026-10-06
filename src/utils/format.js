const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// Tanda minus memakai U+2212 (−) di seluruh aplikasi, bukan tanda hubung.
export const MINUS = '\u2212'
const sign = (n) => (n < 0 ? MINUS : '') // -0 dianggap 0

// Nilai bertanda: saldo, saldo awal/akhir, total. -70000 → "−70.000" / "−Rp 70.000"
export const formatNumber = (n) => `${sign(n)}${Math.abs(n).toLocaleString('id-ID')}`
export const formatRupiah = (n) => `${sign(n)}Rp ${Math.abs(n).toLocaleString('id-ID')}`
// Nilai mutlak tanpa tanda: nominal transaksi yang tandanya sudah ditulis manual ("+ Rp" / "− Rp").
export const formatAmount = (n) => `Rp ${Math.abs(n).toLocaleString('id-ID')}`

export function formatDate(iso, short = false) {
  const [y, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1]}${short ? '' : ` ${y}`}`
}

// Tanggal hari ini (zona waktu lokal, mis. WIB) dalam format YYYY-MM-DD.
// toISOString() memakai UTC sehingga sebelum pukul 07.00 WIB akan menghasilkan tanggal kemarin.
export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
