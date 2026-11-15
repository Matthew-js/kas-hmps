// QA: pengujian logika bisnis store kas (mode memori, tanpa koneksi Supabase).
// Tes bertanda it.fails = celah yang TERDOKUMENTASI (tes lolos selama celahnya masih ada;
// begitu celah diperbaiki, tes ini akan gagal dan harus diubah jadi it() biasa).
import { describe, it, expect, beforeAll, vi } from 'vitest'

let kas
beforeAll(async () => {
  vi.stubEnv('VITE_DATA_SOURCE', 'memory') // paksa memori meski .env.local berisi 'supabase'
  const mod = await import('@/stores/kas')
  await mod.loadKas()
  kas = mod.useKas()
})
const useAugust = () => kas.setPeriod(kas.state.periods.find((p) => p.name === 'Agustus 2026').id)

describe('TC-SALDO: perhitungan saldo', () => {
  it('saldo akhir Agustus = awal + masuk − keluar', async () => {
    await useAugust()
    expect(kas.openingBalance.value).toBe(3000000)
    expect(kas.totalIn.value).toBe(1850000)
    expect(kas.totalOut.value).toBe(620000)
    expect(kas.closingBalance.value).toBe(4230000)
  })
  it('saldo berjalan (ledger) baris terakhir sama dengan saldo akhir', async () => {
    await useAugust()
    expect(kas.ledger.value[0].balance).toBe(kas.closingBalance.value)
  })
})

describe('TC-IURAN: iuran anggota', () => {
  it('tandai lunas menambah pemasukan sebesar nominal iuran', async () => {
    const p = kas.currentPeriod.value
    const before = kas.state.transactions.length
    await kas.markPaid(1)
    expect(kas.isPaid(1)).toBe(true)
    expect(kas.state.transactions.length).toBe(before + 1)
    expect(kas.state.transactions.find((t) => t.duesPaymentId)?.amount).toBe(p.duesAmount)
  })
  it('bayar ganda ditolak', async () => {
    await expect(kas.markPaid(1)).rejects.toThrow(/sudah lunas/i)
  })
  it('anggota nonaktif tidak bisa membayar', async () => {
    await expect(kas.markPaid(5)).rejects.toThrow(/nonaktif/i)
  })
  it('transaksi otomatis iuran tidak bisa diedit/dihapus manual', async () => {
    const tx = kas.state.transactions.find((t) => t.duesPaymentId)
    await expect(kas.removeTransaction(tx.id)).rejects.toThrow(/menu Iuran/i)
    await expect(kas.updateTransaction(tx.id, { ...tx, amount: 1 })).rejects.toThrow(/menu Iuran/i)
  })
  it('batal lunas menghapus transaksi pemasukannya', async () => {
    await kas.unmarkPaid(1)
    expect(kas.isPaid(1)).toBe(false)
    expect(kas.state.transactions.some((t) => t.duesPaymentId)).toBe(false)
  })
})

describe('TC-ANGGOTA', () => {
  it('NRP duplikat ditolak', async () => {
    await expect(kas.saveMember({ name: 'Tes', nrp: '5025221001', year: '2022', active: true })).rejects.toThrow(/NRP sudah terdaftar/i)
  })
  it('anggota baru tersimpan', async () => {
    await kas.saveMember({ name: 'Anggota Uji', nrp: '5025259999', year: '2025', active: true })
    expect(kas.state.members.some((m) => m.nrp === '5025259999')).toBe(true)
  })
  it.fails('[CELAH] NRP bukan 10 digit — validasi hanya di DB/form, bukan di store', async () => {
    // Schema SQL: check (nrp ~ '^[0-9]{10}$'). Di mode memori tidak ada pengecekan ini.
    const r = await kas.saveMember({ name: 'NRP Salah', nrp: 'abc', year: '2025', active: true }).then(() => 'diterima', () => 'ditolak')
    expect(r).toBe('ditolak')
  })
})

describe('TC-PERIODE', () => {
  it('periode tumpang tindih ditolak', async () => {
    await expect(kas.savePeriod({ name: 'Bentrok', startDate: '2026-08-15', endDate: '2026-09-15', openingBalance: 0, duesAmount: 20000 }))
      .rejects.toThrow(/tumpang tindih/i)
  })
  it('nama periode kembar ditolak', async () => {
    await expect(kas.savePeriod({ name: 'Agustus 2026', startDate: '2027-01-01', endDate: '2027-01-31', openingBalance: 0, duesAmount: 20000 }))
      .rejects.toThrow(/sudah dipakai/i)
  })
  it.fails('[CELAH] tanggal akhir < tanggal mulai harus ditolak', async () => {
    const r = await kas.savePeriod({ name: 'Terbalik', startDate: '2027-03-31', endDate: '2027-03-01', openingBalance: 0, duesAmount: 20000 }).then(() => 'diterima', () => 'ditolak')
    expect(r).toBe('ditolak')
  })
  it.fails('[CELAH] nominal iuran 0 / negatif harus ditolak', async () => {
    const r = await kas.savePeriod({ name: 'Nol', startDate: '2027-05-01', endDate: '2027-05-31', openingBalance: 0, duesAmount: 0 }).then(() => 'diterima', () => 'ditolak')
    expect(r).toBe('ditolak')
  })
})

describe('TC-KATEGORI', () => {
  it('kategori "Iuran anggota" dikunci', async () => {
    const c = kas.categories.rows.find((x) => x.name === 'Iuran anggota')
    await expect(kas.saveCategory({ id: c.id, name: 'X' })).rejects.toThrow(/dikunci/i)
    await expect(kas.removeCategory(c.id)).rejects.toThrow(/dikunci/i)
  })
  it('kategori yang dipakai transaksi tidak bisa dihapus', async () => {
    const c = kas.categories.rows.find((x) => x.name === 'Konsumsi')
    await expect(kas.removeCategory(c.id)).rejects.toThrow(/sudah dipakai/i)
  })
  it('kategori duplikat ditolak', async () => {
    await expect(kas.saveCategory({ name: 'ATK', type: 'out' })).rejects.toThrow(/sudah ada/i)
  })
})

describe('TC-TRANSAKSI', () => {
  it('tambah pengeluaran mengurangi saldo', async () => {
    await useAugust()
    const before = kas.closingBalance.value
    await kas.addTransaction({ date: '2026-08-30', type: 'out', category: 'ATK', note: 'Uji', amount: 10000 })
    expect(kas.closingBalance.value).toBe(before - 10000)
  })
  it('deteksi duplikat (nominal & tanggal sama)', () => {
    expect(kas.findDuplicates(10000, '2026-08-30').length).toBe(1)
    expect(kas.findDuplicates(10000, '2026-08-31').length).toBe(0)
  })
  it.fails('[CELAH] transaksi nominal ≤ 0 harus ditolak', async () => {
    const r = await kas.addTransaction({ date: '2026-08-30', type: 'out', category: 'ATK', note: 'Nol', amount: 0 }).then(() => 'diterima', () => 'ditolak')
    expect(r).toBe('ditolak')
  })
  it.fails('[CELAH] transaksi bertanggal di luar semua periode tidak muncul di saldo/laporan mana pun', async () => {
    // Form UI hanya menolak tanggal masa depan, bukan tanggal di luar periode.
    await kas.addTransaction({ date: '2025-01-01', type: 'in', category: 'Sponsorship', note: 'Di luar periode', amount: 500000 })
    const tercakup = kas.state.periods.some((p) => '2025-01-01' >= p.startDate && '2025-01-01' <= p.endDate)
    expect(tercakup).toBe(true)
  })
})
