# Attendance feature inventory (draft, Step 0)

Read from `ATTENDANCENEPAL` branch `portal-supabase`: sidebar, admin-web pages, mobile screens, migrations.
**Not confirmed.** I could not see which company uses what in production, so every row is backfilled ON (nobody loses anything). Say which should default OFF for new orgs, and which rows are really core.

| Key | Name | Needs | Default | Touches |
|---|---|---|---|---|
| `attendance.leave` | Leave management | | on | `/leave`, mobile LeaveRequest/LeaveApproval, `004_leave_management`, paid leave balance, `block_attendance_on_leave` |
| `attendance.corrections` | Punch corrections and GPS approval | | on | `/corrections`, mobile FixPunch/Approvals, `gps_punch_approval`, correction tables |
| `attendance.holidays` | Holidays and week-off | | on | `/week-off`, `nepal_public_holidays`, `sync-nepal-holidays`, `notify-week-off` functions |
| `attendance.payroll` | Payroll | | on | `/payroll`, `/my-payroll`, mobile Payroll screens, `compute_payroll_summaries`, `payroll_summaries` |
| `attendance.salary_structure` | Salary structure, SSF and overtime | `attendance.payroll` | on | `/salary-structure`, `employee_salary_structure`, contribution rates, overtime settings |
| `attendance.tasks` | Tasks and time tracking | | on | `/tasks`, `/my-tasks`, mobile Tasks, `tasks_and_rewards`, `task_time_tracking` |
| `attendance.points` | Points and redemptions | `attendance.tasks` | on | `approve_point_redemption` (missing in live old project), leaderboard |
| `attendance.devices` | ZKTeco biometric devices | | on | `/devices`, `zkteco-bridge`, `device_command_queue`, `device_bridge_accounts`, `device_sync_events` |

Left out as core (cannot be switched off without breaking the service): dashboard, attendance log and reports, employees, shifts, branches/departments, check-in, calendar, own profile.

Open questions
1. Punch methods (GPS, QR, selfie) could be features, but installed APKs depend on them. Proposal: not flags yet.
2. Per-feature guards must go in the database (RLS or function checks), as with Finance, and installed apps treat a missing flag as the catalogue default.
3. Backfill per org is all ON until you tell me otherwise.
