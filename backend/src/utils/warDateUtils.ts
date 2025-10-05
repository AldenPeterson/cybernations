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
  
  // Get the Central Time date components
  const centralYear = date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' });
  const centralMonth = date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric' });
  const centralDay = date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', day: 'numeric' });
  
  // Create a date object for the Central Time date and add one day
  const centralDate = new Date(parseInt(centralYear), parseInt(centralMonth) - 1, parseInt(centralDay) + 1);
  
  return centralDate.toLocaleDateString('en-US', { 
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
  // Parse the end date and current time
  const endDateObj = new Date(endDate);
  const now = new Date();
  
  // Get Central Time date components for the war end date
  const endYear = parseInt(endDateObj.toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' }));
  const endMonth = parseInt(endDateObj.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric' }));
  const endDay = parseInt(endDateObj.toLocaleDateString('en-US', { timeZone: 'America/Chicago', day: 'numeric' }));
  
  // Get Central Time date components for current time
  const nowYear = parseInt(now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' }));
  const nowMonth = parseInt(now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric' }));
  const nowDay = parseInt(now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', day: 'numeric' }));
  
  // Create date objects for comparison (expiration date is day after war ends)
  const expirationDate = new Date(endYear, endMonth - 1, endDay + 1);
  const currentDate = new Date(nowYear, nowMonth - 1, nowDay);
  
  const diffTime = expirationDate.getTime() - currentDate.getTime();
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
    return { status: 'staggered', color: '#e8f5e8' }; // Green for staggered (multiple dates)
  } else {
    // Red for not staggered (2 or 3 wars on same date)
    if (defendingWars.length >= 2 && defendingWars.length <= 3) {
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
