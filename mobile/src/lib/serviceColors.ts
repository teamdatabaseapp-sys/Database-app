/**
 * Service/Product Color Constants
 *
 * Default brand teal color for services and products.
 * Only use custom colors when explicitly set by the user.
 */

// Default brand teal color - used when no custom color is selected
export const DEFAULT_SERVICE_COLOR = '#0D9488';

// Custom color options for users who want to personalize
export const SERVICE_COLORS = [
  '#F97316', '#8B5CF6', '#EC4899', '#10B981', '#3B82F6',
  '#EF4444', '#F59E0B', '#6366F1', '#14B8A6', '#84CC16', '#A855F7',
  '#0891B2', '#E11D48', '#0284C7', '#C026D3', '#16A34A', '#CA8A04',
];

/**
 * Get the icon color for a service/product.
 * Returns the custom color only if explicitly set, otherwise returns the brand
 * primary color (if provided) or the default teal fallback.
 */
export const getServiceIconColor = (customColor: string | null | undefined, brandPrimaryColor?: string): string => {
  // Only use custom color if it's set and not empty
  if (customColor && customColor.trim() !== '') {
    return customColor;
  }
  return brandPrimaryColor || DEFAULT_SERVICE_COLOR;
};
