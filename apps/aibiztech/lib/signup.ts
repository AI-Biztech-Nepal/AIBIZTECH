import { EMAIL, PHONE } from './org-details.ts';

// Length of a new trial. Must match the default of core.org_services.trial_ends_at (see supabase/migrations).
export const TRIAL_DAYS = 7;

export type SignupField = 'full_name' | 'business_name' | 'email' | 'phone' | 'password' | 'confirm_password';
export type SignupValues = Record<SignupField, string>;
export type SignupState = { error?: string };

export const longEnough = (password: string) => password.length >= 8;
export const mixed = (password: string) => /[A-Za-z]/.test(password) && /\d/.test(password);

// The same rules in the browser and in the server action. Invited people join a business, so they name none.
export function validateSignup(v: SignupValues, invited: boolean): Partial<SignupValues> {
  const errors: Partial<SignupValues> = {};
  if (!v.full_name.trim()) errors.full_name = 'Enter your full name.';
  if (!invited && !v.business_name.trim()) errors.business_name = 'Enter your business name.';
  if (!EMAIL.test(v.email.trim())) errors.email = 'Enter an email like name@business.com.';
  if (!PHONE.test(v.phone.trim())) errors.phone = 'Enter a valid phone number (digits, optional + and dashes).';
  if (!longEnough(v.password) || !mixed(v.password)) errors.password = 'Use at least 8 characters, with letters and numbers.';
  if (!v.confirm_password) errors.confirm_password = 'Type the password again.';
  else if (v.password !== v.confirm_password) errors.confirm_password = 'Passwords do not match.';
  return errors;
}

// A trial starting now, as Nepal calendar dates: each of its days, and the day it ends
export function trialDates(now = new Date()) {
  const day = (offset: number, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'Asia/Kathmandu' }).format(new Date(now.getTime() + offset * 864e5)).replace(',', '');
  const full = { weekday: 'short', day: 'numeric', month: 'short' } as const;
  return {
    days: Array.from({ length: TRIAL_DAYS }, (_, i) => day(i, { weekday: 'short', day: 'numeric' })),
    start: day(0, full),
    end: day(TRIAL_DAYS, { ...full, year: 'numeric' }),
  };
}
