import Link from 'next/link';

const TABS = [['/finance', 'Overview'], ['/finance/transactions', 'Transactions'], ['/finance/parties', 'Parties'], ['/finance/accounts', 'Accounts']] as const;

export function FinanceTabs({ current }: { current: string }) {
  return (
    <nav className="tabs" aria-label="Finance">
      {TABS.map(([href, label]) => <Link key={href} href={href} className={href === current ? 'active' : ''}>{label}</Link>)}
    </nav>
  );
}
