import { findNationById } from './allianceDataLoader.js';

// Categories removed - nations are only defined by their aid slots

export enum AidType {
  CASH = 'cash',
  TECHNOLOGY = 'technology'
}

export interface AidSlots {
  sendTech: number;
  sendCash: number;
  getTech: number;
  getCash: number;
}

export interface CategorizedNation {
  id: number;
  rulerName: string;
  nationName: string;
  allianceId: number;
  alliance: string;
  technology: string;
  infrastructure: string;
  strength: string;
  activity: string;
  slots: AidSlots;
}

/**
 * Checks if a nation exists in the nations.json data and returns its has_dra flag
 * @param nationId - The nation ID to check
 * @returns Object with exists flag and has_dra flag
 */
function getNationFromJson(nationId: number): { exists: boolean; has_dra: boolean } {
  const result = findNationById(nationId);
  if (result) {
    return { exists: true, has_dra: result.nation.has_dra };
  }
  return { exists: false, has_dra: false };
}

/**
 * Categorizes a nation based on its technology and infrastructure levels
 * @param nation - The nation to categorize
 * @returns The categorized nation with category and aid direction fields added
 */
export function categorizeNation(nation: any): CategorizedNation {
  const tech = parseFloat(nation.technology.replace(/,/g, '')) || 0;
  const infra = parseFloat(nation.infrastructure.replace(/,/g, '')) || 0;
  const nationId = nation.id || nation.nation_id;
  
  // Check if nation exists in JSON data and get has_dra flag
  const { exists: isInJson, has_dra } = getNationFromJson(nationId);
  
  // Default all nations to 6 slots
  const slots: AidSlots = {
    sendTech: 0,
    sendCash: 0,
    getTech: 0,
    getCash: 0
  };
  
  if (isInJson) {
    // Nation found in JSON - use predefined slots from the JSON data
    const result = findNationById(nationId);
    if (result && result.nation.slots) {
      slots.sendTech = result.nation.slots.sendTech || 0;
      slots.sendCash = result.nation.slots.sendCash || 0;
      slots.getTech = result.nation.slots.getTech || 0;
      slots.getCash = result.nation.slots.getCash || 0;
    }
  } else {
    // Nation not found in JSON - assign slots based on tech and infra thresholds
    let maxSlots = 6;

    if (infra < 3000) {
      // Nations with < 3000 infra get full cash
      slots.getCash = maxSlots;
    } else if (infra >= 3000 && tech < 1000) {
      // Nations with >3000 infra and < 1000 tech get max send tech
      slots.sendTech = maxSlots;
    } else if (tech >= 1000 && tech < 25000) {
      // Nations between 1000 and 25000 tech get max tech
      slots.getTech = maxSlots;
    } else if (tech >= 25000 && tech < 30000) {
      // Nations between 25000 and 30000 tech get 5 tech, 1 cash send
      slots.getTech = Math.min(5, maxSlots);
      slots.sendCash = Math.min(1, maxSlots - slots.getTech);
    } else if (tech >= 30000 && tech < 35000) {
      // Nations between 30000 and 35000 have get 4 tech, 2 cash send
      slots.getTech = Math.min(4, maxSlots);
      slots.sendCash = Math.min(2, maxSlots - slots.getTech);
    } else if (tech >= 35000) {
      // Nations greater than 35000 technology have 3 get tech and 3 cash send
      slots.getTech = Math.min(3, maxSlots);
      slots.sendCash = Math.min(3, maxSlots - slots.getTech);
    }
  }

  return {
    ...nation,
    slots
  };
}

/**
 * Categorizes an array of nations
 * @param nations - Array of nations to categorize
 * @returns Array of categorized nations
 */
export function categorizeNations(nations: any[]): CategorizedNation[] {
  return nations.map(categorizeNation);
}

// Category-based filtering removed - use slot-based functions instead

/**
 * Gets nations that should receive cash aid (have getCash slots > 0)
 * @param categorizedNations - Array of categorized nations
 * @returns Array of nations that should get cash
 */
export function getNationsThatShouldGetCash(categorizedNations: CategorizedNation[]): CategorizedNation[] {
  return categorizedNations.filter(nation => nation.slots.getCash > 0);
}

/**
 * Gets nations that should send technology aid (have sendTech slots > 0)
 * @param categorizedNations - Array of categorized nations
 * @returns Array of nations that should send technology
 */
export function getNationsThatShouldSendTechnology(categorizedNations: CategorizedNation[]): CategorizedNation[] {
  return categorizedNations.filter(nation => nation.slots.sendTech > 0);
}

/**
 * Gets nations that should receive technology aid (have getTech slots > 0)
 * @param categorizedNations - Array of categorized nations
 * @returns Array of nations that should get technology
 */
export function getNationsThatShouldGetTechnology(categorizedNations: CategorizedNation[]): CategorizedNation[] {
  return categorizedNations.filter(nation => nation.slots.getTech > 0);
}

/**
 * Gets nations that should send cash aid (have sendCash slots > 0)
 * @param categorizedNations - Array of categorized nations
 * @returns Array of nations that should send cash
 */
export function getNationsThatShouldSendCash(categorizedNations: CategorizedNation[]): CategorizedNation[] {
  return categorizedNations.filter(nation => nation.slots.sendCash > 0);
}

/**
 * Gets slot statistics from a list of categorized nations
 * @param categorizedNations - Array of categorized nations
 * @returns Object with slot counts
 */
export function getSlotStatistics(categorizedNations: CategorizedNation[]): {
  totalSendTech: number;
  totalSendCash: number;
  totalGetTech: number;
  totalGetCash: number;
  nationsWithSlots: number;
} {
  return {
    totalSendTech: categorizedNations.reduce((sum, nation) => sum + nation.slots.sendTech, 0),
    totalSendCash: categorizedNations.reduce((sum, nation) => sum + nation.slots.sendCash, 0),
    totalGetTech: categorizedNations.reduce((sum, nation) => sum + nation.slots.getTech, 0),
    totalGetCash: categorizedNations.reduce((sum, nation) => sum + nation.slots.getCash, 0),
    nationsWithSlots: categorizedNations.filter(nation => 
      nation.slots.sendTech > 0 || nation.slots.sendCash > 0 || 
      nation.slots.getTech > 0 || nation.slots.getCash > 0
    ).length
  };
}
