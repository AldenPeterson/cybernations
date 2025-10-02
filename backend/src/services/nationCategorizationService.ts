import { findNationById } from '../utils/allianceDataLoader.js';
import { CategorizedNation, AidSlots, AidType } from '../models/Nation.js';

/**
 * Checks if a nation exists in the nations.json data and returns its has_dra flag
 * @param nationId - The nation ID to check
 * @returns Object with exists flag and has_dra flag
 */
export function getNationFromJson(nationId: number): { exists: boolean; has_dra: boolean } {
  const result = findNationById(nationId);
  if (result) {
    return { exists: true, has_dra: result.nation.has_dra };
  }
  return { exists: false, has_dra: true };
}

/**
 * Categorizes a nation based on its technology and infrastructure levels
 * @param nation - The nation to categorize
 * @returns The categorized nation with category and aid direction fields added
 */
export function categorizeNation(nation: any): CategorizedNation {
  const tech = parseFloat(nation.technology.replace(/,/g, '')) || 0;
  const infra = parseFloat(nation.infrastructure.replace(/,/g, '')) || 0;
  
  // Get nation data from JSON config
  const jsonData = getNationFromJson(nation.id);
  
  // Default slots if not found in JSON
  let defaultSlots: AidSlots = {
    sendTech: 0,
    sendCash: 0,
    getTech: 0,
    getCash: 0
  };
  
  // If nation exists in JSON config, use those slots
  if (jsonData.exists) {
    const result = findNationById(nation.id);
    if (result && result.nation.slots) {
      return {
        ...nation,
        has_dra: result.nation.has_dra,
        discord_handle: result.nation.discord_handle,
        slots: result.nation.slots,
        inWarMode: nation.inWarMode || false
      };
    }
  }

  
  // Use the parsed values instead of re-parsing
  if (infra > 3000 && tech < 500) {
    defaultSlots.sendTech = 6;
  } else if (infra <= 3000 && tech < 500) {
    defaultSlots.getCash = 6;
  } else if (tech >= 500) {
    defaultSlots.sendCash = 2;
    defaultSlots.getTech = 4;
  }

  // Fallback to default slots
  return {
    ...nation,
    has_dra: jsonData.has_dra,
    discord_handle: undefined,
    slots: defaultSlots,
    inWarMode: nation.inWarMode || false
  };
}

/**
 * Categorizes multiple nations
 * @param nations - Array of nations to categorize
 * @returns Array of categorized nations
 */
export function categorizeNations(nations: any[]): CategorizedNation[] {
  return nations.map(nation => categorizeNation(nation));
}


/**
 * Gets nations that should receive cash aid
 * @param nations - Array of categorized nations
 * @returns Array of nations that should get cash
 */
export function getNationsThatShouldGetCash(nations: CategorizedNation[]): CategorizedNation[] {
  return nations.filter(nation => nation.slots.getCash > 0);
}

/**
 * Gets nations that should send technology aid
 * @param nations - Array of categorized nations
 * @returns Array of nations that should send tech
 */
export function getNationsThatShouldSendTechnology(nations: CategorizedNation[]): CategorizedNation[] {
  return nations.filter(nation => nation.slots.sendTech > 0);
}

/**
 * Gets nations that should receive technology aid
 * @param nations - Array of categorized nations
 * @returns Array of nations that should get tech
 */
export function getNationsThatShouldGetTechnology(nations: CategorizedNation[]): CategorizedNation[] {
  return nations.filter(nation => nation.slots.getTech > 0);
}

/**
 * Gets nations that should send cash aid
 * @param nations - Array of categorized nations
 * @returns Array of nations that should send cash
 */
export function getNationsThatShouldSendCash(nations: CategorizedNation[]): CategorizedNation[] {
  return nations.filter(nation => nation.slots.sendCash > 0);
}
