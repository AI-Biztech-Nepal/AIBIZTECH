// Required details for a new organization. The database enforces the same rules; this gives readable messages first.
export const FIELDS = ['name', 'address', 'phone', 'email', 'owner_name', 'owner_address', 'owner_phone', 'owner_email', 'pan_no'] as const;
export type Details = Record<(typeof FIELDS)[number], string>;

export const PHONE = /^\+?[0-9][0-9 -]{6,19}$/;
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const PAN = /^[0-9]{9}$/;
// Vercel rejects request bodies over 4.5 MB, so the photo stays under that
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateDetails(v: Details): string | null {
  for (const f of ['name', 'address', 'owner_name', 'owner_address'] as const) {
    if (!v[f]) return 'Fill in every required field.';
  }
  if (!PHONE.test(v.phone) || !PHONE.test(v.owner_phone)) return 'Enter valid phone numbers (digits, optional + and dashes).';
  if (!EMAIL.test(v.email) || !EMAIL.test(v.owner_email)) return 'Enter valid email addresses.';
  if (!PAN.test(v.pan_no)) return 'PAN must be exactly 9 digits.';
  return null;
}

export function validatePhoto(f: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.includes(f.type)) return 'PAN photo must be a JPG, PNG or WebP image.';
  if (f.size > MAX_PHOTO_BYTES) return 'PAN photo must be smaller than 4 MB.';
  return null;
}
