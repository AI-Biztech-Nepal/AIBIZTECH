import type { MenuNode } from './attendance-menu';

// Stock Manager's own menu in the portal sidebar: its inventory, flat under the heading (the heading opens the dashboard)
export const STOCK_MENU: MenuNode[] = [
  { label: 'Product', icon: 'stock', path: '/inventory' },
  { label: 'Spare Parts', icon: 'structure', path: '/spare-parts' },
];

// Service is its own entry in the sidebar, next to Stock Manager (its heading opens Job Cards)
export const STOCK_SERVICE_MENU: MenuNode[] = [
  { label: 'Job Cards', icon: 'wrench', path: '/jobs' },
  { label: 'Warranty', icon: 'admin', path: '/warranty' },
];
