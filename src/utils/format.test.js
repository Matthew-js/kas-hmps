import { describe, it, expect } from 'vitest'
import { formatNumber, formatRupiah, formatAmount, MINUS } from './format'

describe('formatRupiah (nilai bertanda: saldo & total)', () => {
  it('positif', () => expect(formatRupiah(70000)).toBe('Rp 70.000'))
  it('negatif memakai minus U+2212 di depan Rp', () => expect(formatRupiah(-70000)).toBe('−Rp 70.000'))
  it('nol', () => expect(formatRupiah(0)).toBe('Rp 0'))
  it('-0 tidak bertanda', () => expect(formatRupiah(-0)).toBe('Rp 0'))
})

describe('formatNumber', () => {
  it('mempertahankan tanda', () => expect(formatNumber(-70000)).toBe('−70.000'))
  it('positif tanpa tanda', () => expect(formatNumber(1500000)).toBe('1.500.000'))
  it('MINUS adalah U+2212, bukan tanda hubung', () => expect(MINUS).toBe('−'))
})

describe('formatAmount (nominal transaksi, nilai mutlak)', () => {
  it('membuang tanda', () => expect(formatAmount(-70000)).toBe('Rp 70.000'))
  it('positif', () => expect(formatAmount(70000)).toBe('Rp 70.000'))
})
