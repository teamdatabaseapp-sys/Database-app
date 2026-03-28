/**
 * Supabase Client - Singleton instance
 *
 * This client is used for all Supabase operations including:
 * - Authentication (signUp, signIn, signOut)
 * - Database queries
 * - Row Level Security enforcement
 *
 * Environment variables required:
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const missingCredentials = !supabaseUrl || !supabaseAnonKey;

if (missingCredentials) {
  const message =
    '[Supabase] Missing environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.';
  if (__DEV__) {
    console.warn(message);
  } else {
    throw new Error(message);
  }
}

// Log at startup so you can verify in terminal (no secrets)
const isSupabaseCloud = typeof supabaseUrl === 'string' && supabaseUrl.includes('supabase.co');
console.log('[Supabase] URL:', isSupabaseCloud ? 'https://***.supabase.co' : supabaseUrl, '| anon key:', supabaseAnonKey ? 'set' : 'MISSING');

// Warn if URL is localhost — physical devices and some simulators cannot reach it
if (typeof supabaseUrl === 'string' && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(supabaseUrl)) {
  console.warn(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL points to localhost. The app may get "Network request failed" on a physical device or when the dev machine is unreachable. Use a public Supabase project URL (https://xxx.supabase.co) or expose your local URL (e.g. ngrok) for device testing.'
  );
}

/**
 * Custom fetch with retry logic for transient network failures.
 * React Native can have intermittent network issues, especially on app startup.
 */
const fetchWithRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on network errors, not on other types of errors
      const isNetworkError =
        lastError.message.includes('Network request failed') ||
        lastError.message.includes('Failed to fetch') ||
        lastError.message.includes('network') ||
        lastError.message.includes('ECONNREFUSED');

      if (!isNetworkError || attempt === maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      console.log(
        `[Supabase] Network request failed, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

const clientOptions = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Not needed for React Native
  },
  global: {
    fetch: fetchWithRetry,
  },
};

/**
 * Singleton Supabase client with React Native AsyncStorage for session persistence.
 * Session is automatically persisted and restored on app reload.
 * Includes retry logic for transient network failures.
 *
 * In development: null when credentials are missing — all auth calls become no-ops via getSupabase().
 * In production: throws at module load if credentials are missing (fast fail, enforced above).
 */
export const supabase = missingCredentials
  ? null
  : createClient(supabaseUrl as string, supabaseAnonKey as string, clientOptions);

/**
 * Non-null accessor for the Supabase client.
 * Throws a clear error if credentials are not configured.
 * Use this in all service/hook code instead of accessing `supabase` directly.
 */
export function getSupabase() {
  if (!supabase) {
    throw new Error(
      '[Supabase] Client is not initialized. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

/**
 * Database types for TypeScript support
 * These should match your Supabase table schemas
 */
export interface Profile {
  id: string; // UUID, references auth.users.id
  business_name: string | null;
  email: string | null;
  membership_plan: string | null;
  membership_status: string | null;
  created_at: string;
  // Server-backed trial entitlement fields
  trial_started_at: string | null; // ISO timestamp, NULL = trial not yet started
  trial_end_at: string | null;     // ISO timestamp, NULL = trial not yet started
  trial_active: boolean;           // false when trial_end_at < now (maintained by DB trigger)
}

export type { User as SupabaseUser, Session } from '@supabase/supabase-js';
