import type { MenuNode } from './attendance-menu';

// Stock Manager's own menu (from its sidebar), shown under Stock Manager in the portal sidebar.
export const STOCK_MENU: MenuNode[] = [
  { label: 'Dashboard', icon: 'dashboard', path: '/' },
  { label: 'Sales', icon: 'task', path: '/sales' },
  { label: 'EMI', icon: 'card', path: '/emi', adminOnly: true },
  { label: 'Customers', icon: 'team', path: '/customers' },
  { label: 'Vendors', icon: 'card', path: '/vendors' },
  {
    label: 'Inventory', icon: 'stock',
    children: [
      { label: 'Product', icon: 'stock', path: '/inventory' },
      { label: 'Spare Parts', icon: 'structure', path: '/spare-parts' },
    ],
  },
  {
    label: 'Marketing', icon: 'megaphone', adminOnly: true,
    children: [
      { label: 'Leads', icon: 'doc', path: '/marketing?tab=leads' },
      { label: 'CRM', icon: 'team', path: '/marketing?tab=crm' },
      { label: 'Share', icon: 'plus', path: '/marketing?tab=share' },
      { label: 'Offers', icon: 'card', path: '/marketing?tab=offers' },
      { label: 'Visits', icon: 'clock', path: '/marketing?tab=visits' },
    ],
  },
  {
    label: 'Service', icon: 'wrench',
    children: [
      { label: 'Job Cards', icon: 'wrench', path: '/jobs' },
      { label: 'Warranty', icon: 'admin', path: '/warranty' },
    ],
  },
  { label: 'Sanakhat', icon: 'doc', path: '/sanakhat', adminOnly: true },
  { label: 'AI Assistant', icon: 'spark', path: '/ai', adminOnly: true },
  { label: 'Settings', icon: 'settings', path: '/settings', adminOnly: true },
];
