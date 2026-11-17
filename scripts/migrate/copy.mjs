// Copies one legacy service (finance | attendance) into the portal DB. Sources are read-only
// (repeatable-read, read-only transaction); the target is written in ONE transaction that is
// rolled back unless --commit is passed. Nothing is ever dropped, truncated or updated in a source.
//
//   node copy.mjs <finance|attendance> [--commit]        env: .env.migrate, TARGET_DB_URL overrides PORTAL_DB_URL
import fs from 'node:fs'
import pg from 'pg'

const [svc, ...flags] = process.argv.slice(2)
if (!['finance', 'attendance'].includes(svc)) throw new Error('usage: copy.mjs <finance|attendance> [--commit]')
const commit = flags.includes('--commit')

const env = Object.fromEntries(fs.readFileSync(new URL('../../.env.migrate', import.meta.url), 'utf8')
  .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const targetUrl = process.env.TARGET_DB_URL ?? env.PORTAL_DB_URL
if (commit && targetUrl.includes('feylbretbknouzxxyjwg') && !flags.includes('--fresh-backup-taken'))
  throw new Error('writing to the real portal needs --commit --fresh-backup-taken')

// Businesses that exist in both apps: Finance owner email -> Attendance company name. They become one org.
const MERGES = {
  'chandan9808027608@gmail.com': 'HAMRO G&G AUTO ENTERPRISES',
  'everestmart@gmail.com': 'Everest Mart Store',
}
const CH = 1000
const Q = (n) => `"${n}"`
const connect = async (url) => { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.query("set timezone='UTC'"); return c } // same tz so row hashes compare
const rows = async (c, sql, p) => (await c.query(sql, p)).rows

const src = await connect(env[svc === 'finance' ? 'FINANCE_DB_URL' : 'ATTENDANCE_DB_URL'])
const att = svc === 'finance' ? await connect(env.ATTENDANCE_DB_URL) : src // finance needs attendance for overlapping users
const tgt = await connect(targetUrl)
for (const c of new Set([src, att])) await c.query('begin isolation level repeatable read read only')
await tgt.query('begin')

const slugs = new Set((await rows(tgt, 'select slug from core.organizations')).map((r) => r.slug))
const slug = (name) => {
  const base = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org'
  let s = base, i = 2
  while (slugs.has(s)) s = `${base}-${i++}`
  slugs.add(s); return s
}
// jsonb chunks stay strings end to end: money never passes through a JS number
async function* chunks(c, schema, table) {
  for (let off = 0; ; off += CH) {
    const [{ j }] = await rows(c, `select coalesce(jsonb_agg(to_jsonb(t))::text, '[]') j from (select * from ${schema}.${Q(table)} order by ctid offset ${off} limit ${CH}) t`)
    if (j === '[]') return
    yield j
  }
}
const insertable = async (schema, table) => (await rows(tgt, `select column_name from information_schema.columns where table_schema=$1 and table_name=$2 and is_generated='NEVER' and generation_expression is null`, [schema, table])).map((r) => r.column_name)

// ---------- users ----------
const attUsers = await rows(att, 'select * from auth.users')
const attIdent = await rows(att, 'select * from auth.identities')
let users = await rows(src, 'select * from auth.users'), idents = await rows(src, 'select * from auth.identities')
const umap = new Map() // legacy user id -> portal user id
if (svc === 'finance') {
  const byEmail = new Map(attUsers.map((u) => [u.email?.toLowerCase(), u]))
  for (const u of users) { const a = byEmail.get(u.email?.toLowerCase()); if (a) umap.set(u.id, a.id) }
  users = users.filter((u) => !umap.has(u.id)).concat(attUsers.filter((a) => [...umap.values()].includes(a.id)))
  idents = idents.filter((i) => !umap.has(i.user_id)).concat(attIdent.filter((i) => [...umap.values()].includes(i.user_id)))
}
async function putRows(schema, table, data) {
  if (!data.length) return
  const have = await insertable(schema, table), keys = Object.keys(data[0])
  const cols = have.filter((c) => keys.includes(c)).map(Q).join(',')
  await tgt.query(`insert into ${schema}.${Q(table)} (${cols}) select ${cols} from jsonb_populate_recordset(null::${schema}.${Q(table)}, $1::jsonb) on conflict do nothing`, [JSON.stringify(data)])
}
await putRows('auth', 'users', users)
await putRows('auth', 'identities', idents)
const uid = (id) => umap.get(id) ?? id

// ---------- orgs, memberships, roles ----------
const orgIds = new Set((await rows(tgt, 'select id from core.organizations')).map((r) => r.id))
const addOrg = async ({ id, name, createdBy, phone, address, email, createdAt }) => {
  if (orgIds.has(id)) return
  orgIds.add(id)
  const cb = createdBy && (await rows(tgt, 'select 1 from auth.users where id=$1', [createdBy])).length ? createdBy : null
  await tgt.query(`insert into core.organizations (id,name,slug,phone,address,email,created_by,created_at,verification_status,verification_note,verified_at)
    values ($1,$2,$3,$4,$5,$6,$7,coalesce($8,now()),'verified','migrated existing customer',now())`, [id, name, slug(name), phone, address, email, cb, createdAt])
}
for (const t of ['core.organizations', 'core.org_services']) await tgt.query(`alter table ${t} disable trigger user`) // no notification spam
const addMember = async (org, user, wantOwner, orgRole) => {
  if (!(await rows(tgt, 'select 1 from auth.users where id=$1', [user])).length) return
  const hasOwner = (await rows(tgt, `select 1 from core.memberships where org_id=$1 and org_role='owner'`, [org])).length > 0
  const role = wantOwner && !hasOwner ? 'owner' : orgRole === 'owner' ? 'admin' : orgRole
  await tgt.query('insert into core.memberships (org_id,user_id,org_role) values ($1,$2,$3) on conflict do nothing', [org, user, role])
}
const addService = async (org, service, status, user, role, legacyId) => {
  await tgt.query(`insert into core.org_services (org_id,service_key,status,enabled_at) values ($1,$2,$3,now()) on conflict do nothing`, [org, service, status])
  if (user) await tgt.query('insert into core.service_roles (org_id,user_id,service_key,role) values ($1,$2,$3,$4) on conflict do nothing', [org, user, service, role])
  await tgt.query('insert into core.legacy_tenant_map (service_key,legacy_id,org_id) values ($1,$2,$3) on conflict do nothing', [service, legacyId, org])
}
const setProfile = (user, name, phone, avatar, org) => tgt.query(
  `update core.profiles set full_name=coalesce(full_name,$2), phone=coalesce(phone,$3), avatar_url=coalesce(avatar_url,$4), active_org_id=coalesce(active_org_id,$5) where user_id=$1`, [user, name, phone, avatar, org])

const omap = new Map() // legacy owner id (finance) -> org id
if (svc === 'attendance') {
  const companies = await rows(src, 'select * from public.companies'), profiles = await rows(src, 'select * from public.profiles')
  for (const c of companies) await addOrg({ id: c.id, name: c.name, createdBy: c.created_by, createdAt: c.created_at })
  for (const c of companies) await addService(c.id, 'attendance', c.status === 'suspended' ? 'suspended' : 'active', null, null, c.id)
  const byCompany = Object.groupBy(profiles, (p) => p.company_id)
  for (const c of companies) {
    const ps = byCompany[c.id] ?? [], owner = ps.find((p) => p.id === c.created_by) ?? ps.find((p) => p.role === 'admin')
    for (const p of ps) {
      await addMember(c.id, p.id, p.id === owner?.id, p.role === 'admin' ? 'admin' : 'member')
      await tgt.query('insert into core.service_roles (org_id,user_id,service_key,role) select $1,$2,$3,$4 where exists (select 1 from core.memberships where org_id=$1 and user_id=$2) on conflict do nothing', [c.id, p.id, 'attendance', p.role])
      await setProfile(p.id, p.full_name, null, p.photo_url, c.id)
    }
  }
} else {
  const profiles = await rows(src, 'select p.*, u.email from public.profiles p join auth.users u on u.id=p.id')
  for (const p of profiles) {
    const [merged] = MERGES[p.email?.toLowerCase()] ? await rows(att, 'select * from public.companies where name=$1', [MERGES[p.email.toLowerCase()]]) : []
    const user = uid(p.id), org = merged ? merged.id : user
    omap.set(p.id, org)
    await addOrg({ id: org, name: merged ? merged.name : p.business_name || p.full_name || 'Finance account', createdBy: user, phone: p.business_phone, address: p.business_address, email: p.email, createdAt: p.created_at })
    await addMember(org, user, true, 'owner')
    await addService(org, 'finance', 'active', user, 'admin', p.id)
    await setProfile(user, p.full_name, p.phone, p.avatar_url, org)
  }
}
for (const t of ['core.organizations', 'core.org_services']) await tgt.query(`alter table ${t} enable trigger user`)

// ---------- business data ----------
await tgt.query('create temp table _umap (old uuid primary key, new uuid) on commit drop')
await tgt.query('create temp table _omap (old uuid primary key, new uuid) on commit drop')
for (const [o, n] of umap) await tgt.query('insert into _umap values ($1,$2)', [o, n])
for (const [o, n] of omap) await tgt.query('insert into _omap values ($1,$2)', [o, n])
const MAP = svc === 'finance' ? { owner_id: '_omap', ...{} } : {}
const mapFor = (table) => ({ ...MAP, ...(svc === 'finance' && table === 'profiles' ? { id: '_umap' } : {}) })

const tables = (await rows(src, `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`)).map((r) => r.table_name)
// a source table that gained or lost a column since the migration was generated would copy wrongly
for (const t of tables) {
  const colsOf = (c, schema) => rows(c, `select column_name from information_schema.columns where table_schema=$1 and table_name=$2`, [schema, t]).then((r) => r.map((x) => x.column_name).sort().join(','))
  const [a, b] = [await colsOf(src, 'public'), await colsOf(tgt, svc)]
  if (a !== b) throw new Error(`schema drift in ${t}: source has [${a}] but portal has [${b}]. Regenerate with build_schema.py from a fresh pg_dump -s.`)
}
const deps = await rows(tgt, `select a.relname child, b.relname parent from pg_constraint c join pg_class a on a.oid=c.conrelid join pg_class b on b.oid=c.confrelid
  join pg_namespace an on an.oid=a.relnamespace join pg_namespace bn on bn.oid=b.relnamespace where c.contype='f' and an.nspname=$1 and bn.nspname=$1 and a.relname<>b.relname`, [svc])
const order = []; const left = new Set(tables)
while (left.size) {
  const ready = [...left].filter((t) => deps.filter((d) => d.child === t && left.has(d.parent)).length === 0)
  if (!ready.length) throw new Error(`foreign-key cycle among: ${[...left].join(', ')}`)
  ready.forEach((t) => { order.push(t); left.delete(t) })
}
// --replace: the source is the truth, so empty the copied tables first (same transaction: rolls back with everything else)
if (flags.includes('--replace')) await tgt.query(`truncate ${order.map((t) => `${svc}.${Q(t)}`).join(', ')}`)
for (const t of order) {
  await tgt.query(`alter table ${svc}.${Q(t)} disable trigger user`) // legacy triggers must not rewrite copied rows
  const have = await insertable(svc, t), map = mapFor(t); let n = 0
  for await (const j of chunks(src, 'public', t)) {
    const cols = have.map(Q), sel = have.map((c) => map[c] ? `coalesce((select new from ${map[c]} m where m.old = r.${Q(c)}), r.${Q(c)})` : `r.${Q(c)}`)
    await tgt.query(`insert into ${svc}.${Q(t)} (${cols}) select ${sel} from jsonb_populate_recordset(null::${svc}.${Q(t)}, $1::jsonb) r on conflict do nothing`, [j])
    n++
  }
  await tgt.query(`alter table ${svc}.${Q(t)} enable trigger user`)
}
for (const s of await rows(tgt, `select pg_get_serial_sequence(format('%I.%I',table_schema,table_name), column_name) seq, table_name t, column_name c
  from information_schema.columns where table_schema=$1 and (column_default like 'nextval%' or is_identity='YES')`, [svc]))
  if (s.seq) await tgt.query(`select setval($1, coalesce((select max(${Q(s.c)}) from ${svc}.${Q(s.t)}), 1))`, [s.seq])

// ---------- verification: every row compared, not just counts ----------
const fp = async (c, schema, table, strip) => (await rows(c, `select count(*)::int n, coalesce(md5(string_agg(h,'' order by h)),'') f
  from (select md5((to_jsonb(t) - $1::text[])::text) h from ${schema}.${Q(table)} t) x`, [strip]))[0]
let bad = 0
for (const t of order) {
  const strip = Object.keys(mapFor(t)), a = await fp(src, 'public', t, strip), b = await fp(tgt, svc, t, strip)
  const ok = a.n === b.n && a.f === b.f; if (!ok) bad++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${t.padEnd(34)} source=${a.n} target=${b.n}`)
  if (!ok) { // say which rows and columns differ
    const dump = (c, schema) => rows(c, `select (to_jsonb(t) - $1::text[])::text j from ${schema}.${Q(t)} t`, [strip])
    const key = (j) => JSON.parse(j).id ?? j
    const [sa, sb] = [await dump(src, 'public'), await dump(tgt, svc)]
    const tb = new Map(sb.map((r) => [key(r.j), JSON.parse(r.j)]))
    for (const r of sa.slice(0, 100000)) {
      const x = JSON.parse(r.j), y = tb.get(x.id)
      if (!y) { console.log('   missing in target:', x.id); continue }
      const cols = Object.keys(x).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]))
      if (cols.length) { console.log('   differs', x.id, cols.map((k) => `${k}: ${JSON.stringify(x[k])} -> ${JSON.stringify(y[k])}`).join(' | ').slice(0, 300)); break }
    }
  }
}
const [{ n: legacyUsers }] = await rows(src, 'select count(*)::int n from auth.users')
const present = (await rows(tgt, 'select id from auth.users where id = any($1)', [(await rows(src, 'select id from auth.users')).map((r) => uid(r.id))])).length
console.log(`${present === legacyUsers - 0 || svc === 'finance' ? 'OK  ' : 'CHECK'} users present in target: ${present} of ${legacyUsers} (finance counts overlapping people once)`)
const orphan = await rows(tgt, `select count(*)::int n from ${svc}.profiles p where not exists (select 1 from core.memberships m where m.user_id=p.id)`)
console.log(`${orphan[0].n === 0 ? 'OK  ' : 'NOTE'} profiles without a membership: ${orphan[0].n}`)

if (bad) { await tgt.query('rollback'); console.log(`\n${bad} table(s) differ. ROLLED BACK.`); process.exit(1) }
if (commit) { await tgt.query('commit'); console.log('\nCOMMITTED.') } else { await tgt.query('rollback'); console.log('\nAll tables match. Dry run: rolled back (use --commit to keep).') }
for (const c of new Set([src, att, tgt])) await c.end()
