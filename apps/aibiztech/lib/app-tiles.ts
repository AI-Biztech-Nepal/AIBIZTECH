import type { BusinessKind } from './business-kind';

// The tiles on Add apps are the modules the side panel lists. Several of them are pages of one app (Stock Manager), so
// they share its trial, status and access: adding any of them adds that app.
export type Tile = { id: string; app: string; name: string; href: string; art?: 'sales' | 'inventory' | 'megaphone' | 'service' | 'sanakhat' | 'ai' };

const STOCK: Tile[] = [
  { id: 'sales', app: 'stock', name: 'Sales', href: '/app/stock/sales', art: 'sales' },
  { id: 'inventory', app: 'stock', name: 'Inventory', href: '/app/stock/inventory', art: 'inventory' },
  { id: 'service', app: 'stock', name: 'Service', href: '/app/stock/jobs', art: 'service' },
  { id: 'sanakhat', app: 'stock', name: 'Sanakhat', href: '/app/stock/sanakhat', art: 'sanakhat' },
  { id: 'ai', app: 'stock', name: 'AI Assistant', href: '/app/stock/ai', art: 'ai' },
];
// the side panel's order
const ORDER = ['attendance', 'sales', 'inventory', 'marketing', 'service', 'finance', 'sanakhat', 'ai'];
const HOME: Record<string, string> = { attendance: '/app/attendance', finance: '/app/finance/company-dashboard', marketing: '/app/marketing' };

export function tilesFor(services: { key: string; name: string }[], kind: BusinessKind | null = null): Tile[] {
  const tiles = services.flatMap((svc): Tile[] => {
    if (svc.key !== 'stock') return [{ id: svc.key, app: svc.key, name: svc.name, href: HOME[svc.key] ?? `/app/${svc.key}`, art: svc.key === 'marketing' ? 'megaphone' : undefined }];
    // A business that does not deal in vehicles has general Items, and no job cards, warranty or Sanakhat
    if (kind !== 'general') return STOCK;
    return STOCK.filter((t) => t.id !== 'service' && t.id !== 'sanakhat').map((t) => (t.id === 'inventory' ? { ...t, name: 'Items', href: '/app/stock/items' } : t));
  });
  const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  return tiles.sort((a, b) => rank(a.id) - rank(b.id));
}
