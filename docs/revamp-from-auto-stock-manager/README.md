# Revamp built in Auto-Stock-Manager, meant for this portal

Reference only: the source is a React (CRA) app, this portal is Next.js, so port rather than apply.

- `new-files/modules.js` - the service catalogue + builder questions + `recommend()` (framework-free, reusable as is).
- `new-files/Onboarding.jsx` - the 4-step business builder (questions -> recommended services with toggles).
- `new-files/ServicesOverview.jsx` - dashboard grid, one card per enabled service.
- `new-files/BusinessContext.jsx` - loads the company's profile / enabled services.
- `tailwind.config.reference.js`, `index.css.reference` - the design tokens: warm paper `#F6F4EF`, warm-black sidebar, deep teal `#0F766E`, Bricolage Grotesque + Instrument Sans, one route-entrance animation + card stagger, reduced-motion off-switch.
- `auto-stock-manager-revamp.patch` - the full original diff (includes a backend `business_profile` endpoint: `GET/PUT /business-profile`, stored as JSON on the company settings row).
