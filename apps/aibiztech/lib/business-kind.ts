// What a business deals in decides which Stock Manager and which Finance it gets. No business is named here: every
// business is treated by what it has recorded about itself.
//   auto     automobile business (sales or workshop): the vehicle screens and Stock Manager's own (automobile) Finance
//   general  everyone else: general items and the general Finance
//   null     nothing recorded yet: the owner is asked, nobody is assumed
export const BUSINESS_TYPES = [
  { id: 'vehicles', label: 'Automobile sales (dealership, showroom, second-hand)' },
  { id: 'workshop', label: 'Automobile workshop or service centre' },
  { id: 'retail', label: 'Retail or wholesale' },
  { id: 'services', label: 'Service or staffing company' },
  { id: 'other', label: 'Other' },
] as const;

export type BusinessKind = 'auto' | 'general';

export const isBusinessType = (v: string) => BUSINESS_TYPES.some((t) => t.id === v);
const AUTOMOBILE = ['vehicles', 'workshop'];

export type VehicleMarks = {
  stockPack?: boolean | null; // the Vehicle pack switch (stock.vehicles); null when never set
  financePack?: boolean | null; // the Vehicle accounts switch (finance.vehicles)
  sellsVehicles?: boolean | null; // Finance's earlier "sells vehicles" setting
};

export function kindFrom(businessType: string | null | undefined, marks: VehicleMarks = {}): BusinessKind | null {
  if (marks.stockPack || marks.financePack) return 'auto'; // a switch someone turned on
  if (businessType) return AUTOMOBILE.includes(businessType) && marks.stockPack !== false ? 'auto' : 'general';
  if (marks.stockPack === false) return 'general';
  return marks.sellsVehicles ? 'auto' : null;
}
