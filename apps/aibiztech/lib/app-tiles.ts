import type { BusinessKind } from './business-kind';

// The tiles on Add apps are the modules the side panel lists. Several of them are pages of one app (Stock Manager), so
// they share its trial, status and access: adding any of them adds that app.
export type Tile = { id: string; app: string; name: string; href: string; art?: 'sales' | 'inventory' | 'marketing' | 'service' | 'sanakhat' | 'ai' };

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
    if (svc.key !== 'stock') return [{ id: svc.key, app: svc.key, name: svc.name, href: HOME[svc.key] ?? `/app/${svc.key}`, art: svc.key === 'marketing' ? 'marketing' : undefined }];
    // A business that does not deal in vehicles has general Items, and no job cards, warranty or Sanakhat
    if (kind !== 'general') return STOCK;
    return STOCK.filter((t) => t.id !== 'service' && t.id !== 'sanakhat').map((t) => (t.id === 'inventory' ? { ...t, name: 'Items', href: '/app/stock/items' } : t));
  });
  const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  return tiles.sort((a, b) => rank(a.id) - rank(b.id));
}

// A person manages a tile when they can open its app. A vehicle business's Marketing and Finance are also pages of
// Stock Manager, so having Stock Manager is enough for those.
export function manages(tile: Tile, apps: Set<string>, kind: BusinessKind | null): boolean {
  return apps.has(tile.app) || (apps.has('stock') && (tile.id === 'marketing' || (tile.id === 'finance' && kind === 'auto')));
}

// What saving the ticks does: which apps to add, and which modules the business now leaves out of its side panel.
// Tiles the person cannot manage keep the business's earlier choice; a tile that needs a plan cannot be changed.
export function planModules({ tiles, access, closed, kind, ticked, hidden }: {
  tiles: Tile[]; access: string[]; closed: string[]; kind: BusinessKind | null; ticked: string[]; hidden: string[];
}): { add: string[]; hidden: string[] } {
  const have = new Set(access);
  const open = (t: Tile) => !closed.includes(t.app) || manages(t, have, kind);
  const on = new Set(ticked);
  const add = [...new Set(tiles.filter((t) => on.has(t.id) && open(t) && !manages(t, have, kind)).map((t) => t.app))];
  const after = new Set([...access, ...add]);
  const next = new Set(hidden);
  for (const t of tiles) {
    if (!open(t) || !manages(t, after, kind)) continue;
    if (on.has(t.id)) next.delete(t.id); else next.add(t.id);
  }
  return { add, hidden: [...next].sort() };
}

// Stock Manager's menu entries, by the tile that switches each one. Anything not named here always shows.
const MENU_TILE: Record<string, string> = {
  sales: 'sales', inventory: 'inventory', items: 'inventory', 'spare-parts': 'inventory', marketing: 'marketing',
  service: 'service', jobs: 'service', warranty: 'service', finance: 'finance', sanakhat: 'sanakhat', ai: 'ai',
};
export const menuShown = (key: string, hidden: string[]) => !hidden.includes(MENU_TILE[key] ?? '');
