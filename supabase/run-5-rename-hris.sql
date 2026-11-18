-- Attendance Nepal is shown as HRIS everywhere (sidebar, app lists, sign-up). Safe to run more than once.
update core.services set name = 'HRIS' where key = 'attendance';
