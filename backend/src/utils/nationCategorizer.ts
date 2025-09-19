import nationsData from '../config/nations.json';

export enum NationCategory {
  FARM = 'farm',
  BANK = 'bank',
  NONE = 'none'
}

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
  category: NationCategory;
  slots: AidSlots;
}

/**
 * Checks if a nation exists in the nations.json data and returns its has_dra flag
 * @param nationId - The nation ID to check
 * @returns Object with exists flag and has_dra flag
 */
function getNationFromJson(nationId: number): { exists: boolean; has_dra: boolean } {
  for (const allianceId in nationsData) {
    const alliance = nationsData[allianceId as keyof typeof nationsData];
    const nation = alliance.nations.find(nation => nation.nation_id === nationId);
    if (nation) {
      return { exists: true, has_dra: nation.has_dra };
    }
  }
  return { exists: false, has_dra: false };
}

/**
 * Categorizes a nation based on its technology and infrastructure levels
 * @param nation - The nation to categorize
 * @returns The categorized nation with category and aid direction fields added
 */
export function categorizeNation(nation: any): CategorizedNation {
  let category = NationCategory.NONE;
  const tech = parseFloat(nation.technology.replace(/,/g, '')) || 0;
  const infra = parseFloat(nation.infrastructure.replace(/,/g, '')) || 0;
  const nationId = nation.id || nation.nation_id;
  
  // Check if nation exists in JSON data and get has_dra flag
  const { exists: isInJson, has_dra } = getNationFromJson(nationId);
  
  // Determine category
  if (tech < 500 && infra > 3000) {
    category = NationCategory.FARM;
  } else if (infra >= 3000) {
    category = NationCategory.BANK;
  }
  
  // Default all nations to 6 slots
  const slots: AidSlots = {
    sendTech: 6,
    sendCash: 6,
    getTech: 6,
    getCash: 6
  };
  
  // Only overwrite slots if the nation is present in the JSON data
  if (isInJson) {
    const maxSlots = has_dra ? 6 : 5;
    
    // Reset all slots to 0 first
    slots.sendTech = 0;
    slots.sendCash = 0;
    slots.getTech = 0;
    slots.getCash = 0;
    
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
    category,
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

/**
 * Gets nations by category from a list of categorized nations
 * @param categorizedNations - Array of categorized nations
 * @param category - The category to filter by
 * @returns Array of nations in the specified category
 */
export function getNationsByCategory(categorizedNations: CategorizedNation[], category: NationCategory): CategorizedNation[] {
  return categorizedNations.filter(nation => nation.category === category);
}

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
 * Gets category counts from a list of categorized nations
 * @param categorizedNations - Array of categorized nations
 * @returns Object with counts for each category
 */
export function getCategoryCounts(categorizedNations: CategorizedNation[]): {
  farms: number;
  banks: number;
  none: number;
} {
  return {
    farms: getNationsByCategory(categorizedNations, NationCategory.FARM).length,
    banks: getNationsByCategory(categorizedNations, NationCategory.BANK).length,
    none: getNationsByCategory(categorizedNations, NationCategory.NONE).length
  };
}
