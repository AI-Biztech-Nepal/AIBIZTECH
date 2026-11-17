# AIBIZTECH — Project Scaffold

One login, one organization, many services.

This document kick-starts the **AI Biz Tech Nepal portal**: a single place where a business signs
in and uses the services it subscribes to (Finance, Auto Stock Manager, Attendance Nepal). The existing apps stop being standalone products and become **services**
behind one platform.

> Status: **Phase 0 (design)**. Values marked `TBD` are open decisions — see [§12](#12-open-decisions).

---

## 1. Goals and non-goals

**Goals**
- One account per person, one sign-in, move between services without logging in again.
- The **organization** (a business) is the customer. It enables services; its members get a role per service.
- Each service keeps its own data and code, but trusts the platform for identity, organization and access.
- Existing customers keep working through every migration.

**Non-goals (for now)**
- Rewriting existing frontends into one codebase.
- EV Service Manager. It stays a standalone, custom product outside the portal ([ADR 0003](adr/0003-ev-service-stays-outside.md)).
- One combined mobile app. Native apps keep their own sign-in until Phase 5.

---

## 2. Services at a glance

| Service key | Repo | Frontend | Backend | Today's auth / tenancy | Integration family |
|---|---|---|---|---|---|
| `finance` | `FINANCE` | Expo (RN + web) | Supabase direct | Supabase Auth, per-user books | **A** |
| `attendance` | `ATTENDANCENEPAL` | Expo mobile (+ planned Next.js admin) | Supabase direct | Supabase Auth, organization-based | **A** |
| `stock` | `Auto-Stock-Manager` | React (CRA + craco) | FastAPI | Own JWT → moving to Supabase Auth, `company_id` | **B** |

`Hamro-GNG-Auto` (a customer's public website that reads from Stock Manager) and `EV-Service-Manager` stay **outside** the portal.

- **Family A** — the app talks to Supabase directly. Integration = share the platform's Supabase session; Row Level Security checks organization membership.
- **Family B** — React app + FastAPI backend. Integration = the backend verifies the platform's Supabase JWT and resolves the user's role from `core`; the service's own sign-up and staff screens are removed.

---

## 3. Architecture

```
                 app.<domain>  (Portal — Next.js)
     Sign in · Sign up · Org switcher · Service launcher · Org admin
                              │
             ┌────────────────┴────────────────┐
             │  ONE Supabase project            │
             │  auth.*   — users, sessions      │
             │  core.*   — orgs, memberships,   │
             │             services, roles      │
             │  finance.* attendance.*          │
             │  stock.*                         │
             └────────────────┬────────────────┘
     ┌──────────────┬─────────┴────┬──────────────┐
 finance.<domain> attendance.<domain> stock.<domain>
  (Family A)      (Family A)       (B: + stock-api)
```

### Domains (`<domain>` = `TBD`, e.g. `aibiztechnepal.com`)

| Host | What |
|---|---|
| `app.<domain>` | Portal |
| `finance.<domain>` | Finance web |
| `attendance.<domain>` | Attendance admin web |
| `stock.<domain>` / `stock-api.<domain>` | Stock Manager web / API |

All hosts must be subdomains of one parent domain so the session cookie can be shared (`Domain=.<domain>`).

### How a request flows

1. User signs in at `app.<domain>`. Supabase session is stored in a cookie scoped to `.<domain>`.
2. Portal calls `core.my_context()` → profile, active organization, enabled services and the user's role in each → renders service tiles.
3. User clicks **Finance** → `finance.<domain>` reads the same cookie session, calls `core.my_context()`, checks it has a `finance` role, and loads.
4. No session → redirect to `app.<domain>/login?next=<url>`. No role → redirect to `app.<domain>/?denied=finance`.
5. Family B: the web app sends `Authorization: Bearer <supabase access token>` and `X-Org-Id: <active org>` to its FastAPI, which verifies both.

---

## 4. Repository layout

New repo: **`AI-Biztech-Nepal/portal`** (npm workspaces).

```
portal/
├─ apps/
│  └─ portal/                 Next.js (App Router) — login, signup, org switcher, launcher, org admin
├─ packages/
│  ├─ auth/                   @ai-biztech-nepal/auth — Supabase client (shared cookie), useContext, guards, apiFetch
│  ├─ ui/                     @ai-biztech-nepal/ui — platform header, app switcher, org switcher, theme tokens
│  └─ types/                  @ai-biztech-nepal/types — generated Supabase types for core.*
├─ python/
│  └─ aibiz_auth/             FastAPI dependency for Family B services (pip-installable)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/             SINGLE source of truth for the shared database (all schemas)
│  └─ seed.sql
├─ docs/
│  ├─ SCAFFOLD.md             this file
│  └─ adr/                    architecture decision records (0001-one-supabase-project.md, ...)
├─ .github/workflows/         lint, typecheck, migration check, package publish
└─ package.json
```

**Database migrations live only in this repo.** Services have their own schema (`finance`, `stock`, ...) but
any change to it is a PR here. One migrations folder per Supabase project avoids repos overwriting
each other's history. Name migrations `<timestamp>_<schema>_<what>.sql`, e.g.
`20261101000000_core_init.sql`, `20261115000000_finance_init.sql`.

**Sharing packages with service repos:** publish `packages/*` to GitHub Packages under the
`@ai-biztech-nepal` scope; install `aibiz_auth` with
`pip install "git+https://github.com/AI-Biztech-Nepal/portal.git#subdirectory=python/aibiz_auth"`
(pin a tag).

---

## 5. Core schema (`core.*`)

Starting point for `supabase/migrations/<ts>_core_init.sql`.

```sql
create schema if not exists core;

-- Catalogue of services the platform offers
create table core.services (
  key        text primary key,                 -- 'finance' | 'stock' | 'attendance'
  name       text not null,
  base_url   text not null,                    -- https://finance.<domain>
  roles      text[] not null,                  -- valid roles inside this service
  is_active  boolean not null default true
);

create table core.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  address     text,
  phone       text,
  logo_url    text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create table core.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  phone          text,
  avatar_url     text,
  active_org_id  uuid references core.organizations(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Person <-> organization
create table core.memberships (
  org_id      uuid not null references core.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_role    text not null check (org_role in ('owner', 'admin', 'member')),
  status      text not null default 'active' check (status in ('active', 'disabled')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Organization <-> service (subscription / entitlement)
create table core.org_services (
  org_id       uuid not null references core.organizations(id) on delete cascade,
  service_key  text not null references core.services(key),
  status       text not null default 'trial' check (status in ('trial', 'active', 'suspended')),
  plan         text,
  enabled_at   timestamptz not null default now(),
  primary key (org_id, service_key)
);

-- Person's role inside one service of one organization
create table core.service_roles (
  org_id       uuid not null,
  user_id      uuid not null,
  service_key  text not null,
  role         text not null,
  primary key (org_id, user_id, service_key),
  foreign key (org_id, user_id)     references core.memberships (org_id, user_id)     on delete cascade,
  foreign key (org_id, service_key) references core.org_services(org_id, service_key) on delete cascade
);

create table core.invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references core.organizations(id) on delete cascade,
  email        text not null,
  org_role     text not null default 'member',
  service_roles jsonb not null default '{}',     -- {"finance":"accountant","attendance":"hr"}
  invited_by   uuid references auth.users(id),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz
);

-- Maps old per-app tenants to organizations during migration
create table core.legacy_tenant_map (
  service_key  text not null references core.services(key),
  legacy_id    text not null,                  -- old company_id / owner user id
  org_id       uuid not null references core.organizations(id),
  primary key (service_key, legacy_id)
);

create table core.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid,
  user_id     uuid,
  service_key text,
  action      text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

insert into core.services (key, name, base_url, roles) values
  ('finance',    'Finance',              'https://finance.TBD',    array['admin','accountant','viewer']),
  ('stock',      'Stock Manager',        'https://stock.TBD',      array['admin','stock_supervisor','parts_supervisor','social_media']),
  ('attendance', 'Attendance Nepal',     'https://attendance.TBD', array['admin','hr','employee']);
```

### Access helpers (used by RLS and by FastAPI)

```sql
-- The caller's role in a service for an org, or null if no access
create or replace function core.service_role(p_org uuid, p_service text)
returns text
language sql stable security definer set search_path = ''
as $$
  select sr.role
  from core.service_roles sr
  join core.memberships m
    on m.org_id = sr.org_id and m.user_id = sr.user_id and m.status = 'active'
  join core.org_services os
    on os.org_id = sr.org_id and os.service_key = sr.service_key and os.status in ('trial', 'active')
  where sr.org_id = p_org
    and sr.user_id = auth.uid()
    and sr.service_key = p_service
$$;

create or replace function core.has_service_access(p_org uuid, p_service text, p_roles text[] default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(r is not null and (p_roles is null or r = any (p_roles)), false)
  from (select core.service_role(p_org, p_service) as r) x
$$;

-- Everything the portal and services need after sign-in, in one call
create or replace function core.my_context()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id',       p.user_id,
    'full_name',     p.full_name,
    'active_org_id', p.active_org_id,
    'orgs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'org_role', m.org_role,
        'services', coalesce((
          select jsonb_object_agg(sr.service_key, sr.role)
          from core.service_roles sr
          join core.org_services os
            on os.org_id = sr.org_id and os.service_key = sr.service_key and os.status in ('trial', 'active')
          where sr.org_id = o.id and sr.user_id = p.user_id
        ), '{}'::jsonb)))
      from core.memberships m
      join core.organizations o on o.id = m.org_id
      where m.user_id = p.user_id and m.status = 'active'
    ), '[]'::jsonb)
  )
  from core.profiles p
  where p.user_id = auth.uid()
$$;
```

Also needed in the init migration: RLS on every `core` table (members read their own org; only
`owner`/`admin` write memberships, service roles and invitations), a trigger that creates
`core.profiles` on `auth.users` insert, and `grant usage on schema core to authenticated`.

### Rules every service schema follows

- Every business table has `org_id uuid not null references core.organizations(id)` and an index on it.
- RLS is on for every table. Policies use `core.has_service_access(org_id, '<service>' [, roles])`.
- Add the schema to **Supabase → Settings → API → Exposed schemas** and `grant usage on schema <svc> to authenticated`.
- Money is `numeric(14,2)` in NPR. Timestamps are `timestamptz`; display in `Asia/Kathmandu`, BS/AD per user toggle.

Example (Finance):

```sql
alter table finance.bills enable row level security;

create policy bills_read on finance.bills for select
  using (core.has_service_access(org_id, 'finance'));

create policy bills_write on finance.bills for all
  using      (core.has_service_access(org_id, 'finance', array['admin','accountant']))
  with check (core.has_service_access(org_id, 'finance', array['admin','accountant']));
```

---

## 6. Shared session across subdomains

`packages/auth` creates every web Supabase client with `@supabase/ssr`, so the session lives in a
cookie on the parent domain:

```ts
// packages/auth/src/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,        // each app maps its own env prefix
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN, path: '/', sameSite: 'lax', secure: true } },
  );
}
```

- **Next.js / CRA / Vite apps:** use `getSupabase()` directly.
- **Expo apps (Finance, Attendance):** on **web** builds use `getSupabase()`; on **native** builds keep
  the current AsyncStorage/SecureStore client (native sign-in stays per app until Phase 5).
- In local development use `localhost` with ports, or map `*.aibiz.local` in the hosts file to test the shared cookie.

Every service runs the same guard on load (exported from `packages/auth`):

```ts
export async function requireService(serviceKey: string) {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return redirect(`${PORTAL_URL}/login?next=${encodeURIComponent(location.href)}`);

  const { data: ctx } = await supabase.schema('core').rpc('my_context');
  const org  = ctx.orgs.find((o: any) => o.id === ctx.active_org_id);
  const role = org?.services?.[serviceKey];
  if (!role) return redirect(`${PORTAL_URL}/?denied=${serviceKey}`);

  return { session, ctx, org, role };
}
```

---

## 7. Integration recipe — Family A (Finance, Attendance)

1. Create the service schema in the portal repo (`<ts>_finance_init.sql`), porting the app's existing migrations into `finance.*`.
2. Replace owner/user scoping with `org_id`; rewrite RLS policies to `core.has_service_access(...)`.
3. Point the app at the platform Supabase project; switch the web client to `@ai-biztech-nepal/auth`.
4. Remove the app's own sign-up/sign-in screens on web; call `requireService('finance')` at the root layout.
5. Change Supabase queries to `.schema('finance')` (or set `db: { schema: 'finance' }` on the client).
6. Write the data-migration script (see [§9](#9-migrating-existing-customers)).
7. Add the platform header from `@ai-biztech-nepal/ui` (app switcher + org switcher).

## 8. Integration recipe — Family B (Stock Manager)

**Backend (FastAPI)** — replace the service's own JWT with `aibiz_auth`:

```python
# python/aibiz_auth/aibiz_auth/__init__.py
import os
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException

SUPABASE_URL = os.environ["SUPABASE_URL"]
_jwks = jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


@dataclass
class Ctx:
    user_id: str
    org_id: str
    role: str


def require_service(service_key: str, roles: set[str] | None = None, get_db=None):
    def dep(authorization: str = Header(...), x_org_id: str = Header(...), db=Depends(get_db)):
        token = authorization.removeprefix("Bearer ").strip()
        try:
            key = _jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["ES256", "RS256"], audience="authenticated")
        except jwt.PyJWTError:
            raise HTTPException(401, "Invalid session")

        role = db.fetch_value(  # adapt to the service's DB layer
            """
            select sr.role from core.service_roles sr
            join core.memberships m  on m.org_id = sr.org_id and m.user_id = sr.user_id and m.status = 'active'
            join core.org_services os on os.org_id = sr.org_id and os.service_key = sr.service_key
                                     and os.status in ('trial', 'active')
            where sr.org_id = %s and sr.user_id = %s and sr.service_key = %s
            """,
            (x_org_id, claims["sub"], service_key),
        )
        if role is None or (roles and role not in roles):
            raise HTTPException(403, "No access to this service")
        return Ctx(user_id=claims["sub"], org_id=x_org_id, role=role)

    return dep
```

Requires **asymmetric JWT signing keys** enabled in the Supabase project (Settings → JWT Keys).
Role/active checks stay live on every request, so removing someone's access takes effect immediately.

Steps:
1. Move tables into the service schema (`stock.*`); rename `company_id` → `org_id` (uuid).
2. Swap every route's auth dependency for `require_service('stock')` / `require_service('stock', {'admin'})`.
3. Delete `/auth/signup`, `/auth/login` and staff-account management — the portal owns them.
   Staff now = organization members with a `stock` service role.
4. Frontend: use `@ai-biztech-nepal/auth` for the session; send `Authorization` + `X-Org-Id` on every API call (`apiFetch` in the package does this).
5. Cron endpoints keep their `CRON_SECRET` and loop over all orgs that have the service enabled.

---

## 9. Migrating existing customers

For each service, one idempotent script in `scripts/migrate/<service>.ts|py`:

1. For each legacy tenant (`company_id`, or Finance owner user) → create `core.organizations` row, record it in `core.legacy_tenant_map`.
2. For each legacy user → find or create `auth.users` by email. Supabase's admin API accepts existing **bcrypt** hashes (`password_hash`), so users keep their passwords where the old app used bcrypt; otherwise send a reset link.
3. Create `core.memberships`, `core.org_services` (status `active`) and `core.service_roles` from the old roles.
4. Copy business data into the service schema, translating ids via the map.
5. Verify counts and totals per org (ledger balances must match to the paisa), then cut over DNS.

Cut-over rule: the old app goes **read-only** on the cut-over date and stays reachable for 30 days.

---

## 10. Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL` / `VITE_SUPABASE_URL` | all | Platform project URL (one value, per-framework prefix) |
| `SUPABASE_ANON_KEY` (+ prefixed variants) | all web/mobile | Public key |
| `SUPABASE_SERVICE_ROLE_KEY` | migration scripts, cron, ZKTeco bridge | Server only, never shipped to a browser |
| `DATABASE_URL` | FastAPI services | Pooled connection string |
| `COOKIE_DOMAIN` (+ prefixed variants) | all web | `.<domain>` |
| `PORTAL_URL` (+ prefixed variants) | all services | `https://app.<domain>` |
| `CRON_SECRET` | Stock | Existing cron protection |

---

## 11. Phases and checklists

### Phase 0 — Design (now)
- [ ] Settle open decisions in §12; record each as an ADR in `docs/adr/`
- [ ] Create `AI-Biztech-Nepal/portal` repo with the layout in §4
- [ ] Create the platform Supabase project (enable asymmetric JWT keys, custom SMTP for auth email)
- [ ] Write and review `core_init.sql` (§5) including RLS and the profile trigger
- [ ] Inventory each service's roles and map them to `core.services.roles`

### Phase 1 — Portal + core
- [x] `apps/aibiztech`: sign in, sign up (email code), forgot/reset password
- [x] Create organization on first sign-in (org switcher dropped: not needed)
- [x] Service launcher (tiles from `my_context()`), "no access" state
- [x] Org admin: members, invitations, enable/disable services, assign service roles
- [x] `packages/auth`, `packages/ui`, `python/aibiz_auth` v0.1 built (not yet published or tagged)
- [ ] Deploy portal to `app.<domain>`

### Phase 2 — Finance (Family A)
- [ ] `finance` schema + RLS in portal repo
- [ ] App switched to platform auth on web; owner → org scoping
- [ ] Migration script + verified balances; cut over `finance.<domain>`

### Phase 3 — Attendance (Family A, **paying customers**)
- [ ] `attendance` schema; admin web on platform auth
- [ ] Rehearse the migration on a copy of production data; verify employee and attendance counts per org
- [ ] ZKTeco bridge writes to the platform project
- [ ] Employees as members with `attendance:employee` role

### Phase 4 — Stock Manager (Family B)
- [ ] Finish MySQL → Postgres move into `stock` schema
- [ ] FastAPI on `aibiz_auth`; roles mapped; platform-owner cross-company view → portal super-admin
- [ ] Hamro-GNG-Auto public API keeps working (public endpoints scoped by org slug)

### Phase 5 — Platform features
- [ ] Shared `core.customers` / `core.vehicles` if more services need them
- [ ] Payroll (Attendance) and sales/payments (Stock) post into Finance
- [ ] One AI Biz Tech Nepal mobile app; platform billing

---

## 12. Open decisions

| # | Decision | Default assumed in this doc |
|---|---|---|
| 1 | Portal domain | Subdomains of one parent domain ([ADR 0001](adr/0001-one-parent-domain.md)); the domain name itself is `TBD` |
| 2 | One Supabase project with a schema per service vs. separate projects | **One project** (enables cross-service features; gives up Finance's fully separate books) |
| 3 | Which services have live customers today | **Decided:** Attendance only ([ADR 0002](adr/0002-attendance-has-paying-customers.md)) |
| 4 | Portal hosting | Vercel (matches Finance today) |
| 5 | EV Service Manager in the portal? | **Decided:** no, stays standalone ([ADR 0003](adr/0003-ev-service-stays-outside.md)) |
| 6 | Platform super-admin (AI Biz Tech Nepal staff) access model | A `core.platform_admins` table, read-only by default |
