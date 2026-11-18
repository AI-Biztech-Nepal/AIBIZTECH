import type { MenuNode } from './attendance-menu';

// Marketing's own menu, shown under Marketing in the portal sidebar
export const MARKETING_MENU: MenuNode[] = [
  { label: 'Overview', icon: 'dashboard', path: '/' },
  { label: 'Leads', icon: 'doc', path: '/leads' },
  { label: 'CRM', icon: 'team', path: '/crm' },
];
