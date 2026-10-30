# Migration mapping: Finance and Attendance into the portal DB

Status: **draft for approval**. Nothing has been written to any database. Source projects are only ever read
(see SCAFFOLD §9 and ADR 0002). Numbers come from live reads on 2026-10-30.

## What exists today

| | Finance (`boiiqzk…`) | Attendance (`whaahjt…`) | Portal (`feylbre…`) |
|---|---|---|---|
| Auth users | 7 (all bcrypt) | 41 (all bcrypt) | 2 |
| Tenant | `owner_id` = a user (5 own data) | `company_id`, 13 companies | `core.organizations`, 3 |
| Roles | all `store` | `admin` 20, `employee` 20 (+1 user with no profile) | `core.service_roles` |
| Tables (public) | 15 | 27 | n/a |
| Rows | ~830 | ~63,000 | n/a |
| Storage | 1 file | 11 files | n/a |

Email overlap: Finance and Attendance share **3** users. Neither shares any with the portal.

## Tenant to organization

- **Attendance:** one `core.organizations` row per `companies` row (13), recorded in `core.legacy_tenant_map`
  (`service_key='attendance'`, `legacy_id=companies.id`). Pass-through of `name`. `status` suspended/active maps to
  `core.org_services.status` (`suspended`/`active`). Two need a decision, see Open questions.
- **Finance:** one organization per owner (5 with data, 2 empty profiles). Name from `profiles.business_name`, falling
  back to `full_name`. `legacy_id` = the owner's user id. Owner becomes `org_role='owner'`.

## Users

- Keep the **same UUID** in `auth.users` for everyone, so every `owner_id`, `employee_id`, `reviewed_by` etc. keeps
  working with no translation. Insert with the existing bcrypt hash, so nobody has to reset a password.
- The 3 overlapping people have different UUIDs in each project. They become **one** user (Attendance UUID wins);
  their Finance `owner_id` is translated to it during the copy. Memberships are created in both orgs.
- The Attendance user with no profile is migrated as a user only and listed for review.

## Roles

| Source | Portal `core.service_roles` |
|---|---|
| Attendance `profiles.role='admin'` | org_role `admin`, service role `admin` |
| Attendance `profiles.role='employee'` | org_role `member`, service role `employee` |
| Finance `profiles.role='store'` | org_role `owner`, service role `admin` |

Service roles must be in `core.services.roles` (`attendance`: admin/hr/employee; `finance`: admin/accountant/viewer).

## Data copy

- Schemas `finance.*` and `attendance.*` get the same tables and columns, plus `org_id` replacing `owner_id` /
  `company_id`. Every row keeps its original `id`.
- RLS is rewritten from "owner/company" checks to `core` membership and service-role checks.
- Counts per org, ledger totals (to the paisa) and per-company employee and attendance counts must match before cut-over.

## Things that live outside the tables

- **Attendance cron jobs:** recreate `nightly-payroll` (02:00, `compute_payroll_summaries()`) in the portal project.
  Do **not** recreate `sync-nepal-holidays-daily`: it already fails every night in the old project
  (`app.settings.supabase_url` is unset), no `sync-nepal-holidays` Edge Function is deployed there or in any local repo,
  and the last scrape was 2026-08-24. `nepal_public_holidays` holds BS 2083 (to 2027-04-06) and is copied as data;
  add BS 2084 by a plain SQL insert when the calendar is published.
- **Attendance biometric bridge:** `profiles.is_device_bridge` accounts and `device_command_queue` / `devices`
  are polled by hardware outside this repo. Their credentials and endpoints change at cut-over.
- **Finance sync:** `finance_sync_secrets`, `external_source` / `external_id` columns show it is fed by another app.
  That integration must be repointed.
- **Storage:** copy files (1 + 11) into portal buckets with the same paths; update `selfie_url`,
  `profile_photo_url`, `business_logo_path` if they hold absolute URLs.
- **Leftover buckets** `asm-photos`, `asm-documents` (Finance, empty): not carried over unless you say so.

## Decisions (approved 2026-10-30)

1. Internal and test orgs (Platform Admin (internal), Dummy Account, Soaltie Hotel) are migrated like any other.
2. Auth allows one account per email, so each of the 3 overlapping emails becomes **one login** (Attendance UUID and
   password hash win). Data stays separated per org; the person uses the org switcher. Not merged by data.
3. Hamro G&G Auto (Attendance company and Finance owner Chandan) becomes **one org with both services**.
   Other Finance owners get their own org each; one person may own several orgs.
4. Slugs are auto-generated from the org name, with a numeric suffix on collision.
