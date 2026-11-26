// What each module does, shown while choosing. List only what the app really has today.
// A key without points gets a short row; a key not listed here (a future app) shows its name alone.
export const MODULES: Record<string, { about: string; points?: string[] }> = {
  attendance: {
    about: 'Know who is in, who is late and who is on leave.',
    points: ['Employee attendance', 'Check-in and check-out', 'Shift management', 'Leave management', 'Attendance reports'],
  },
  finance: {
    about: 'Keep the day book, party balances and cash in one place.',
    points: ['Income and expenses', 'Party ledger', 'Payments and receipts', 'Financial reports', 'Outstanding balances'],
  },
  stock: {
    about: 'Track vehicles and spare parts from purchase to sale.',
    points: ['Vehicle inventory', 'Spare parts stock in and out', 'Sales and EMI', 'Job cards and warranty', 'Sanakhat records'],
  },
  marketing: { about: 'Also available: collect leads and follow them up in the CRM.' },
};

const ORDER = Object.keys(MODULES);

// The three main modules first, then the rest
export function inModuleOrder<T extends { key: string }>(services: T[]): T[] {
  const rank = (key: string) => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length);
  return [...services].sort((a, b) => rank(a.key) - rank(b.key));
}
