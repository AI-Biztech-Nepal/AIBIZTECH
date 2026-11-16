# Per-organization features (shared brief for Portal, Finance and Attendance)

One contract, three codebases. The portal owns the data and the editing screen. Finance and Attendance read the flags and refuse to serve what an organization has switched off. Because the contract below is fixed, all three can be built in parallel.

## Goal

Every business gets only what it needs. Not everyone wants EMI, Jageer sync or vehicle sales. Today an org either has a service or not. After this work, an org has a service **and a chosen set of features inside it**, changeable by its owner at any time, with no code change and no per-customer branches.

## Rules that apply everywhere

1. **One schema for everyone.** No per-customer tables or columns. Flags change behavior, not structure.
2. **Switching a feature off hides it, never deletes data.** Switching it on again restores everything.
3. **Existing orgs must see no change.** Backfill each org's flags to what that org sees today. That is not always "everything ON": Finance shows Rent, EMI, Marketing and website listing to one account each, so the service supplies the per-org backfill.
4. **Enforce in three places:** database, API, UI. Hiding a menu item is not enforcement.
5. **A flag is added only when a real second customer needs the feature absent.** No speculative flags.
6. Feature keys are `service.feature` in snake case, e.g. `finance.emi`. Keys are permanent: renaming one is a migration.

## The contract (owned by the Portal)

Both tables live in `core`. This is a sketch: the Portal task writes the real migration, the others code against the shape.

```sql
create table core.features (
  key          text primary key,                 -- 'finance.emi'
  service_key  text not null references core.services(key),
  name         text not null,                    -- shown to the owner
  description  text not null,
  requires     text[] not null default '{}',     -- other feature keys that must be on
  default_on   boolean not null default true,    -- value for orgs with no row
  is_active    boolean not null default true
);

create table core.org_features (
  org_id       uuid not null references core.organizations(id) on delete cascade,
  feature_key  text not null references core.features(key),
  enabled      boolean not null,
  config       jsonb not null default '{}',      -- the feature's own options, e.g. EMI rules
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now(),
  primary key (org_id, feature_key)
);
```

Read side, one function everyone uses:

```sql
core.feature_on(p_org uuid, p_feature text) returns boolean
  -- true when the org's service is live (same rule as core.has_service_access),
  -- the feature is active, its `requires` are on, and the org row says enabled
  -- (or there is no row and default_on is true)

core.org_features(p_org uuid) returns table (feature_key text, enabled boolean, config jsonb)
  -- everything an app needs for one org in a single call, for the UI
```

Write side: owners and admins only, through RLS on `core.org_features`. Turning a feature on whose `requires` are off, or off one that others require, is rejected with a clear message. Every change is written to an audit table (who, what, when).

Existing `finance.org_settings.sells_vehicles` becomes the flag `finance.vehicles`. Backfill from it, then stop reading it.

## Step 0: the feature inventory (do this first, together)

Each service lists what is genuinely separable today. Fill in this table in the PR; the keys below are **unconfirmed examples** taken from things already visible in the repos.

| Key | Name | Needs | On by default | Tables / endpoints / screens it touches |
|---|---|---|---|---|
| `finance.emi` | EMI and instalments | `finance.sales`? | yes | |
| `finance.jageer` | Jageer Nepal bill sync | | yes | `public.finance_apply_jageer_*` |
| `finance.vehicles` | Vehicle sales screens | | no | was `org_settings.sells_vehicles` |
| `attendance.payroll` | Payroll | | yes | |
| `attendance.points` | Points and redemptions | | yes | `approve_point_redemption` |
| `attendance.holidays` | Holiday calendar | | yes | |

If a "feature" cannot be switched off without breaking the rest of the service, it is core, not a feature. Leave it out.

## Work per codebase (all start after Step 0)

### Portal
- Migration for the two tables, `feature_on`, `org_features`, the audit table, and the backfill. Each service supplies its per-org backfill from the inventory (what each account sees today), including `finance.vehicles` from `org_settings`. Add PGlite tests in `supabase/tests`: default behavior, `requires`, owners can write and members cannot, an expired trial turns every feature off.
- `packages/auth` (TypeScript) and `python/aibiz_auth`: add `require_feature(key)` next to `require_service`, and a cached `features_for(org)` helper.
- Settings page: a **Features** section for owners and admins, grouped by service, a switch per feature with its description, and a clear message when a dependency blocks a change.
- Builder: map business type to a starter feature set, replacing the service-level recommendation. Preselect, never enable silently: the owner confirms.

### Finance
- Add every Finance feature to the Step 0 inventory and to the catalogue migration (Portal PR).
- Database: guard each feature's tables with `core.feature_on(org_id, 'finance.x')` in the RLS policy, so a disabled feature is unusable even through a direct API call.
- API: decorate each feature's endpoints with `require_feature`. Return `403` with `{"feature": "finance.emi"}` so the UI can explain.
- UI: load `org_features` once per session, hide navigation, pages and form fields of disabled features, and show a polite "not enabled for your organization" page if someone opens a hidden URL.

### Attendance
- Same four items as Finance, with the Attendance features from the inventory.
- Mobile apps and bridges already installed in the field must keep working: treat a missing flag as the catalogue default, never as off.

## Work against the portal-integrated branch

Each service repo has a standalone version (its own database, keyed by owner) and a branch that talks to the portal database (`portal-supabase` in Finance and Attendance). Build on the portal branch: `core.feature_on()` only exists there. A standalone checkout has nothing to attach to.

## Lessons from the Finance inventory

1. **Hidden tabs are not enforcement.** Today a hidden screen can still be opened by URL, and owner-only policies let it write rows. The database and API guards are the point of this work.
2. **`security definer` functions bypass RLS.** Functions open to anonymous callers (website listing, spin wheel, visit tracking) need the flag check inside the function body.
3. **Off means paused, not emptied.** A feature that feeds a sync (Finance's wage sync deletes any line missing from its source view) must stop the sync when switched off, not empty its source, or switching it off deletes ledger lines.
4. **Name-based branches are what this replaces.** Checks like `sellsVehicles` or `isAllInOneAbroad` (regex on a business name) become flags in the backfill, then are deleted.

## Done means

- A new org with a minimal feature set sees a smaller app, in both services, and cannot reach a disabled feature by URL or direct API call.
- An existing org is unchanged on the day this ships.
- Turning a feature off, then on, loses nothing.
- Each service has tests for: flag off refuses, flag on works, missing flag falls back to the default.

## Out of scope for now

- Per-org custom fields or a page builder. Revisit when a real customer asks.
- Billing per feature. The `features` table leaves room for a `plan` column later.
- Moving any service's data. This brief only adds the flag layer.
