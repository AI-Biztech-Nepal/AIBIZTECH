# 0003. EV Service Manager stays outside the portal

Date: 2026-10-27 · Status: Accepted

## Context
EV Service Manager is built around one customer's custom needs, not a general product.

## Decision
EV Service Manager is not a portal service. It keeps its own sign-in, data and deployment, and has
no `ev` schema or `core.services` row.

## Consequences
- Stock Manager is now the only Family B (FastAPI) service; `python/aibiz_auth` serves it alone.
- If EV joins later it needs a `core.services` row, an `ev` schema and its own migration, like any
  other service.
