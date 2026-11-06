# Business builder + services dashboard + visual identity

Brief for the AI Biz Tech Nepal **portal** (Next.js 16, Supabase). The original was prototyped in the Auto-Stock-Manager React app and then reverted there, so port the ideas, not the code. Reference code is in `new-files/` and `auto-stock-manager-revamp.patch` next to this file.

Read `apps/portal/AGENTS.md` first: this Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing framework code.

## What the owner asked for

1. The first screen for every new login is a **builder that asks about their business**.
2. From the answers, the app **recommends our services** (Finance, Auto Stock Manager, Attendance Nepal, and more later).
3. The portal looks **modern and sophisticated** with a real identity. It currently looks bland. Use smooth transitions, but **no animation where it isn't needed**.
4. The main dashboard **summarises all services**.
5. Some companies will want only one service (for example only attendance and finance). It is not an automobile-only product. More services will be added later.

## How it fits the portal as it exists today

- Services live in `core.services` (keys: `finance`, `stock`, `attendance`). The launcher (`app/page.tsx`) already lists them with status, role and trial days.
- A new user with no organization goes to `/onboarding` (`wizard.tsx`: Organization, Owner, PAN, Confirm) and `createOrganization` calls the `core.create_organization` RPC.
- Org rows can only be updated through column-level grants (`20261028000000_org_verification.sql`). Services can start only for a verified organization.
- Tests: `supabase/tests` (PGlite) and `apps/portal/lib/*.test.ts` (`node --test`).

## Design

### Flow
Builder first, org registration second, so there is no extra page before the dashboard:

`sign up -> /onboarding: [3 builder questions] -> [recommended services] -> [Organization, Owner, PAN, Confirm] -> /`

Extend the existing `Wizard` rather than adding a route. Builder steps come first, then the recommendation step, then the existing four steps. Keep the answers in component state and send them as hidden fields to `createOrganization`.

### Questions
1. **What does your business do?** (single choice) Examples: Vehicle dealership, Repair and service workshop, Retail or wholesale, Service or staffing company, Other.
2. **What do you want to manage?** (multi choice, at least one) Examples: Stock and sales, Staff attendance and payroll, Accounts and finance, Something else. Only offer what exists, plus "something else" to capture demand. Preselect defaults from step 1, but never overwrite what the user already picked.
3. **How big is your team?** Just me / 2-5 / 6-20 / 20+.

### Recommendation
A small pure function (`lib/recommend.ts` plus a `node --test` test) turns the answers into service keys:
- each need maps to services (stock and sales -> `stock`, attendance and payroll -> `attendance`, accounts and finance -> `finance`);
- team of 6 or more adds `attendance`;
- a vehicle dealership adds `stock`.

The recommendation step shows the result in plain words, for example "Based on your answers we suggest Auto Stock Manager and Finance". The user can continue without changing anything. Nothing is started here: services still need verification and a trial.

In the prototype this step was an editable list of toggles. In the portal, a verified org starts trials from the launcher, so this step only needs to explain and store, not enable.

### Storage (needs a Supabase migration)
Add columns to `core.organizations`: `business_type text`, `business_needs text[]`, `team_size text`. Add them to the `grant update (...)` list for `authenticated`. After `create_organization` returns the id, `createOrganization` updates these columns with the same pattern it uses for `pan_photo_path`. A failure there must not lose the new org: show a soft message and carry on. Extend the PGlite test to cover the grant. Existing orgs have nulls and simply show no recommendations.

### Launcher / dashboard (`app/page.tsx`)
- Put **recommended services first** and mark them "Recommended".
- Add an **overview strip** above the tiles with counts such as "3 services, 1 active, 1 on trial".
- Each tile shows: name, your role, status (active, trial with days left, needs verification, not enabled) and the main action (Open / Start free trial).
- Real per-service numbers (stock count, attendance today, balance) need each service to expose a small summary endpoint. That does not exist yet. Say so in the PR and leave a clear place for it. Do not invent figures.
- Tiles for services that do not exist yet can be listed as "Coming soon". Keep the list in one array so adding a service is one entry.

### Visual identity
Keep the existing class names so every page inherits the change, and rewrite the tokens in `app/globals.css`.
- Light: warm paper background `#F6F4EF`, white surfaces, ink text `#1C1917`, warm-grey borders, accent deep marine teal `#0F766E` (white text on it passes contrast).
- Dark (the portal already supports `prefers-color-scheme: dark`): warm black surfaces, accent `#5EEAD4`-ish with dark text.
- Fonts via `next/font/google` in `app/layout.tsx`: **Bricolage Grotesque** for headings and big numbers, **Instrument Sans** for body. Tabular numerals for figures.
- Header: a brand mark (monogram) instead of plain text, organization and role as a quiet chip.
- Tiles: larger radius, a one-letter monogram per service, hover raises the border to ink. No heavy shadows.
- Theme the browser surfaces too: `::selection`, caret colour, focus ring, scrollbars.

### Motion (keep it small)
- One page entrance per route: fade and rise 8px, 0.35s, `cubic-bezier(0.16, 1, 0.3, 1)`.
- The service tiles stagger in once (40ms steps).
- Wizard steps slide or fade between steps.
- Buttons, toggles and inputs: short colour and transform transitions only.
- Everything off under `prefers-reduced-motion: reduce`. No looping or decorative animation. The existing submit-button spinner stays.

## Out of scope for the first pass
- Redesigning login, signup, admin and team beyond what the new tokens give them for free.
- Per-service live metrics.
- Letting users edit their builder answers later (a small "Edit business profile" section on `/admin` is the natural place when wanted).

## Acceptance checks
- A brand-new account sees the builder first, can go back and forth, and cannot continue a step without an answer.
- After the org is created, the answers are saved and the launcher shows recommended services first.
- An existing org with no answers still loads the launcher normally.
- `npm test` passes, including the new recommendation test and the extended grant test.
- Keyboard focus is visible everywhere, and the wizard works with Enter and Tab.
- Looks right at phone width (360px) and desktop, in light and dark.
