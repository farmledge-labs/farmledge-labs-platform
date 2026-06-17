/**
 * Pure utility functions for formatting display-ready strings
 * No external dependencies — Node built-ins only
 */

/**
 * Format weight in kilograms with thousands separator
 * @param kg - Weight in kilograms
 * @returns Formatted weight string with thousands separator (e.g., "4,000 kg")
 * @example
 * formatWeight(4000) // "4,000 kg"
 * formatWeight(500) // "500 kg"
 */
export const formatWeight = (kg: number): string => {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(kg);

  return `${formatted} kg`;
};

/**
 * Format bag count and weight per bag
 * @param bagCount - Number of bags
 * @param weightPerBagKg - Weight per bag in kilograms
 * @returns Formatted string (e.g., "40 × 100kg bags")
 * @example
 * formatBags(40, 100) // "40 × 100kg bags"
 * formatBags(1, 50) // "1 × 50kg bag"
 */
export const formatBags = (bagCount: number, weightPerBagKg: number): string => {
  const bagLabel = bagCount === 1 ? 'bag' : 'bags';
  return `${bagCount} × ${weightPerBagKg}kg ${bagLabel}`;
};

/**
 * Format commodity string for display
 * Handles both simple lowercase names and underscore-separated variants
 * @param commodity - Commodity string (e.g., "maize" or "MAIZE_WHITE")
 * @returns Formatted commodity string (e.g., "Maize" or "White Maize")
 * @example
 * formatCommodity("maize") // "Maize"
 * formatCommodity("MAIZE_WHITE") // "White Maize"
 */
export const formatCommodity = (commodity: string): string => {
  // Split by underscore to handle variants like "MAIZE_WHITE"
  const parts = commodity.toUpperCase().split('_');

  // Capitalize each part
  const capitalizedParts = parts.map((part) => {
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });

  // If multiple parts (e.g., ["MAIZE", "WHITE"]), reverse for display (descriptor first)
  if (capitalizedParts.length > 1) {
    capitalizedParts.reverse();
  }

  return capitalizedParts.join(' ');
};

/**
 * Convert a token ID to uppercase
 * @param tokenId - The token ID string (e.g., "kn-2026-000042")
 * @returns Uppercase token ID
 */
export const formatTokenId = (tokenId: string): string => {
  return tokenId.toUpperCase();
};

/**
 * Format an ISO 8601 date string to "DD Mon YYYY"
 * @param isoDate - ISO 8601 date string
 * @returns Formatted date (e.g., "14 Mar 2026")
 */
export const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);

  // Handle invalid date strings gracefully
  if (isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};
