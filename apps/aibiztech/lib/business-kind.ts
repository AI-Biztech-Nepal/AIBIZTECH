// What a business sells decides which Stock Manager and which Finance it gets.
//   auto      vehicle business: Stock Manager with the vehicle screens and its own (automobile) Finance
//   workshop  repair and service: general items, job cards and spare parts, and the general Finance
//   general   everyone else: general items and the general Finance
export const BUSINESS_TYPES = [
  { id: 'vehicles', label: 'Vehicle dealership' },
  { id: 'workshop', label: 'Repair and service workshop' },
  { id: 'retail', label: 'Retail or wholesale' },
  { id: 'services', label: 'Service or staffing company' },
  { id: 'other', label: 'Other' },
] as const;

export type BusinessKind = 'auto' | 'workshop' | 'general';

export const isBusinessType = (v: string) => BUSINESS_TYPES.some((t) => t.id === v);

// vehiclePack: the business's own "Vehicle pack" switch (core.org_features, stock.vehicles), null when never set.
// A switch someone set wins over the kind of business chosen at sign-up.
export function kindFrom(businessType: string | null | undefined, vehiclePack: boolean | null | undefined): BusinessKind {
  if (vehiclePack === true) return 'auto';
  if (vehiclePack !== false && businessType === 'vehicles') return 'auto';
  return businessType === 'workshop' ? 'workshop' : 'general';
}
