/**
 * Consolidated date utility functions for CyberNations
 * All dates in the data are Central Time (America/Chicago)
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface WarDateCalculations {
  formattedEndDate: string;
  daysUntilExpiration: number;
  expirationColor: string;
  isExpired: boolean;
}

export interface AidDateCalculations {
  expirationDate: string;
  daysUntilExpiration: number;
  isExpired: boolean;
}

export interface StaggeredStatus {
  status: 'staggered' | 'same-day' | 'empty';
  color: string;
}

// ============================================================================
// CORE DATE PARSING
// ============================================================================

/**
 * Parse a Central Time date string from the source data
 * @param dateString - Date string in format "M/D/YYYY H:MM:SS AM/PM" or "M/D/YYYY H:MM:SS" or "M/D/YYYY"
 * @returns Date object representing the Central Time date
 */
export function parseCentralTimeDate(dateString: string): Date {
  // Handle empty or invalid date strings
  if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
    throw new Error(`Invalid date string: "${dateString}"`);
  }

  // Parse the date string which is in Central Time format
  // Examples: "10/5/2025 5:18:15 PM" or "10/5/2025 17:18:15" or "10/5/2025"
  const parts = dateString.split(' ');
  let datePart: string;
  let timePart: string;
  
  if (parts.length < 2) {
    // Date only, no time component - default to midnight (00:00:00)
    datePart = parts[0];
    timePart = '00:00:00';
  } else {
    [datePart, timePart] = parts;
  }
  const dateComponents = datePart.split('/');
  if (dateComponents.length !== 3) {
    throw new Error(`Invalid date part: "${datePart}" - expected "M/D/YYYY"`);
  }

  const [month, day, year] = dateComponents;
  
  // Check if time has AM/PM or is 24-hour format
  const timeComponents = timePart.split(' ');
  let time: string;
  let period: string | undefined;
  
  if (timeComponents.length === 2) {
    // Has AM/PM
    [time, period] = timeComponents;
  } else if (timeComponents.length === 1) {
    // 24-hour format
    time = timeComponents[0];
    period = undefined;
  } else {
    throw new Error(`Invalid time part: "${timePart}" - expected "H:MM:SS AM/PM" or "H:MM:SS"`);
  }
  
  const timeParts = time.split(':');
  if (timeParts.length !== 3) {
    throw new Error(`Invalid time format: "${time}" - expected "H:MM:SS"`);
  }

  const [hours, minutes, seconds] = timeParts;
  
  let hour24 = parseInt(hours);
  if (period) {
    // 12-hour format with AM/PM
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
  }
  // If no period, assume 24-hour format (no conversion needed)
  
  // Create date in Central Time
  return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour24.toString().padStart(2, '0')}:${minutes}:${seconds}-06:00`);
}

/**
 * Get current time in Central Time
 * @returns Date object representing current Central Time
 */
export function getCurrentCentralTime(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

/**
 * Check if current time is in the blackout window (11:45 PM - 12:15 AM Central)
 * when CyberNations files are not available for download
 * @returns True if in blackout window, false otherwise
 */
export function isInBlackoutWindow(): boolean {
  const now = new Date();
  const centralNow = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const centralDate = new Date(centralNow);
  const hours = centralDate.getHours();
  const minutes = centralDate.getMinutes();
  
  // 11:45 PM - 11:59 PM (23:45 - 23:59)
  if (hours === 23 && minutes >= 45) {
    return true;
  }
  
  // 12:00 AM - 12:15 AM (0:00 - 0:15)
  if (hours === 0 && minutes <= 15) {
    return true;
  }
  
  return false;
}

/**
 * Format a date as Central Time string
 * @param date - Date object to format
 * @returns Formatted date string in MM/DD/YYYY format
 */
export function formatCentralTimeDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// ============================================================================
// GENERIC DATE CALCULATIONS
// ============================================================================

/**
 * Calculate days between two dates in Central Time
 * @param startDate - Start date string (Central Time)
 * @param endDate - End date string (Central Time)
 * @returns Number of days between dates
 */
export function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = parseCentralTimeDate(startDate);
  const end = parseCentralTimeDate(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days until expiration from a given date
 * @param startDate - Start date string (Central Time)
 * @param expirationDays - Number of days until expiration
 * @returns Number of days until expiration (0 or positive)
 */
export function calculateDaysUntilExpiration(startDate: string, expirationDays: number): number {
  const start = parseCentralTimeDate(startDate);
  const now = getCurrentCentralTime();
  
  // Calculate the expiration date by adding expirationDays to the start date
  const expirationDate = new Date(start.getTime() + (expirationDays * 24 * 60 * 60 * 1000));
  
  // Get Central Time date components for expiration date (date only, no time)
  const expYear = parseInt(expirationDate.toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' }));
  const expMonth = parseInt(expirationDate.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric' }));
  const expDay = parseInt(expirationDate.toLocaleDateString('en-US', { timeZone: 'America/Chicago', day: 'numeric' }));
  
  // Get Central Time date components for current date (date only, no time)
  const nowYear = parseInt(now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' }));
  const nowMonth = parseInt(now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric' }));
  const nowDay = parseInt(now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', day: 'numeric' }));
  
  // Create date objects for comparison (using date only, no time)
  const expirationDateOnly = new Date(expYear, expMonth - 1, expDay);
  const currentDateOnly = new Date(nowYear, nowMonth - 1, nowDay);
  
  // Calculate difference in days
  const diffTime = expirationDateOnly.getTime() - currentDateOnly.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Return remaining days (0 if expired)
  return Math.max(0, diffDays);
}

/**
 * Check if a date has expired based on expiration days
 * @param startDate - Start date string (Central Time)
 * @param expirationDays - Number of days until expiration
 * @returns True if the date has expired
 */
export function isDateExpired(startDate: string, expirationDays: number): boolean {
  return calculateDaysUntilExpiration(startDate, expirationDays) === 0;
}

/**
 * Get expiration color based on days until expiration
 * @param daysUntilExpiration - Number of days until expiration
 * @returns Hex color code for the expiration status
 */
export function getExpirationColor(daysUntilExpiration: number): string {
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

// ============================================================================
// WAR DATE FUNCTIONS
// ============================================================================

/**
 * Formats a war end date by adding one day to show the day after the war actually ends
 * @param endDate - The original end date string
 * @returns Formatted date string in MM/DD/YYYY format
 */
export function formatWarEndDate(endDate: string): string {
  const date = parseCentralTimeDate(endDate);
  
  // Get the Central Time date components
  const centralYear = parseInt(date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' }));
  const centralMonth = parseInt(date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric' }));
  const centralDay = parseInt(date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', day: 'numeric' }));
  
  // Create a date object for the Central Time date and add one day
  const centralDate = new Date(centralYear, centralMonth - 1, centralDay + 1);
  
  return formatCentralTimeDate(centralDate);
}

/**
 * Formats a war end date to show the actual end date
 * For CSV wars: the timestamp represents the last day of war, so we add one day to get the actual end date
 * For dynamic wars: the date already represents the end date, so we return it as-is
 * @param endDate - The original end date string
 * @returns Formatted date string in MM/DD/YYYY format showing the actual end date
 */
export function formatActualWarEndDate(endDate: string): string {
  // If the endDate is just a date (no time), it's likely from dynamic wars and already represents the end date
  if (endDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    // Dynamic war - date already represents the end date, return as-is
    return endDate;
  }
  
  // If the endDate has a time component that looks like it was added by normalizeDateString (12:00:00 AM),
  // extract just the date part since this is likely from dynamic wars
  if (endDate.match(/^\d{1,2}\/\d{1,2}\/\d{4} 12:00:00 AM$/)) {
    // Extract just the date part
    const datePart = endDate.split(' ')[0];
    return datePart;
  }
  
  // CSV war - timestamp represents last day of war, add one day to get actual end date
  const date = parseCentralTimeDate(endDate);
  
  // Get the Central Time date components
  const centralYear = parseInt(date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' }));
  const centralMonth = parseInt(date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric' }));
  const centralDay = parseInt(date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', day: 'numeric' }));
  
  // Add one day to get the actual end date
  const centralDate = new Date(centralYear, centralMonth - 1, centralDay + 1);
  
  return formatCentralTimeDate(centralDate);
}

/**
 * Calculates the number of days until a war expires
 * @param endDate - The war end date string (Central Time)
 * @returns Number of days until expiration (0 or positive)
 */
export function getWarDaysUntilExpiration(endDate: string): number {
  const endDateObj = parseCentralTimeDate(endDate);
  const now = getCurrentCentralTime();
  
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
  return getWarDaysUntilExpiration(endDate) === 0;
}

/**
 * Gets the appropriate color for war expiration status
 * @param endDate - The war end date string
 * @returns Hex color code for the expiration status
 */
export function getWarExpirationColor(endDate: string): string {
  const daysUntilExpiration = getWarDaysUntilExpiration(endDate);
  return getExpirationColor(daysUntilExpiration);
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
    const date = parseCentralTimeDate(war.endDate);
    return formatCentralTimeDate(date);
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
    formattedEndDate: formatActualWarEndDate(endDate),
    daysUntilExpiration: getWarDaysUntilExpiration(endDate),
    expirationColor: getWarExpirationColor(endDate),
    isExpired: isWarExpired(endDate)
  };
}

// ============================================================================
// AID DATE FUNCTIONS
// ============================================================================

/**
 * Calculate the expiration date for an aid offer (10 days from offer date)
 * @param offerDate - The aid offer date string (Central Time)
 * @returns Formatted expiration date string
 */
export function calculateAidExpirationDate(offerDate: string): string {
  const offerDateObj = parseCentralTimeDate(offerDate);
  const expirationDate = new Date(offerDateObj.getTime() + (10 * 24 * 60 * 60 * 1000));
  
  return formatCentralTimeDate(expirationDate);
}

/**
 * Calculate days until aid offer expiration
 * @param offerDate - The aid offer date string (Central Time)
 * @returns Number of days until expiration (0 or positive)
 */
export function getAidDaysUntilExpiration(offerDate: string): number {
  return calculateDaysUntilExpiration(offerDate, 10);
}

/**
 * Check if an aid offer has expired
 * @param offerDate - The aid offer date string (Central Time)
 * @returns True if the offer has expired
 */
export function isAidOfferExpired(offerDate: string): boolean {
  return isDateExpired(offerDate, 10);
}

/**
 * Calculate all aid date-related values for a given offer date
 * @param offerDate - The aid offer date string (Central Time)
 * @returns Object containing all calculated aid date values
 */
export function calculateAidDateInfo(offerDate: string): AidDateCalculations {
  return {
    expirationDate: calculateAidExpirationDate(offerDate),
    daysUntilExpiration: getAidDaysUntilExpiration(offerDate),
    isExpired: isAidOfferExpired(offerDate)
  };
}

// ============================================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================================

// War date aliases for backward compatibility
export const getDaysUntilExpiration = getWarDaysUntilExpiration;
