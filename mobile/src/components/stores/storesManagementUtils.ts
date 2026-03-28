import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';

export const STAFF_COLORS = [
  '#0D9488', // Teal
  '#F97316', // Orange
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#6366F1', // Indigo
  '#14B8A6', // Cyan
  '#84CC16', // Lime
  '#A855F7', // Violet
];

// Helper to get staff initials
export const getStaffInitials = (name: string): string => {
  const trimmedName = name.trim();
  if (!trimmedName) return '?';

  const parts = trimmedName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  const firstInitial = parts[0].charAt(0).toUpperCase();
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return firstInitial + lastInitial;
};

export interface StoresManagementScreenProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Maps raw storePhotoService error strings to localized translation keys.
 * Always returns a translated, user-friendly message.
 */
export function mapStorePhotoError(rawError: string | undefined, language: Language): string {
  if (!rawError) return t('storePhotoUploadGenericError', language);
  const e = rawError.toLowerCase();
  if (e.includes('unsupported file type') || e.includes('unsupported file format') || e.includes('please use jpg') || e.includes('use jpg, png')) {
    return t('storePhotoUploadUnsupportedFormat', language);
  }
  if (e.includes('too large') || e.includes('under 10mb') || e.includes('10mb') || e.includes('10 mb') || e.includes('5mb') || e.includes('maximum size')) {
    return t('storePhotoUploadTooLarge', language);
  }
  if (e.includes('file not found') || e.includes('image file not found')) {
    return t('storePhotoUploadFileNotFound', language);
  }
  if (e.includes('failed to validate') || e.includes('validate image')) {
    return t('storePhotoUploadValidationFailed', language);
  }
  if (e.includes('still too large after compression') || e.includes('choose a smaller photo')) {
    return t('storePhotoUploadCompressionFailed', language);
  }
  if (e.includes('network') || e.includes('connection') || e.includes('check your connection')) {
    return t('storePhotoUploadNetworkError', language);
  }
  if (e.includes('storage error') || e.includes('storage service')) {
    return 'Upload failed (Storage error). Please try again.';
  }
  if (e.includes('server error') || e.includes('http') || e.includes('status') || e.includes('upload failed (') || e.includes('upload exception')) {
    // For server/unexpected errors, show the raw error so the user can report it
    return rawError;
  }
  if (e.includes('corrupt') || e.includes('invalid or corrupt')) {
    return rawError; // Use the raw message — it is already user-friendly
  }
  if (e.includes('too many uploads') || e.includes('rate limit') || e.includes('wait a moment')) {
    return rawError; // Use the raw message — it is already user-friendly
  }
  return t('storePhotoUploadGenericError', language);
}
