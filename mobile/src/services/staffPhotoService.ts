/**
 * Staff Photo Service
 *
 * Uploads staff photos via the hardened backend proxy.
 * Uses React Native native FormData file append — NO Blob/ArrayBuffer conversions.
 * Backend handles: MIME validation, sharp decode, EXIF strip, resize, JPEG re-encode, DB write.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

// ============================================
// Backend URL helper
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

export interface StaffPhotoResult {
  success: boolean;
  error?: string;
  photoUrl?: string;
  avatarUrl?: string;
  avatarThumbUrl?: string;
  request_id?: string;
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
const FULL_IMAGE_MAX_DIMENSION = 512;
const THUMB_MAX_DIMENSION = 128;
const FULL_QUALITY_PASS1 = 0.75;
const FULL_QUALITY_PASS2 = 0.60;
const FULL_TARGET_SIZE = 300 * 1024;
const FULL_HARD_CAP = 300 * 1024;
const THUMB_QUALITY = 0.60;
const VALID_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic'];

// ============================================
// Validation
// ============================================

function getFileExtension(uri: string): string {
  const parts = uri.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase().split('?')[0];
}

function getMimeType(uri: string): string {
  const ext = getFileExtension(uri);
  switch (ext) {
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'heic': return 'image/heic';
    default: return 'image/jpeg';
  }
}

export async function validatePhoto(uri: string): Promise<PhotoValidationResult> {
  try {
    const ext = getFileExtension(uri);
    if (!VALID_EXTENSIONS.includes(ext)) {
      return { valid: false, error: 'Unsupported file type. Please use JPG, PNG, or HEIC.' };
    }
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { valid: false, error: 'Image file not found.' };
    }
    const fileSize = fileInfo.size || 0;
    if (fileSize > MAX_ORIGINAL_SIZE) {
      return { valid: false, error: 'Photo too large. Please choose an image under 10MB.' };
    }
    return { valid: true, mimeType: getMimeType(uri), fileSize };
  } catch (err) {
    console.log('[StaffPhotoService] Validation error:', err);
    return { valid: false, error: 'Failed to validate image.' };
  }
}

// ============================================
// Compression (on-device pre-processing)
// ============================================

async function compressImage(uri: string, maxDimension: number, quality: number): Promise<CompressedImage> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxDimension, height: maxDimension } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
  const size = fileInfo.exists ? (fileInfo.size ?? 0) : 0;
  return { uri: result.uri, size, width: result.width, height: result.height };
}

export async function generateFullImage(uri: string): Promise<CompressedImage | { error: string }> {
  const pass1 = await compressImage(uri, FULL_IMAGE_MAX_DIMENSION, FULL_QUALITY_PASS1);
  if (pass1.size <= FULL_TARGET_SIZE) return pass1;
  const pass2 = await compressImage(pass1.uri, FULL_IMAGE_MAX_DIMENSION, FULL_QUALITY_PASS2);
  if (pass2.size > FULL_HARD_CAP) {
    return { error: 'Image is still too large after compression. Please choose a smaller photo.' };
  }
  return pass2;
}

export async function generateThumbnail(uri: string): Promise<CompressedImage> {
  return compressImage(uri, THUMB_MAX_DIMENSION, THUMB_QUALITY);
}

// ============================================
// Upload via backend proxy (Hermes-safe)
// ============================================

async function uploadToBackend(
  fileUri: string,
  staffId: string,
  variant: 'full' | 'thumb'
): Promise<{ url: string; thumbUrl?: string; request_id?: string } | { error: string; request_id?: string }> {
  try {
    const suffix = variant === 'thumb' ? '_thumb' : '';
    const filename = `staff_${staffId}${suffix}.jpg`;

    const formData = new FormData();
    // Hermes-safe: use { uri, type, name } object — never new Blob([ArrayBuffer])
    formData.append('file', { uri: fileUri, type: 'image/jpeg', name: filename } as unknown as Blob);
    formData.append('staffId', staffId);

    console.log('[StaffPhotoService] Uploading to backend:', { variant, filename });

    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/storage/upload-staff-photo`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json() as {
      success: boolean;
      url?: string;
      thumbUrl?: string;
      error?: string;
      request_id?: string;
    };

    console.log('[StaffPhotoService] Backend response:', result);

    if (!response.ok || !result.success) {
      const errMsg = result.error || `Upload failed (${response.status})`;
      const reqId = result.request_id ? ` [req:${result.request_id}]` : '';
      return { error: errMsg + reqId, request_id: result.request_id };
    }

    if (!result.url) {
      return { error: 'No URL returned from server', request_id: result.request_id };
    }

    return { url: result.url, thumbUrl: result.thumbUrl, request_id: result.request_id };
  } catch (err) {
    console.log('[StaffPhotoService] Upload exception:', err);
    return { error: 'Failed to upload photo.' };
  }
}

// ============================================
// Main Upload Function
// ============================================

export async function uploadStaffPhoto(
  businessId: string,
  staffId: string,
  imageUri: string,
  _existingAvatarUrl?: string | null,
  _existingThumbUrl?: string | null
): Promise<StaffPhotoResult> {
  console.log('[StaffPhotoService] ===== UPLOAD START =====');
  console.log('[StaffPhotoService] staffId:', staffId);

  try {
    // Step 1: Validate
    const validation = await validatePhoto(imageUri);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Step 2: Compress on-device (reduces bandwidth)
    const fullResult = await generateFullImage(imageUri);
    if ('error' in fullResult) {
      return { success: false, error: fullResult.error };
    }

    console.log('[StaffPhotoService] Compression complete:', {
      fullSize: `${(fullResult.size / 1024).toFixed(1)}KB`,
      fullDimensions: `${fullResult.width}x${fullResult.height}`,
    });

    // Step 3: Upload full image — backend handles thumb generation server-side too
    // We send only the full image; backend creates both full + thumb at 1600px / 256px
    const uploaded = await uploadToBackend(fullResult.uri, staffId, 'full');
    if ('error' in uploaded) {
      return { success: false, error: uploaded.error, request_id: uploaded.request_id };
    }

    console.log('[StaffPhotoService] ===== UPLOAD SUCCESS =====', {
      url: uploaded.url,
      thumbUrl: uploaded.thumbUrl,
    });

    return {
      success: true,
      photoUrl: uploaded.url,
      avatarUrl: uploaded.url,
      avatarThumbUrl: uploaded.thumbUrl ?? uploaded.url,
      request_id: uploaded.request_id,
    };
  } catch (err) {
    console.log('[StaffPhotoService] Unexpected error:', err);
    return { success: false, error: 'Failed to upload photo. Please try again.' };
  }
}

// ============================================
// Remove (no-op — Vibecode Storage replaced by upsert)
// ============================================

export async function removeStaffPhoto(
  _avatarUrl?: string | null,
  _thumbUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  // New uploads overwrite deterministic keys. No deletion needed.
  return { success: true };
}
