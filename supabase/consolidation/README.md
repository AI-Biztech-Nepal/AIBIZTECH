# One database for everything, without losing data

Today there are four data stores:

| App | Where its data lives now |
| --- | --- |
| AIBIZTECH portal | Supabase `feylbretbknouzxxyjwg` (target, keeps everything it has) |
| Attendance Nepal | Supabase `whaahjtqmlbwrfppogsw` |
| Finance | Supabase `boiiqzkkbyzqkqsxuzyp` |
| Stock Manager | MySQL (backend) plus some Supabase tables (`asm_*`) |

## Target design

One Supabase project (AIBIZTECH's). Each app gets its own Postgres **schema** next to `core`:
`core` (portal), `attendance`, `finance`, `stock`. Their tables share names (`profiles`, `companies`, `customers`,
`asm_members`...), and separate schemas stop them colliding or overwriting each other.

People live once, in `auth.users`. Where the same email exists in several apps they become one login, and each app's
rows are re-pointed to that one user id. Password hashes are copied as they are, so existing passwords keep working.

## Rules that keep data safe

1. **Nothing is ever changed in a source database.** Everything is copied into the target.
2. **Back up first.** `01_backup.sh` dumps every source (and the target) to files before any step.
3. **Count before and after.** `02_inventory.sql` is run on each source and again on the target; every table must match.
4. **One app at a time.** An app is switched to the new database only after its counts match and you have clicked through it.
5. **Keep the old databases** (read-only) for 30 days after the last app is switched.

## Steps

1. Run `01_backup.sh` (needs the four connection strings, set as environment variables, never committed).
2. Run `02_inventory.sql` on each source and send the counts back; this decides the exact load scripts.
3. Load each app into its schema, merge users by email, verify counts.
4. Point each app at the new database; test; repeat for the next app.
5. Stock Manager's MySQL data is converted into Postgres in the `stock` schema (a separate, larger step).

## Order (decided)

1. **Finance** (Supabase to Supabase, into schema `finance`)
2. **Stock Manager** (MySQL to Postgres, into schema `stock`)
3. **Attendance** (Supabase to Supabase, into schema `attendance`)

## Finance: what changes

- Data and tables move to the target project's `finance` schema (a copy; the old project is untouched).
- The Finance app's one Supabase client gets `db: { schema: 'finance' }`, and its URL/key point at the AIBIZTECH project.
- The `finance` schema is added to Settings -> API -> Exposed schemas in the AIBIZTECH project.
- Storage buckets (`business_assets`, `asm_media`) are copied object by object.
- Edge functions in `services/finance/supabase/functions` are deployed to the AIBIZTECH project.
