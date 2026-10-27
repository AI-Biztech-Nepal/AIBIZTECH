# AI Biz Tech Nepal Portal

One login, one organization, many services: Finance, Auto Stock Manager, Attendance Nepal and
EV Service Manager, behind a single portal.

Status: **Phase 0 (design)**. Start with [docs/SCAFFOLD.md](docs/SCAFFOLD.md).

| Folder | What goes here |
|---|---|
| `apps/portal` | Next.js portal: sign in, org switcher, service launcher, org admin |
| `packages/` | Shared JS packages (`auth`, `ui`, `types`) used by every service |
| `python/aibiz_auth` | FastAPI auth dependency for Stock Manager and EV Service |
| `supabase/migrations` | The only place database migrations live, for every schema |
| `docs/adr` | Architecture decision records |
