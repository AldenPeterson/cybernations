/**
 * Utility functions for war end date calculations
 * All dates in the data are Central Time (America/Chicago)
 */

export interface WarDateCalculations {
  formattedEndDate: string;
  daysUntilExpiration: number;
  expirationColor: string;
  isExpired: boolean;
}

export interface StaggeredStatus {
  status: 'staggered' | 'same-day' | 'empty';
  color: string;
}

/**
 * Formats a war end date by adding one day to show the day after the war actually ends
 * @param endDate - The original end date string
 * @returns Formatted date string in MM/DD/YYYY format
 */
export function formatWarEndDate(endDate: string): string {
  // Parse the date and add one calendar day to show the day after the war actually ends
  // All dates in the data are Central Time
  const date = new Date(endDate);
  const centralNextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return centralNextDay.toLocaleDateString('en-US', { 
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Calculates the number of days until a war expires
 * @param endDate - The war end date string (Central Time)
 * @returns Number of days until expiration (0 or positive)
 */
export function getDaysUntilExpiration(endDate: string): number {
  // Parse the end date and current time, both in Central Time
  const endDateObj = new Date(endDate);
  const now = new Date();
  
  // Set both dates to start of day in Central Time to compare just the date part
  const endDateCentral = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
  const nowCentral = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = endDateCentral.getTime() - nowCentral.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Determines if a war has expired
 * @param endDate - The war end date string
 * @returns True if the war has expired
 */
export function isWarExpired(endDate: string): boolean {
  return getDaysUntilExpiration(endDate) === 0;
}

/**
 * Gets the appropriate color for war expiration status
 * @param endDate - The war end date string
 * @returns Hex color code for the expiration status
 */
export function getWarExpirationColor(endDate: string): string {
  const daysUntilExpiration = getDaysUntilExpiration(endDate);
  
  if (daysUntilExpiration <= 1) {
    return '#ffebee'; // Light red for expires tomorrow or today
  } else if (daysUntilExpiration === 2) {
    return '#fff3e0'; // Light orange for expires in 2 days
  } else if (daysUntilExpiration === 3) {
    return '#fffde7'; // Light yellow for expires in 3 days
  } else {
    return '#e8f5e8'; // Light green for expires in more than 3 days
  }
}

/**
 * Calculates staggered status for a group of defending wars
 * @param defendingWars - Array of wars with endDate field
 * @returns Staggered status information
 */
export function calculateStaggeredStatus(defendingWars: { endDate: string }[]): StaggeredStatus {
  if (defendingWars.length === 0) {
    return { status: 'empty', color: '#ffffff' };
  }
  
  if (defendingWars.length === 1) {
    return { status: 'empty', color: '#ffffff' };
  }
  
  // Get unique end dates (ignoring time, just the date part in Central Time)
  const endDates = defendingWars.map(war => {
    const date = new Date(war.endDate);
    return date.toLocaleDateString('en-US', { 
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  });
  
  const uniqueDates = new Set(endDates);
  
  if (uniqueDates.size > 1) {
    return { status: 'staggered', color: '#e8f5e8' }; // Green for staggered
  } else {
    // Only show red warning if there are exactly 3 wars expiring on the same date
    if (defendingWars.length === 3) {
      return { status: 'same-day', color: '#ffebee' }; // Red for same day
    } else {
      return { status: 'empty', color: '#ffffff' }; // White for other cases
    }
  }
}

/**
 * Calculates all war date-related values for a given end date
 * @param endDate - The war end date string
 * @returns Object containing all calculated war date values
 */
export function calculateWarDateInfo(endDate: string): WarDateCalculations {
  return {
    formattedEndDate: formatWarEndDate(endDate),
    daysUntilExpiration: getDaysUntilExpiration(endDate),
    expirationColor: getWarExpirationColor(endDate),
    isExpired: isWarExpired(endDate)
  };
}
