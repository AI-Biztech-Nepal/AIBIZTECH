import type { MenuNode } from './attendance-menu';

// Marketing's own menu, shown under Marketing in the portal sidebar (its overview opens from the Marketing heading)
export const MARKETING_MENU: MenuNode[] = [
  { label: 'Leads', icon: 'doc', path: '/leads' },
  { label: 'CRM', icon: 'team', path: '/crm' },
  { label: 'Share', icon: 'plus', path: '/share' },
  { label: 'Offers', icon: 'card', path: '/offers' },
  { label: 'Visits', icon: 'clock', path: '/visits' },
];
