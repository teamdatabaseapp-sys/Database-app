import type { SupabaseClient } from '@/services/clientsService';
import type { Client } from '@/lib/types';

// Helper to convert SupabaseClient to Client type for legacy components
export function convertToLegacyClient(sc: SupabaseClient): Client {
  return {
    id: sc.id,
    userId: sc.business_id, // Use business_id as userId for compatibility
    name: sc.name,
    email: sc.email || '',
    phone: sc.phone || '',
    notes: sc.notes || '',
    visits: [],
    promotionCount: 0,
    tags: [],
    isArchived: false,
    createdAt: new Date(sc.created_at),
    updatedAt: new Date(sc.created_at),
  };
}

export const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
  { label: 'Custom', value: 0 },
];

// Helper to capitalize first letter
export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

// UUID validation — used before sending IDs to Supabase to avoid FK constraint errors
// When using Zustand staff fallback, staff_id may not be a valid UUID
export function isValidUUID(id: string | null): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
