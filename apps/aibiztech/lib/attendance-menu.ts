// Attendance Nepal's own menu (from its admin app's sidebar), shown under Attendance Nepal in the portal sidebar.
// Paths are on the Attendance app itself; adminOnly items are shown only to people who are admins in Attendance.
export type MenuNode = { label: string; icon: string; path?: string; adminOnly?: boolean; children?: MenuNode[] };

export const ATTENDANCE_MENU: MenuNode[] = [
  {
    label: 'Attendance', icon: 'clock',
    children: [
      { label: 'Attendance Report', icon: 'doc', path: '/attendance' },
      { label: 'Calendar', icon: 'calendar', path: '/calendar' },
      { label: 'Leave', icon: 'leave', path: '/leave' },
      { label: 'Corrections', icon: 'history', path: '/corrections' },
      { label: 'Holidays', icon: 'calendar', path: '/week-off', adminOnly: true },
    ],
  },
  {
    label: 'Employees', icon: 'team',
    children: [
      { label: 'Employee Directory', icon: 'doc', path: '/employees' },
      { label: 'Shifts', icon: 'calendar', path: '/shifts', adminOnly: true },
      { label: 'Branch/Depart', icon: 'branch', path: '/branches', adminOnly: true },
      { label: 'Resigned', icon: 'signout', path: '/employees?filter=Resigned', adminOnly: true },
    ],
  },
  {
    label: 'Payroll', icon: 'card',
    children: [
      { label: 'Payroll Report', icon: 'doc', path: '/payroll' },
      { label: 'Salary Structure', icon: 'structure', path: '/salary-structure', adminOnly: true },
    ],
  },
  { label: 'Tasks', icon: 'task', path: '/tasks' },
  { label: 'Devices', icon: 'device', path: '/devices', adminOnly: true },
];
