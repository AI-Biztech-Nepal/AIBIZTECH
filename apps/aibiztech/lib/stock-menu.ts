import type { MenuNode } from './attendance-menu';

// Stock Manager's own menu (from its sidebar), shown under Stock Manager in the portal sidebar.
export const STOCK_MENU: MenuNode[] = [
  { label: 'Dashboard', icon: 'dashboard', path: '/' },
  { label: 'Sales', icon: 'task', path: '/sales' },
  {
    label: 'Inventory', icon: 'stock',
    children: [
      { label: 'Product', icon: 'stock', path: '/inventory' },
      { label: 'Spare Parts', icon: 'structure', path: '/inventory?tab=spare-parts' },
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
  {
    label: 'Finance', icon: 'finance', adminOnly: true,
    children: [
      { label: 'Day Book', icon: 'doc', path: '/finance?tab=daybook' },
      { label: 'Statement', icon: 'doc', path: '/finance?tab=statement' },
      { label: 'Ledger', icon: 'team', path: '/finance?tab=ledger' },
      { label: 'Bank Accounts', icon: 'card', path: '/finance?tab=banks' },
      { label: 'Quotation', icon: 'doc', path: '/finance?tab=quotation' },
      {
        label: 'Report', icon: 'finance',
        children: [
          { label: 'Sales Report', icon: 'doc', path: '/finance?tab=sales-report' },
          { label: 'Purchase Report', icon: 'doc', path: '/finance?tab=purchase-report' },
          { label: 'Expenses Report', icon: 'doc', path: '/finance?tab=expense-report' },
          { label: 'Receivable Report', icon: 'doc', path: '/finance?tab=receivable-report' },
          { label: 'Payable Report', icon: 'doc', path: '/finance?tab=payable-report' },
          { label: 'Ageing Report', icon: 'doc', path: '/finance?tab=ageing-report' },
        ],
      },
    ],
  },
  { label: 'Sanakhat', icon: 'doc', path: '/sanakhat', adminOnly: true },
  { label: 'AI Assistant', icon: 'spark', path: '/ai', adminOnly: true },
  { label: 'Settings', icon: 'settings', path: '/settings', adminOnly: true },
];
