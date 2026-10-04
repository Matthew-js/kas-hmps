const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const formatNumber = (n) => Math.abs(n).toLocaleString('id-ID')
export const formatRupiah = (n) => `Rp ${formatNumber(n)}`

export function formatDate(iso, short = false) {
  const [y, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1]}${short ? '' : ` ${y}`}`
}
