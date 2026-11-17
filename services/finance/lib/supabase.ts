// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { SecureAuthStorage } from './utils/secureAuthStorage';
import type { Database } from '../types/database.types';

// Inside AIBIZTECH the portal serves /finance-config.js, which sets window.__ENV from its own environment, so no key is baked
// into the build. A stand-alone build (phones, local dev) still reads the EXPO_PUBLIC values.
const injected = (typeof window !== 'undefined' ? (window as unknown as { __ENV?: { url?: string; key?: string } }).__ENV : undefined) ?? {};
const supabaseUrl = injected.url || process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = injected.key || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to your .env file.'
  );
}

// Pinned explicitly (rather than left to supabase-js's internal default)
// so useAuth.ts's signOut can force-clear this exact key itself as a
// belt-and-suspenders local wipe, without guessing at or depending on the
// library's internal key-naming scheme.
export const AUTH_STORAGE_KEY = 'store-books-auth-token';

// On the web the app is served by the portal and shares its sign-in (the same cookies, same Supabase project), so there is
// no separate login. Phones keep the stand-alone client.
const embedded = Platform.OS === 'web';

export const supabase = (embedded
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, { db: { schema: 'finance' }, cookieOptions: { path: '/', sameSite: 'lax' } })
  : createClient<Database>(supabaseUrl, supabaseAnonKey, {
      // This app's tables live in the `finance` schema of the shared AI Biz Tech Nepal platform database. The generated
      // Database type only knows `public`, hence the cast.
      db: { schema: 'finance' as 'public' },
      auth: {
        storage: SecureAuthStorage,
        storageKey: AUTH_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })) as unknown as ReturnType<typeof createClient<Database>>;

/** Where the portal lives: sign-in and sign-out happen there. */
export const PORTAL_URL = '/';
