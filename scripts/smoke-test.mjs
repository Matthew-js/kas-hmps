// SMOKE TEST: cek cepat "apakah aplikasi hidup?" (bukan menguji logika detail).
// Cara pakai (dari folder proyek):  node scripts/smoke-test.mjs
// Urutan: berkas penting ada -> build produksi sukses -> server preview jalan -> halaman & aset bisa dibuka.
import { existsSync, readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VITE = resolve(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
const PORT = 4173
const BASE = `http://127.0.0.1:${PORT}`
let failed = 0
const ok = (name, detail = '') => console.log(`  [LULUS]  ${name}${detail ? ' - ' + detail : ''}`)
const bad = (name, detail = '') => { failed++; console.log(`  [GAGAL]  ${name}${detail ? ' - ' + detail : ''}`) }
const warn = (name, detail = '') => console.log(`  [CATATAN] ${name}${detail ? ' - ' + detail : ''}`)
const check = (cond, name, detail) => (cond ? ok(name, detail) : bad(name, detail))

console.log('\nSMOKE TEST - Kas HMPS\n')

// 1. Berkas penting
console.log('1) Berkas penting')
for (const f of ['package.json', 'index.html', 'src/main.js', 'src/router/index.js', 'src/stores/kas.js',
  'supabase/schema.sql', 'supabase/functions/scan-nota/index.ts']) {
  check(existsSync(resolve(ROOT, f)), f)
}
check(existsSync(VITE), 'dependensi terpasang (node_modules/vite)', existsSync(VITE) ? '' : 'jalankan: npm install')
if (!existsSync(VITE)) { console.log('\nBerhenti: jalankan "npm install" dulu.\n'); process.exit(1) }

// 2. Konfigurasi lingkungan (tanpa mencetak nilai rahasia)
console.log('\n2) Konfigurasi')
const envPath = resolve(ROOT, '.env.local')
if (existsSync(envPath)) {
  const env = readFileSync(envPath, 'utf8')
  const src = /VITE_DATA_SOURCE\s*=\s*(\w+)/.exec(env)?.[1] ?? '(tidak diatur, default memori)'
  ok('.env.local ditemukan', `VITE_DATA_SOURCE = ${src}`)
  if (src === 'supabase') {
    check(/VITE_SUPABASE_URL\s*=\s*https?:\/\/\S+/.test(env), 'VITE_SUPABASE_URL terisi')
    check(/VITE_SUPABASE_(ANON|PUBLISHABLE)_KEY\s*=\s*\S+/.test(env) || /VITE_SUPABASE_\w*KEY\s*=\s*\S+/.test(env), 'kunci Supabase terisi')
  }
} else warn('.env.local tidak ada', 'aplikasi memakai mode bawaan; bagus untuk repo (jangan di-commit)')

// 3. Build produksi
console.log('\n3) Build produksi')
const build = spawnSync(process.execPath, [VITE, 'build'], { cwd: ROOT, encoding: 'utf8' })
check(build.status === 0, 'vite build sukses', build.status === 0 ? '' : (build.stderr || build.stdout).split('\n').slice(-5).join(' | '))
const distHtml = resolve(ROOT, 'dist', 'index.html')
check(existsSync(distHtml), 'dist/index.html terbentuk')

// 4. Server preview + halaman
console.log('\n4) Server & halaman')
let server
const stop = () => { try { server?.kill() } catch {} }
process.on('exit', stop)
try {
  if (build.status !== 0 || !existsSync(distHtml)) throw new Error('lewati: build gagal')
  server = spawn(process.execPath, [VITE, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
  let up = false
  for (let i = 0; i < 40 && !up; i++) {
    try { up = (await fetch(BASE + '/')).ok } catch { await new Promise((r) => setTimeout(r, 500)) }
  }
  check(up, `server preview menyala di ${BASE}`)
  if (up) {
    const res = await fetch(BASE + '/')
    const html = await res.text()
    check(res.status === 200, 'GET / = 200', `status ${res.status}`)
    check(/id=["']app["']/.test(html), 'elemen root #app ada')
    const js = /<script[^>]+src=["']([^"']+\.js)["']/.exec(html)?.[1]
    const css = /<link[^>]+href=["']([^"']+\.css)["']/.exec(html)?.[1]
    if (js) { const r = await fetch(BASE + js); const b = await r.arrayBuffer(); check(r.status === 200 && b.byteLength > 10000, 'bundel JavaScript termuat', `${(b.byteLength / 1024).toFixed(0)} kB`) } else bad('tag script JS ditemukan')
    if (css) { const r = await fetch(BASE + css); check(r.status === 200, 'berkas CSS termuat') } else warn('tag CSS tidak ditemukan')
    for (const route of ['/login', '/dashboard', '/transaksi', '/iuran', '/laporan']) {
      const r = await fetch(BASE + route)
      check(r.status === 200, `rute ${route} bisa dibuka (SPA)`, `status ${r.status}`)
    }
  }
} catch (e) {
  bad('tahap server', e.message)
} finally {
  stop()
}

console.log(failed === 0 ? '\nHASIL: SEMUA LULUS - aplikasi hidup.\n' : `\nHASIL: ${failed} pemeriksaan GAGAL.\n`)
process.exit(failed === 0 ? 0 : 1)
