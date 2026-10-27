# 0002. Attendance is the only service with paying customers

Date: 2026-10-27 · Status: Accepted

## Context
The migration order and how careful each cut-over must be depend on who is using each service today.

## Decision
Attendance Nepal has paying customers; Finance and Stock Manager do not. Finance goes first
(Phase 2) as the low-risk pilot of a Family A migration. Attendance follows (Phase 3) with extra care:
- the migration is rehearsed on a copy of production data first;
- employee and attendance-record counts are checked per organization before cut-over;
- the old app stays reachable read-only for 30 days (§9 of SCAFFOLD.md).

## Consequences
Attendance customers move only after the shared sign-on and org model have been proven on Finance.
