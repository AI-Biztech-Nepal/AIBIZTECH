# AI Biz Tech Nepal Portal

One login, one organization, many services: Finance, Auto Stock Manager and Attendance Nepal,
behind a single portal.

Status: **Phase 1 (portal + core)**. Start with [docs/SCAFFOLD.md](docs/SCAFFOLD.md); decisions are in [docs/adr/](docs/adr/).

| Folder | What goes here |
|---|---|
| `apps/portal` | Next.js portal: sign in, org switcher, service launcher, org admin |
| `packages/` | Shared JS packages (`auth`, `ui`, `types`) used by every service |
| `python/aibiz_auth` | FastAPI auth dependency for Stock Manager |
| `supabase/migrations` | The only place database migrations live, for every schema |
| `docs/adr` | Architecture decision records |
