// Kompres foto di browser sebelum diunggah (hemat kuota Storage & biaya AI).
// Sisi terpanjang 1568px: model vision mengecilkan gambar yang lebih besar, jadi piksel ekstra hanya membuang token.
const MAX_SIDE = 1568
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

const toBlob = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

/** Ubah JPG/PNG menjadi JPEG ≤ 2MB. Melempar Error berpesan Indonesia jika gagal. */
export async function compressImage(file) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Format foto harus JPG atau PNG.')
  let bitmap
  try {
    // imageOrientation: 'from-image' memutar foto sesuai EXIF (foto HP sering tersimpan miring).
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Foto tidak dapat dibuka. Coba foto lain.')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // PNG transparan → latar putih, bukan hitam
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  for (const quality of [0.85, 0.75, 0.65, 0.5]) {
    const blob = await toBlob(canvas, quality)
    if (blob && blob.size <= MAX_UPLOAD_BYTES) {
      const name = file.name.replace(/\.(jpe?g|png)$/i, '') || 'nota'
      return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
    }
  }
  throw new Error('Ukuran foto masih di atas 2MB setelah dikompres.')
}
