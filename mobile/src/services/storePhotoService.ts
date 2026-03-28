/**
 * Store Photo Service
 *
 * Premium, performance-first photo upload for stores.
 * Handles validation, on-device compression, and backend storage.
 *
 * Features:
 * - File type validation (jpg, jpeg, png, heic, webp)
 * - Web-safe validation (handles data: and blob: URIs from Expo Web)
 * - Size validation (max 10MB original)
 * - On-device compression:
 *   - Full image: 512px, JPEG, 200-350KB target
 *   - Thumbnail: 128px, JPEG, ~30KB
 * - Backend storage via Vibecode Storage
 * - Graceful old file cleanup
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// ============================================
// Backend URL helper (same pattern as appointmentsService)
// ============================================
const getBackendUrl = (): string => {
  return (
    process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
};

// ============================================
// Types
// ============================================

export interface StorePhotoResult {
  success: boolean;
  error?: string;
  photoUrl?: string; // Full image URL
  photoThumbUrl?: string; // Thumbnail URL
}

export interface PhotoValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface CompressedImage {
  uri: string;
  size: number;
  width: number;
  height: number;
}

// ============================================
// Constants
// ============================================

const MAX_ORIGINAL_SIZE = 10 * 1024 * 1024; // 10MB
const FULL_IMAGE_MAX_DIMENSION = 512; // Max 512x512 per requirements
const THUMB_MAX_DIMENSION = 128;

// Compression settings - target max 300KB per requirements
const FULL_QUALITY_PASS1 = 0.75;
const FULL_QUALITY_PASS2 = 0.60;
const FULL_TARGET_SIZE = 300 * 1024; // 300KB max per requirements
const FULL_HARD_CAP = 300 * 1024; // Hard cap at 300KB
const THUMB_QUALITY = 0.60;

// Valid file extensions (lowercase)
const VALID_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'webp'];

// ============================================
// URI helpers — web-safe
// ============================================

/**
 * Detect if URI is a web data: URI (Expo Web returns these from image picker)
 */
function isDataUri(uri: string): boolean {
  return uri.startsWith('data:');
}

/**
 * Detect if URI is a blob: URI (Expo Web may return these)
 */
function isBlobUri(uri: string): boolean {
  return uri.startsWith('blob:');
}

/**
 * Extract MIME type from a data: URI
 * e.g. "data:image/jpeg;base64,..." → "image/jpeg"
 */
function getMimeFromDataUri(uri: string): string {
  const match = uri.match(/^data:([^;,]+)/);
  return match ? match[1] : 'image/jpeg';
}

/**
 * Get file extension from URI — robust for file://, http://, data:, and blob: URIs
 */
function getFileExtension(uri: string): string {
  if (isDataUri(uri)) {
    const mime = getMimeFromDataUri(uri);
    switch (mime) {
      case 'image/jpeg': return 'jpeg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      case 'image/heic': return 'heic';
      default: return 'jpeg';
    }
  }
  if (isBlobUri(uri)) {
    // blob: URIs have no extension — assume jpeg (will be validated by ImageManipulator)
    return 'jpeg';
  }
  // Regular file or http URI
  const parts = uri.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase().split('?')[0];
}

/**
 * Get MIME type from URI
 */
function getMimeType(uri: string): string {
  if (isDataUri(uri)) return getMimeFromDataUri(uri);
  const ext = getFileExtension(uri);
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

/**
 * Get file size for any URI type (web-safe)
 * Returns null if size cannot be determined.
 */
async function getUriFileSize(uri: string): Promise<number | null> {
  // data: URIs — compute from base64 length
  if (isDataUri(uri)) {
    try {
      const base64Match = uri.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        // Base64 encoded size ≈ (length * 3) / 4
        const approxSize = Math.floor((base64Match[1].length * 3) / 4);
        return approxSize;
      }
      // data: without base64 — unknown size
      return null;
    } catch {
      return null;
    }
  }

  // blob: URIs — FileSystem.getInfoAsync does not work on web for blob URIs
  if (isBlobUri(uri)) {
    return null; // We'll skip size check for blob URIs
  }

  // Regular file:// or cached URI — use FileSystem
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
    if (fileInfo.exists) {
      return (fileInfo as { size?: number }).size ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate the photo before processing
 */
export async function validatePhoto(uri: string): Promise<PhotoValidationResult> {
  try {
    // Determine extension/type
    const ext = getFileExtension(uri);

    // For non-data/non-blob URIs, validate extension
    if (!isDataUri(uri) && !isBlobUri(uri)) {
      if (!VALID_EXTENSIONS.includes(ext)) {
        return {
          valid: false,
          error: 'Unsupported file type. Please use JPG, PNG, or HEIC.',
        };
      }
    }

    // For data URIs, validate MIME type
    if (isDataUri(uri)) {
      const mime = getMimeFromDataUri(uri);
      const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
      if (!validMimes.includes(mime)) {
        return {
          valid: false,
          error: 'Unsupported file type. Please use JPG, PNG, or WEBP.',
        };
      }
    }

    // Check file exists (only for file:// URIs — web URIs don't need this check)
    if (!isDataUri(uri) && !isBlobUri(uri)) {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        return {
          valid: false,
          error: 'Image file not found.',
        };
      }
    }

    // Get file size
    const fileSize = await getUriFileSize(uri);

    // Check file size if we could determine it
    if (fileSize !== null && fileSize > MAX_ORIGINAL_SIZE) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${Math.round(MAX_ORIGINAL_SIZE / 1024 / 1024)}MB.`,
      };
    }

    return {
      valid: true,
      mimeType: getMimeType(uri),
      fileSize: fileSize ?? 0,
    };
  } catch (err) {
    console.log('[StorePhotoService] Validation error:', err);
    return {
      valid: false,
      error: 'Failed to validate image.',
    };
  }
}

// ============================================
// Compression Functions
// ============================================

/**
 * Compress image to target size with quality adjustments.
 * Uses width-only resize to preserve aspect ratio.
 */
async function compressImage(
  uri: string,
  maxDimension: number,
  quality: number
): Promise<CompressedImage> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    // Use width only — preserves aspect ratio (avoids distortion on non-square images)
    [{ resize: { width: maxDimension } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  // Get the actual file size — web-safe
  let size = 0;
  if (Platform.OS !== 'web') {
    const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
    size = fileInfo.exists ? ((fileInfo as { size?: number }).size ?? 0) : 0;
  }
  // On web, ImageManipulator returns a data: URI — estimate size from base64
  if (Platform.OS === 'web' && isDataUri(result.uri)) {
    const approx = await getUriFileSize(result.uri);
    size = approx ?? 0;
  }

  return {
    uri: result.uri,
    size,
    width: result.width,
    height: result.height,
  };
}

/**
 * Generate full-size image with two-pass compression if needed
 */
export async function generateFullImage(uri: string): Promise<CompressedImage | { error: string }> {
  const isDev = __DEV__;

  // Pass 1: Compress with primary quality
  if (isDev) console.log('[StorePhotoService] Compressing full image (pass 1)...');
  const pass1 = await compressImage(uri, FULL_IMAGE_MAX_DIMENSION, FULL_QUALITY_PASS1);

  if (isDev) {
    console.log('[StorePhotoService] Pass 1 result:', {
      size: `${(pass1.size / 1024).toFixed(1)}KB`,
      dimensions: `${pass1.width}x${pass1.height}`,
    });
  }

  // Check if pass 1 is within target
  // On web, size estimation may be 0 — skip size gate and proceed
  if (pass1.size === 0 || pass1.size <= FULL_TARGET_SIZE) {
    return pass1;
  }

  // Pass 2: Re-compress with lower quality
  if (isDev) console.log('[StorePhotoService] Pass 1 too large, running pass 2...');
  const pass2 = await compressImage(pass1.uri, FULL_IMAGE_MAX_DIMENSION, FULL_QUALITY_PASS2);

  if (isDev) {
    console.log('[StorePhotoService] Pass 2 result:', {
      size: `${(pass2.size / 1024).toFixed(1)}KB`,
      dimensions: `${pass2.width}x${pass2.height}`,
    });
  }

  // Check hard cap — skip on web (size may be 0)
  if (pass2.size > 0 && pass2.size > FULL_HARD_CAP) {
    return {
      error: 'Image is still too large after compression. Please choose a smaller photo.',
    };
  }

  return pass2;
}

/**
 * Generate thumbnail image
 */
export async function generateThumbnail(uri: string): Promise<CompressedImage> {
  const isDev = __DEV__;

  if (isDev) console.log('[StorePhotoService] Generating thumbnail...');
  const thumb = await compressImage(uri, THUMB_MAX_DIMENSION, THUMB_QUALITY);

  if (isDev) {
    console.log('[StorePhotoService] Thumbnail result:', {
      size: `${(thumb.size / 1024).toFixed(1)}KB`,
      dimensions: `${thumb.width}x${thumb.height}`,
    });
  }

  return thumb;
}

// ============================================
// Storage Functions (via backend — avoids Supabase bucket permission issues)
// ============================================

/**
 * Upload a compressed image file to backend Vibecode Storage.
 * Web-safe: handles both file:// URIs (native) and data: URIs (web).
 */
async function uploadToBackend(
  fileUri: string,
  businessId: string,
  storeId: string,
  variant: 'full' | 'thumb'
): Promise<{ url: string } | { error: string }> {
  try {
    const suffix = variant === 'thumb' ? '_thumb' : '';
    const filename = `store_${businessId}_${storeId}${suffix}.jpg`;

    const backendUrl = getBackendUrl();
    console.log('[StorePhotoService] Uploading to backend:', {
      variant,
      filename,
      storeId,
      businessId,
      isWeb: Platform.OS === 'web',
      backendUrl,
    });

    if (Platform.OS === 'web' && isDataUri(fileUri)) {
      // Web: convert data URI to Blob and upload directly
      const response = await uploadDataUriToBackend(fileUri, filename, businessId, storeId, variant);
      return response;
    }

    // Native: React Native FormData native file append — use { uri, type, name } directly.
    // Never use new Blob([Uint8Array]) in RN; that constructor is unsupported.
    const formData = new FormData();
    formData.append('file', { uri: fileUri, type: 'image/jpeg', name: filename } as unknown as Blob);
    formData.append('businessId', businessId);
    formData.append('storeId', storeId);
    formData.append('variant', variant);

    console.log('[StorePhotoService] Sending FormData to backend:', {
      storeId,
      businessId,
      variant,
      endpoint: `${backendUrl}/api/storage/upload-store-photo`,
    });

    const fetchResponse = await fetch(`${backendUrl}/api/storage/upload-store-photo`, {
      method: 'POST',
      body: formData,
    });

    console.log('[StorePhotoService] Backend response status:', fetchResponse.status, 'for storeId:', storeId);

    if (!fetchResponse.ok) {
      const err = await fetchResponse.json().catch(() => ({ error: `HTTP ${fetchResponse.status}` })) as { error?: string; request_id?: string };
      const errMsg = err.error || `Upload failed (${fetchResponse.status})`;
      const reqId = err.request_id ? ` [req:${err.request_id}]` : '';
      console.error('[StorePhotoService] Backend upload error:', {
        storeId,
        businessId,
        status: fetchResponse.status,
        error: errMsg + reqId,
      });
      return { error: mapBackendError(errMsg, fetchResponse.status) };
    }

    const result = await fetchResponse.json() as {
      success: boolean;
      url?: string;
      publicUrl?: string;
      photoUrl?: string;
      error?: string;
      request_id?: string;
    };

    const resolvedUrl = result.publicUrl || result.photoUrl || result.url;
    if (!result.success || !resolvedUrl) {
      const errMsg = result.error || 'Upload failed — no URL returned';
      const reqId = result.request_id ? ` [req:${result.request_id}]` : '';
      console.error('[StorePhotoService] Backend returned failure:', {
        storeId,
        businessId,
        error: errMsg + reqId,
      });
      return { error: mapBackendError(errMsg, 0) };
    }

    console.log('[StorePhotoService] Upload success for storeId:', storeId, 'url:', resolvedUrl);
    return { url: resolvedUrl };
  } catch (err) {
    console.error('[StorePhotoService] Upload exception for storeId:', storeId, err);
    const errStr = String(err).toLowerCase();
    if (errStr.includes('network') || errStr.includes('fetch') || errStr.includes('connection')) {
      return { error: 'Network error. Please check your connection and try again.' };
    }
    return { error: `Upload exception: ${String(err)}` };
  }
}

/**
 * Upload a data: URI as a Blob on web platforms
 */
async function uploadDataUriToBackend(
  dataUri: string,
  filename: string,
  businessId: string,
  storeId: string,
  variant: 'full' | 'thumb'
): Promise<{ url: string } | { error: string }> {
  try {
    // Convert data URI to Blob
    const res = await fetch(dataUri);
    const blob = await res.blob();

    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('businessId', businessId);
    formData.append('storeId', storeId);
    formData.append('variant', variant);

    const backendUrl = getBackendUrl();
    const fetchResponse = await fetch(`${backendUrl}/api/storage/upload-store-photo`, {
      method: 'POST',
      body: formData,
    });

    if (!fetchResponse.ok) {
      const err = await fetchResponse.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
      const errMsg = err.error || `Upload failed (${fetchResponse.status})`;
      console.log('[StorePhotoService] Web backend upload error:', errMsg);
      return { error: mapBackendError(errMsg, fetchResponse.status) };
    }

    const result = await fetchResponse.json() as {
      success: boolean;
      url?: string;
      publicUrl?: string;
      photoUrl?: string;
      error?: string;
      request_id?: string;
    };

    const resolvedUrl = result.publicUrl || result.photoUrl || result.url;
    if (!result.success || !resolvedUrl) {
      const errMsg = result.error || 'Upload failed — no URL returned';
      console.log('[StorePhotoService] Web backend error:', errMsg);
      return { error: mapBackendError(errMsg, 0) };
    }

    return { url: resolvedUrl };
  } catch (err) {
    console.log('[StorePhotoService] Web upload exception:', err);
    const errStr = String(err).toLowerCase();
    if (errStr.includes('network') || errStr.includes('fetch') || errStr.includes('connection')) {
      return { error: 'Network error. Please check your connection and try again.' };
    }
    return { error: 'Failed to upload image. Please try again.' };
  }
}

/**
 * Map backend error responses to user-friendly messages
 */
function mapBackendError(errMsg: string, statusCode: number): string {
  const e = errMsg.toLowerCase();

  if (statusCode === 429 || e.includes('too many uploads') || e.includes('rate limit')) {
    return 'Too many uploads. Please wait a moment and try again.';
  }
  if (e.includes('file too large') || e.includes('max 5mb') || e.includes('5mb')) {
    return 'File too large. Maximum size is 5MB.';
  }
  if (e.includes('unsupported file type') || e.includes('invalid file type') || e.includes('jpeg, png, or webp')) {
    return 'Unsupported file type. Use JPG, PNG, or WEBP.';
  }
  if (e.includes('empty file')) {
    return 'The selected image is empty or corrupt. Please choose a different photo.';
  }
  if (e.includes('invalid or corrupt') || e.includes('could not read image')) {
    return 'Image appears to be corrupt. Please choose a different photo.';
  }
  // Check storage service errors before generic 502/500
  if (statusCode === 502 || e.includes('storage service') || e.includes('storage error')) {
    return 'Upload failed (Storage error). Please try again.';
  }
  if (statusCode >= 500 || e.includes('internal') || e.includes('server error') || e.includes('upload failed (step')) {
    // Include the raw error details to help with debugging
    const detail = errMsg.length < 120 ? ` (${errMsg})` : '';
    return `Upload failed (Server error)${detail}. Please try again.`;
  }
  if (e.includes('network') || e.includes('connection') || e.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  return `Upload failed. Please try again.`;
}

/**
 * Delete old files from storage (best-effort, non-blocking)
 * No-op since Vibecode Storage files are managed by file ID, not path.
 */
async function deleteOldFiles(_paths: string[]): Promise<void> {
  // Old Supabase URLs can't be deleted via path with Vibecode Storage.
  // The new upload upserts by filename, so old files are naturally replaced.
  console.log('[StorePhotoService] Old file cleanup skipped (Vibecode Storage — replaced by upsert)');
}

/**
 * Upload with retry — retries up to maxAttempts times on transient errors.
 * Retries on: network errors, 5xx server errors, timeouts.
 * Does NOT retry on: 4xx client errors (validation, file too large, etc.)
 */
async function uploadToBackendWithRetry(
  fileUri: string,
  businessId: string,
  storeId: string,
  variant: 'full' | 'thumb',
  maxAttempts = 3
): Promise<{ url: string } | { error: string }> {
  let lastError = 'Upload failed';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      // Brief delay before retry (exponential backoff: 1s, 2s)
      const delayMs = attempt * 1000;
      console.log(`[StorePhotoService] Retry attempt ${attempt}/${maxAttempts} for storeId=${storeId} after ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    const result = await uploadToBackend(fileUri, businessId, storeId, variant);

    if (!('error' in result)) {
      // Success
      if (attempt > 1) {
        console.log(`[StorePhotoService] Upload succeeded on attempt ${attempt} for storeId=${storeId}`);
      }
      return result;
    }

    lastError = result.error;

    // Don't retry on client errors (not transient)
    const isClientError = (
      lastError.includes('Unsupported file type') ||
      lastError.includes('File too large') ||
      lastError.includes('corrupt') ||
      lastError.includes('Too many uploads') ||
      lastError.includes('empty or corrupt')
    );

    if (isClientError) {
      console.log(`[StorePhotoService] Client error (no retry): ${lastError}`);
      return result;
    }

    console.log(`[StorePhotoService] Transient error on attempt ${attempt}/${maxAttempts}: ${lastError}`);
  }

  console.error(`[StorePhotoService] All ${maxAttempts} upload attempts failed for storeId=${storeId}. Last error: ${lastError}`);
  return { error: lastError };
}

/**
 * Extract storage path from public URL (kept for backwards compat)
 */
function extractPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const match = url.match(/store-photos\/(.+?)(?:\?|$)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ============================================
// Main Upload Function
// ============================================

/**
 * Upload store photo with full processing pipeline
 *
 * @param businessId - Business UUID
 * @param storeId - Store UUID
 * @param imageUri - Local image URI from picker (file://, data:, or blob: URI)
 * @param existingPhotoUrl - Current photo URL (for cleanup)
 * @param existingThumbUrl - Current thumb URL (for cleanup)
 */
export async function uploadStorePhoto(
  businessId: string,
  storeId: string,
  imageUri: string,
  existingPhotoUrl?: string | null,
  existingThumbUrl?: string | null
): Promise<StorePhotoResult> {
  const isDev = __DEV__;

  if (isDev) {
    console.log('[StorePhotoService] ===== UPLOAD START =====');
    console.log('[StorePhotoService] businessId:', businessId);
    console.log('[StorePhotoService] storeId:', storeId);
    console.log('[StorePhotoService] platform:', Platform.OS);
    console.log('[StorePhotoService] uriType:', isDataUri(imageUri) ? 'data:' : isBlobUri(imageUri) ? 'blob:' : 'file');
    console.log('[StorePhotoService] imageUri preview:', imageUri.substring(0, 80));
  }

  try {
    // Step 1: Validate
    const validation = await validatePhoto(imageUri);
    if (!validation.valid) {
      console.log('[StorePhotoService] Validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    if (isDev) {
      console.log('[StorePhotoService] Validation passed:', {
        mimeType: validation.mimeType,
        originalSize: `${((validation.fileSize || 0) / 1024).toFixed(1)}KB`,
      });
    }

    // Step 2: Generate full image (compress)
    const fullResult = await generateFullImage(imageUri);
    if ('error' in fullResult) {
      console.log('[StorePhotoService] Full image generation failed:', fullResult.error);
      return { success: false, error: fullResult.error };
    }

    // Step 3: Generate thumbnail
    const thumbResult = await generateThumbnail(imageUri);

    if (isDev) {
      console.log('[StorePhotoService] Compression complete:', {
        fullSize: `${(fullResult.size / 1024).toFixed(1)}KB`,
        fullDimensions: `${fullResult.width}x${fullResult.height}`,
        thumbSize: `${(thumbResult.size / 1024).toFixed(1)}KB`,
        thumbDimensions: `${thumbResult.width}x${thumbResult.height}`,
      });
    }

    // Step 4: Upload full image via backend (with retry for transient errors)
    console.log('[StorePhotoService] Uploading full image for storeId:', storeId);
    const fullUpload = await uploadToBackendWithRetry(fullResult.uri, businessId, storeId, 'full');
    if ('error' in fullUpload) {
      console.error('[StorePhotoService] Full image upload failed for storeId:', storeId, fullUpload.error);
      return { success: false, error: fullUpload.error };
    }

    // Step 5: Upload thumbnail via backend (with retry for transient errors)
    console.log('[StorePhotoService] Uploading thumbnail for storeId:', storeId);
    const thumbUpload = await uploadToBackendWithRetry(thumbResult.uri, businessId, storeId, 'thumb');
    if ('error' in thumbUpload) {
      console.error('[StorePhotoService] Thumbnail upload failed for storeId:', storeId, thumbUpload.error);
      return { success: false, error: thumbUpload.error };
    }

    if (isDev) {
      console.log('[StorePhotoService] Upload complete:', {
        photoUrl: fullUpload.url,
        photoThumbUrl: thumbUpload.url,
      });
    }

    // Step 6: Cleanup old files (best-effort, async)
    const oldPaths: string[] = [];
    const oldPhotoPath = extractPathFromUrl(existingPhotoUrl);
    const oldThumbPath = extractPathFromUrl(existingThumbUrl);
    if (oldPhotoPath) oldPaths.push(oldPhotoPath);
    if (oldThumbPath) oldPaths.push(oldThumbPath);

    if (oldPaths.length > 0) {
      // Don't await - cleanup is best-effort
      deleteOldFiles(oldPaths);
    }

    console.log('[StorePhotoService] ===== UPLOAD SUCCESS =====');

    return {
      success: true,
      photoUrl: fullUpload.url,
      photoThumbUrl: thumbUpload.url,
    };
  } catch (err) {
    console.log('[StorePhotoService] Unexpected error:', err);
    const errStr = String(err).toLowerCase();
    if (errStr.includes('network') || errStr.includes('fetch') || errStr.includes('connection')) {
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
    return {
      success: false,
      error: 'Failed to upload photo. Please try again.',
    };
  }
}

/**
 * Remove store photo from storage and clear URLs
 *
 * @param photoUrl - Current photo URL
 * @param thumbUrl - Current thumb URL
 */
export async function removeStorePhoto(
  _photoUrl?: string | null,
  _thumbUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  // Vibecode Storage files are replaced by upsert on next upload.
  // No deletion needed here — just return success.
  return { success: true };
}
