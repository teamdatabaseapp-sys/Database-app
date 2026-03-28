/**
 * Business Branding Service
 *
 * Handles all operations for business branding:
 * - Logo upload/update/remove
 * - Brand colors management
 * - Fetching branding for public booking pages
 *
 * Logo uploads go via the hardened backend proxy (/api/storage/upload-business-logo).
 * NO direct Supabase Storage uploads. NO Blob/ArrayBuffer conversions (Hermes-safe).
 * Backend handles: sharp decode, EXIF strip, resize (2000px full / 512px thumb), DB write.
 */

import { getSupabase } from '@/lib/supabaseClient';
import * as FileSystem from 'expo-file-system';

// ============================================
// Types
// ============================================

export interface BusinessBranding {
  logo_path: string | null;
  logo_url: string | null;
  brand_primary_color: string;
  brand_secondary_color: string | null;
  brand_updated_at: string;
}

export interface BusinessBrandingUpdate {
  brand_primary_color?: string;
  brand_secondary_color?: string | null;
}

export interface BrandingResult<T> {
  data: T | null;
  error: Error | null;
}

// Default brand colors
export const DEFAULT_PRIMARY_COLOR = '#0F8F83';
export const DEFAULT_SECONDARY_COLOR = null;

// Logo size variants to generate
const LOGO_SIZES = [512, 256, 128] as const;

// Storage bucket name
const LOGO_BUCKET = 'business-logos';

// Cache for branding data (simple in-memory cache)
const brandingCache = new Map<string, { data: BusinessBranding; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// Branding Data Operations
// ============================================

/**
 * Get business branding for a business
 * Uses caching to avoid repeated DB calls
 * Fetches branding columns from Supabase: logo_path, logo_url, brand_primary_color, brand_secondary_color, brand_updated_at
 */
export async function getBusinessBranding(
  businessId: string
): Promise<BrandingResult<BusinessBranding>> {
  try {
    console.log('[BusinessBrandingService] getBusinessBranding:', { businessId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    // Check cache first
    const cached = brandingCache.get(businessId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[BusinessBrandingService] Using cached branding');
      return { data: cached.data, error: null };
    }

    // Fetch branding columns from Supabase
    const { data, error } = await getSupabase()
      .from('businesses')
      .select('logo_path, logo_url, brand_primary_color, brand_secondary_color, brand_updated_at')
      .eq('id', businessId)
      .single();

    if (error) {
      console.log('[BusinessBrandingService] Error fetching business branding:', error.message);
      return { data: null, error };
    }

    // Build branding object with defaults for any missing values
    const updatedAt = data?.brand_updated_at ?? new Date().toISOString();
    const cacheBust = data?.logo_url ? `?v=${new Date(updatedAt).getTime()}` : '';
    const branding: BusinessBranding = {
      logo_path: data?.logo_path ?? null,
      logo_url: data?.logo_url ? data.logo_url + cacheBust : null,
      brand_primary_color: data?.brand_primary_color ?? DEFAULT_PRIMARY_COLOR,
      brand_secondary_color: data?.brand_secondary_color ?? null,
      brand_updated_at: updatedAt,
    };

    // Update cache
    brandingCache.set(businessId, { data: branding, timestamp: Date.now() });

    console.log('[BusinessBrandingService] Branding fetched from Supabase');
    return { data: branding, error: null };
  } catch (err) {
    console.log('[BusinessBrandingService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch branding'),
    };
  }
}

/**
 * Update brand colors for a business
 * Persists changes to Supabase and updates local cache
 */
export async function updateBusinessBranding(
  businessId: string,
  updates: BusinessBrandingUpdate
): Promise<BrandingResult<BusinessBranding>> {
  try {
    console.log('[BusinessBrandingService] updateBusinessBranding:', { businessId, updates });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    // Validate colors
    if (updates.brand_primary_color && !isValidHexColor(updates.brand_primary_color)) {
      return { data: null, error: new Error('Invalid primary color format') };
    }

    if (updates.brand_secondary_color && !isValidHexColor(updates.brand_secondary_color)) {
      return { data: null, error: new Error('Invalid secondary color format') };
    }

    // Build update payload for Supabase
    const updatePayload: Record<string, string | null> = {
      brand_updated_at: new Date().toISOString(),
    };

    if (updates.brand_primary_color !== undefined) {
      updatePayload.brand_primary_color = updates.brand_primary_color;
    }

    if (updates.brand_secondary_color !== undefined) {
      updatePayload.brand_secondary_color = updates.brand_secondary_color;
    }

    // Update Supabase
    const { data, error } = await getSupabase()
      .from('businesses')
      .update(updatePayload)
      .eq('id', businessId)
      .select('logo_path, logo_url, brand_primary_color, brand_secondary_color, brand_updated_at')
      .single();

    if (error) {
      console.log('[BusinessBrandingService] Error updating branding:', error.message);
      return { data: null, error };
    }

    // Build branding object
    const branding: BusinessBranding = {
      logo_path: data?.logo_path ?? null,
      logo_url: data?.logo_url ?? null,
      brand_primary_color: data?.brand_primary_color ?? DEFAULT_PRIMARY_COLOR,
      brand_secondary_color: data?.brand_secondary_color ?? null,
      brand_updated_at: data?.brand_updated_at ?? new Date().toISOString(),
    };

    // Update cache
    brandingCache.set(businessId, { data: branding, timestamp: Date.now() });

    console.log('[BusinessBrandingService] Branding updated in Supabase');
    return { data: branding, error: null };
  } catch (err) {
    console.log('[BusinessBrandingService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update branding'),
    };
  }
}

// ============================================
// Logo Upload Operations
// ============================================

// Valid image types for logo upload
const VALID_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — matches backend limit

/**
 * Get MIME type from file extension
 */
function getMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'image/png';
  }
}

/**
 * Validate image file type
 */
function isValidImageType(mimeType: string): boolean {
  return VALID_IMAGE_TYPES.includes(mimeType);
}

/**
 * Ensure the logo storage bucket exists via backend API
 */
async function ensureBucketExists(): Promise<{ success: boolean; error?: Error }> {
  try {
    const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
      process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl.replace(/\/$/, '')}/api/storage/ensure-bucket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json() as { success?: boolean; error?: string };
    if (!response.ok || !result.success) {
      return { success: false, error: new Error(result.error || 'Failed to setup storage') };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err : new Error('Failed to verify storage') };
  }
}

/**
 * Upload and process a business logo via the hardened backend proxy.
 * Backend handles: sharp decode, EXIF strip, resize (2000px full / 512px thumb), DB write.
 * NO ImageManipulator resizing here — backend does all processing.
 * Hermes-safe: uses { uri, type, name } FormData pattern, no Blob/ArrayBuffer.
 */
export async function uploadBusinessLogo(
  businessId: string,
  imageUri: string,
  assetMimeType?: string
): Promise<BrandingResult<BusinessBranding>> {
  try {
    console.log('[BusinessBrandingService] uploadBusinessLogo:', { businessId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }
    if (!imageUri) {
      return { data: null, error: new Error('No image provided') };
    }

    // Prefer the mime type reported by the image picker (more accurate for PNG transparency)
    const mimeType = assetMimeType?.toLowerCase() || getMimeType(imageUri);
    if (!isValidImageType(mimeType)) {
      return { data: null, error: new Error('Invalid image type. Please use PNG, JPG, or WebP.') };
    }

    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      return { data: null, error: new Error('Image file not found') };
    }
    if (fileInfo.size && fileInfo.size > MAX_FILE_SIZE) {
      return { data: null, error: new Error('Image must be under 5MB') };
    }

    const backendUrl = (
      process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
      process.env.EXPO_PUBLIC_BACKEND_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');

    // Hermes-safe FormData — { uri, type, name } pattern, no Blob/ArrayBuffer
    // Use actual mime type so the backend knows whether alpha is present
    const ext = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filename = ext === 'png' ? 'logo.png' : ext === 'webp' ? 'logo.webp' : 'logo.jpg';
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
    formData.append('businessId', businessId);

    console.log('[BusinessBrandingService] Uploading logo via backend proxy');

    const response = await fetch(`${backendUrl}/api/storage/upload-business-logo`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json() as {
      success: boolean;
      url?: string;
      thumbUrl?: string;
      error?: string;
      request_id?: string;
      step?: string;
    };

    console.log('[BusinessBrandingService] Backend response:', result);

    if (!response.ok || !result.success || !result.url) {
      const errMsg = result.error || 'Upload failed';
      const reqId = result.request_id ? ` [req:${result.request_id}]` : '';
      return { data: null, error: new Error(errMsg + reqId) };
    }

    // Backend already wrote logo_url + logo_path + brand_updated_at to DB.
    // Re-fetch to get the full branding object with cache-busted URL.
    const { data, error: fetchError } = await getSupabase()
      .from('businesses')
      .select('logo_path, logo_url, brand_primary_color, brand_secondary_color, brand_updated_at')
      .eq('id', businessId)
      .single();

    if (fetchError) {
      console.log('[BusinessBrandingService] Error re-fetching after upload:', fetchError.message);
      // Return what we know from the upload response
      const now = new Date().toISOString();
      const cacheBust = `?v=${Date.now()}`;
      const branding: BusinessBranding = {
        logo_path: `business/${businessId}/logo.png`,
        logo_url: result.url ? result.url + cacheBust : null,
        brand_primary_color: DEFAULT_PRIMARY_COLOR,
        brand_secondary_color: null,
        brand_updated_at: now,
      };
      brandingCache.set(businessId, { data: branding, timestamp: Date.now() });
      return { data: branding, error: null };
    }

    const updatedAt = data?.brand_updated_at ?? new Date().toISOString();
    const cacheBust = `?v=${new Date(updatedAt).getTime()}`;
    const branding: BusinessBranding = {
      logo_path: data?.logo_path ?? null,
      logo_url: data?.logo_url ? data.logo_url + cacheBust : null,
      brand_primary_color: data?.brand_primary_color ?? DEFAULT_PRIMARY_COLOR,
      brand_secondary_color: data?.brand_secondary_color ?? null,
      brand_updated_at: updatedAt,
    };

    // Update cache
    brandingCache.set(businessId, { data: branding, timestamp: Date.now() });

    console.log('[BusinessBrandingService] Logo uploaded and saved');
    return { data: branding, error: null };
  } catch (err) {
    console.log('[BusinessBrandingService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to upload logo'),
    };
  }
}

/**
 * Remove business logo
 * Deletes all size variants from storage and updates Supabase
 */
export async function removeBusinessLogo(
  businessId: string
): Promise<BrandingResult<BusinessBranding>> {
  try {
    console.log('[BusinessBrandingService] removeBusinessLogo:', { businessId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    // Delete all logo variants from storage
    const filesToDelete = LOGO_SIZES.map((size) => `${businessId}/logo_${size}.png`);

    const { error: deleteError } = await getSupabase().storage.from(LOGO_BUCKET).remove(filesToDelete);

    if (deleteError) {
      // Log but don't fail - files might not exist
      console.log('[BusinessBrandingService] Storage delete warning:', deleteError.message);
    }

    // Update Supabase businesses table to clear logo info
    const { data, error } = await getSupabase()
      .from('businesses')
      .update({
        logo_path: null,
        logo_url: null,
        brand_updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)
      .select('logo_path, logo_url, brand_primary_color, brand_secondary_color, brand_updated_at')
      .single();

    if (error) {
      console.log('[BusinessBrandingService] Error clearing logo in DB:', error.message);
      return { data: null, error };
    }

    // Build branding object
    const branding: BusinessBranding = {
      logo_path: data?.logo_path ?? null,
      logo_url: data?.logo_url ?? null,
      brand_primary_color: data?.brand_primary_color ?? DEFAULT_PRIMARY_COLOR,
      brand_secondary_color: data?.brand_secondary_color ?? null,
      brand_updated_at: data?.brand_updated_at ?? new Date().toISOString(),
    };

    // Update cache
    brandingCache.set(businessId, { data: branding, timestamp: Date.now() });

    console.log('[BusinessBrandingService] Logo removed and Supabase updated');
    return { data: branding, error: null };
  } catch (err) {
    console.log('[BusinessBrandingService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to remove logo'),
    };
  }
}

/**
 * Get the logo URL for a specific size
 */
export function getLogoUrl(businessId: string, size: 128 | 256 | 512 = 256): string {
  const { data } = getSupabase().storage.from(LOGO_BUCKET).getPublicUrl(`${businessId}/logo_${size}.png`);
  return data.publicUrl;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Validate hex color format
 */
function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);
}

/**
 * Clear branding cache for a business
 * Call this when branding is updated elsewhere
 */
export function clearBrandingCache(businessId?: string): void {
  if (businessId) {
    brandingCache.delete(businessId);
  } else {
    brandingCache.clear();
  }
}

// ============================================
// Public Booking Branding (for booking pages)
// ============================================

/**
 * Get branding for public booking page
 * This uses the get_public_booking_config function which is accessible to anon users
 */
export interface PublicBookingBranding {
  business_name: string;
  logo_url: string | null;
  brand_primary_color: string;
  brand_secondary_color: string | null;
}

export async function getPublicBookingBranding(
  identifier: string
): Promise<BrandingResult<PublicBookingBranding>> {
  try {
    console.log('[BusinessBrandingService] getPublicBookingBranding:', { identifier });

    const { data, error } = await getSupabase().rpc('get_public_booking_config', {
      p_identifier: identifier,
      p_locale: 'en',
    });

    if (error) {
      console.log('[BusinessBrandingService] RPC error:', error.message);
      return { data: null, error };
    }

    if (data?.error) {
      return { data: null, error: new Error(data.error) };
    }

    const branding: PublicBookingBranding = {
      business_name: data.business?.name || '',
      logo_url: data.business?.logo_url || null,
      brand_primary_color: data.business?.brand_primary_color || DEFAULT_PRIMARY_COLOR,
      brand_secondary_color: data.business?.brand_secondary_color || null,
    };

    console.log('[BusinessBrandingService] Public branding fetched');
    return { data: branding, error: null };
  } catch (err) {
    console.log('[BusinessBrandingService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch public branding'),
    };
  }
}

// ============================================
// Predefined Color Palette for Color Picker
// ============================================

export const BRAND_COLOR_PALETTE = [
  // Blues & Cyans
  { name: 'sky', hex: '#0EA5E9', nameKey: 'colorSky' },
  { name: 'blue', hex: '#2563EB', nameKey: 'colorBlue' },
  { name: 'navy', hex: '#1E3A8A', nameKey: 'colorNavy' },
  { name: 'cyan', hex: '#0891B2', nameKey: 'colorCyan' },
  // Greens & Teals
  { name: 'teal', hex: '#0F8F83', nameKey: 'colorTeal' },
  { name: 'emerald', hex: '#059669', nameKey: 'colorEmerald' },
  { name: 'green', hex: '#16A34A', nameKey: 'colorGreen' },
  { name: 'lime', hex: '#65A30D', nameKey: 'colorLime' },
  { name: 'sage', hex: '#4D7C5F', nameKey: 'colorSage' },
  // Purples & Violets
  { name: 'indigo', hex: '#4F46E5', nameKey: 'colorIndigo' },
  { name: 'violet', hex: '#7C3AED', nameKey: 'colorViolet' },
  { name: 'purple', hex: '#9333EA', nameKey: 'colorPurple' },
  { name: 'lavender', hex: '#818CF8', nameKey: 'colorLavender' },
  { name: 'plum', hex: '#6B21A8', nameKey: 'colorPlum' },
  // Pinks & Reds
  { name: 'fuchsia', hex: '#C026D3', nameKey: 'colorFuchsia' },
  { name: 'pink', hex: '#EC4899', nameKey: 'colorPink' },
  { name: 'coral', hex: '#F05252', nameKey: 'colorCoral' },
  { name: 'rose', hex: '#E11D48', nameKey: 'colorRose' },
  { name: 'red', hex: '#DC2626', nameKey: 'colorRed' },
  { name: 'crimson', hex: '#991B1B', nameKey: 'colorCrimson' },
  // Oranges & Yellows
  { name: 'orange', hex: '#EA580C', nameKey: 'colorOrange' },
  { name: 'peach', hex: '#F97316', nameKey: 'colorPeach' },
  { name: 'amber', hex: '#D97706', nameKey: 'colorAmber' },
  { name: 'gold', hex: '#B45309', nameKey: 'colorGold' },
  { name: 'yellow', hex: '#CA8A04', nameKey: 'colorYellow' },
  // Neutrals & Earthy
  { name: 'slate', hex: '#475569', nameKey: 'colorSlate' },
  { name: 'steel', hex: '#334155', nameKey: 'colorSteel' },
  { name: 'charcoal', hex: '#1F2937', nameKey: 'colorCharcoal' },
  { name: 'stone', hex: '#78716C', nameKey: 'colorStone' },
  { name: 'brown', hex: '#92400E', nameKey: 'colorBrown' },
] as const;
