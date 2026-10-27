# 0001. All services on subdomains of one parent domain

Date: 2026-10-27 · Status: Accepted

## Context
Users sign in once at the portal and move between services without signing in again. Browsers only
share a cookie between hosts under the same parent domain.

## Decision
The portal and every service run on subdomains of one parent domain: `app.<domain>` for the portal,
then one subdomain per service (`finance.<domain>`, `attendance.<domain>`, `stock.<domain>`,
`stock-api.<domain>`). The Supabase session cookie is set on `.<domain>`.

The parent domain name itself is still to be chosen.

## Consequences
- A service on a different domain cannot join single sign-on without a separate token handoff.
- End-to-end sign-on testing waits until the domain is chosen and DNS is set up.
