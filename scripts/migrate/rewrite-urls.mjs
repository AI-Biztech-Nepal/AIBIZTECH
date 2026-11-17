// After a copy, point every stored legacy-project URL (storage links) at the portal project.
// Dry run by default (counts only); --commit applies. Re-run after every copy: copy.mjs brings the old hosts back.
import fs from 'node:fs'
import pg from 'pg'
const env = Object.fromEntries(fs.readFileSync(new URL('../../.env.migrate', import.meta.url), 'utf8')
  .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const commit = process.argv.includes('--commit')
const PORTAL = 'https://feylbretbknouzxxyjwg.supabase.co'
const OLD = ['https://whaahjtqmlbwrfppogsw.supabase.co', 'https://boiiqzkkbyzqkqsxuzyp.supabase.co']
const c = new pg.Client({ connectionString: env.PORTAL_DB_URL }); await c.connect()
await c.query('begin')
const cols = (await c.query(`select table_schema s, table_name t, column_name c, data_type d from information_schema.columns
  where table_schema in ('finance','attendance') and data_type in ('text','character varying','jsonb')
  and (table_schema, table_name) in (select table_schema, table_name from information_schema.tables where table_type='BASE TABLE')`)).rows
let total = 0
for (const { s, t, c: col, d } of cols) {
  const x = `"${s}"."${t}"`, q = `"${col}"`, v = d === 'jsonb' ? `${q}::text` : q
  for (const old of OLD) {
    const set = d === 'jsonb' ? `replace(${q}::text, $1, $2)::jsonb` : `replace(${q}, $1, $2)`
    // legacy triggers must not rewrite rows (updated_at etc.): same rule as copy.mjs
    const n = (await c.query(`select count(*)::int n from ${x} where ${v} like '%' || $1 || '%'`, [old])).rows[0].n
    if (!n) continue
    await c.query(`alter table ${x} disable trigger user`)
    await c.query(`update ${x} set ${q} = ${set} where ${v} like '%' || $1 || '%'`, [old, PORTAL])
    await c.query(`alter table ${x} enable trigger user`)
    console.log(`${String(n).padStart(5)}  ${s}.${t}.${col}  (${old.slice(8, 16)})`); total += n
  }
}
console.log(`${total} value(s) ${commit ? 'rewritten' : 'would be rewritten'}`)
await c.query(commit ? 'commit' : 'rollback'); await c.end()
