const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const formatNumber = (n) => Math.abs(n).toLocaleString('id-ID')
export const formatRupiah = (n) => `Rp ${formatNumber(n)}`

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
