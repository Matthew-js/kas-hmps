// QA: validasi hasil AI (Edge Function scan-nota/validate.ts) dan pemetaan pesan error.
import { describe, it, expect } from 'vitest'
import { validate, validDate, sniffImage } from '../../supabase/functions/scan-nota/validate.ts'
import { friendlyError, scanErrorMessage } from '@/lib/errors'

const iso = (offsetDays) => new Date(Date.now() + 7 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10)
const CATS = ['Konsumsi', 'ATK', 'Lainnya']

describe('TC-SCAN validDate', () => {
  it('menerima tanggal hari ini', () => expect(validDate(iso(0))).toBe(iso(0)))
  it('menolak tanggal masa depan', () => expect(validDate(iso(3))).toBeNull())
  it('menolak tanggal > 1 tahun lalu', () => expect(validDate(iso(-400))).toBeNull())
  it('menolak tanggal mustahil (30 Feb)', () => expect(validDate('2026-02-30')).toBeNull())
  it('menolak format DD/MM/YYYY', () => expect(validDate('15/11/2026')).toBeNull())
  it('menolak non-string', () => expect(validDate(20261115)).toBeNull())
})

describe('TC-SCAN validate', () => {
  const base = { date: iso(-1), merchant: ' Toko A ', total: 47500, items: [{ name: 'Roti', qty: 1, price: 12500 }], category: 'Konsumsi', confidence: { date: 0.9, total: 0.9, category: 0.9 } }
  it('data valid lolos & merchant di-trim', () => {
    const v = validate(base, CATS)
    expect(v.merchant).toBe('Toko A'); expect(v.total).toBe(47500)
  })
  it('total desimal / negatif / terlalu besar → null', () => {
    expect(validate({ ...base, total: 100.5 }, CATS).total).toBeNull()
    expect(validate({ ...base, total: -5 }, CATS).total).toBeNull()
    expect(validate({ ...base, total: 2_000_000_000 }, CATS).total).toBeNull()
  })
  it('kategori di luar daftar → null & confidence 0', () => {
    const v = validate({ ...base, category: 'Judi' }, CATS)
    expect(v.category).toBeNull(); expect(v.confidence.category).toBe(0)
  })
  it('confidence dijepit ke 0..1', () => {
    expect(validate({ ...base, confidence: { date: 5, total: -2, category: 0.5 } }, CATS).confidence).toEqual({ date: 1, total: 0, category: 0.5 })
  })
  it('items dibatasi 50 dan item tanpa nama dibuang', () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ name: `Item ${i}`, qty: 1, price: 1000 }))
    expect(validate({ ...base, items: [...items, { name: '  ', qty: 1, price: 1 }] }, CATS).items.length).toBe(50)
  })
  it('input kosong/rusak tidak melempar error', () => {
    expect(() => validate({}, CATS)).not.toThrow()
    expect(() => validate(null, CATS)).not.toThrow()
  })
})

describe('TC-SCAN sniffImage', () => {
  it('JPEG', () => expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg'))
  it('PNG', () => expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png'))
  it('PDF yang diberi ekstensi .jpg ditolak', () => expect(sniffImage(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull())
})

describe('TC-ERROR friendlyError', () => {
  it('kode 23505 → duplikat', () => expect(friendlyError({ code: '23505' })).toMatch(/duplikat/i))
  it('kode 42501 → tidak punya izin', () => expect(friendlyError({ code: '42501' })).toMatch(/izin/i))
  it('kredensial salah → pesan Indonesia', () => expect(friendlyError(new Error('Invalid login credentials'))).toBe('Email atau kata sandi salah.'))
  it('jaringan putus', () => expect(friendlyError(new Error('Failed to fetch'))).toMatch(/koneksi/i))
  it('kode scan tidak dikenal tetap menghasilkan pesan', () => expect(scanErrorMessage('xyz')).toMatch(/Scan nota gagal/))
})
