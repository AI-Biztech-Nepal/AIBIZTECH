import type { MenuNode } from './attendance-menu';

// Finance's own menu (from its app's side panel). Finance runs inside the portal, so these open right here, under /finance.
export const FINANCE_MENU: MenuNode[] = [
  { label: 'Stock And Inventory', icon: 'stock', path: '/inventory' },
  { label: 'Sales', icon: 'task', path: '/transactions?type=sale&add=1' },
  { label: 'Purchase', icon: 'card', path: '/transactions?type=purchase&add=1' },
  {
    label: 'Finance', icon: 'finance',
    children: [
      { label: 'Day Book', icon: 'doc', path: '/daybook' },
      { label: 'Statement', icon: 'doc', path: '/transactions' },
      { label: 'Ledger', icon: 'team', path: '/customers' },
      { label: 'Received', icon: 'plus', path: '/quick-payment?type=in' },
      { label: 'Paid', icon: 'card', path: '/quick-payment?type=out' },
      { label: 'Expenses', icon: 'task', path: '/transactions?type=expense&add=1' },
      { label: 'Bank Accounts', icon: 'card', path: '/bank-accounts' },
      {
        label: 'Report', icon: 'finance',
        children: [
          { label: 'Sales Report', icon: 'doc', path: '/sales-report' },
          { label: 'Purchase Report', icon: 'doc', path: '/purchase-report' },
          { label: 'Expenses Report', icon: 'doc', path: '/expense-report' },
          { label: 'Receivable Report', icon: 'doc', path: '/to-receive' },
          { label: 'Payable Report', icon: 'doc', path: '/to-give' },
        ],
      },
    ],
  },
];
