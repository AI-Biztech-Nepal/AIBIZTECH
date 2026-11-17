// Copies storage files missing in the portal from the legacy projects (public buckets, downloaded by URL).
// Needs PORTAL_SERVICE_KEY in .env.migrate (portal project > Settings > API > service_role). Dry run lists what is missing.
//   node storage.mjs [--commit]
import fs from 'node:fs'
import pg from 'pg'
const env = Object.fromEntries(fs.readFileSync(new URL('../../.env.migrate', import.meta.url), 'utf8')
  .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const commit = process.argv.includes('--commit')
const PORTAL = 'https://feylbretbknouzxxyjwg.supabase.co'
const SRC = [['ATTENDANCE_DB_URL', 'https://whaahjtqmlbwrfppogsw.supabase.co', ['attendance-selfies']],
  ['FINANCE_DB_URL', 'https://boiiqzkkbyzqkqsxuzyp.supabase.co', ['business-assets', 'product-photos']]]
env.PORTAL_SERVICE_KEY ??= process.env.PORTAL_SERVICE_KEY
if (commit && !env.PORTAL_SERVICE_KEY) throw new Error('set PORTAL_SERVICE_KEY (env var or .env.migrate)')
const names = async (url, buckets) => { const c = new pg.Client({ connectionString: url }); await c.connect()
  const r = (await c.query(`select bucket_id b, name, metadata->>'mimetype' m from storage.objects where bucket_id = any($1)`, [buckets])).rows; await c.end(); return r }
let missing = 0, done = 0
for (const [key, host, buckets] of SRC) {
  const have = new Set((await names(env.PORTAL_DB_URL, buckets)).map((r) => `${r.b}/${r.name}`))
  for (const o of await names(env[key], buckets)) {
    if (have.has(`${o.b}/${o.name}`)) continue
    missing++; console.log(`${commit ? 'copy' : 'missing'} ${o.b}/${o.name}`)
    if (!commit) continue
    const get = await fetch(`${host}/storage/v1/object/public/${o.b}/${o.name.split('/').map(encodeURIComponent).join('/')}`)
    if (!get.ok) throw new Error(`download ${o.b}/${o.name}: ${get.status}`)
    const put = await fetch(`${PORTAL}/storage/v1/object/${o.b}/${o.name.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST',
      headers: { Authorization: `Bearer ${env.PORTAL_SERVICE_KEY}`, apikey: env.PORTAL_SERVICE_KEY, 'Content-Type': o.m ?? 'application/octet-stream', 'x-upsert': 'true' }, body: Buffer.from(await get.arrayBuffer()) })
    if (!put.ok) throw new Error(`upload ${o.b}/${o.name}: ${put.status} ${await put.text()}`)
    done++
  }
}
console.log(commit ? `${done} file(s) copied` : `${missing} file(s) missing (dry run)`)
