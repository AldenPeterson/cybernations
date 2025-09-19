import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AllianceData {
  alliance_id: number;
  alliance_name: string;
  nations: {
    [nationId: string]: {
      ruler_name: string;
      nation_name: string;
      discord_handle: string;
      has_dra: boolean;
      notes?: string;
      slots: {
        sendTech: number;
        sendCash: number;
        getTech: number;
        getCash: number;
      };
      current_stats?: {
        technology: string;
        infrastructure: string;
        strength: string;
      };
    };
  };
}

export interface NationData {
  nation_id: number;
  ruler_name: string;
  nation_name: string;
  discord_handle: string;
  has_dra: boolean;
  notes?: string;
  slots: {
    sendTech: number;
    sendCash: number;
    getTech: number;
    getCash: number;
  };
  current_stats?: {
    technology: string;
    infrastructure: string;
    strength: string;
  };
}

/**
 * Get the path to the alliances directory
 */
function getAlliancesDirectory(): string {
  return path.join(__dirname, '../config/alliances');
}

/**
 * Load all alliance files
 */
export function loadAllAlliances(): Map<number, AllianceData> {
  const alliancesDir = getAlliancesDirectory();
  const alliances = new Map<number, AllianceData>();
  
  if (!fs.existsSync(alliancesDir)) {
    console.warn('Alliances directory does not exist:', alliancesDir);
    return alliances;
  }
  
  const files = fs.readdirSync(alliancesDir).filter(file => file.endsWith('.json'));
  
  for (const file of files) {
    try {
      const filePath = path.join(alliancesDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AllianceData;
      alliances.set(data.alliance_id, data);
    } catch (error) {
      console.error(`Error loading alliance file ${file}:`, error);
    }
  }
  
  return alliances;
}

/**
 * Load a specific alliance by ID
 */
export function loadAllianceById(allianceId: number): AllianceData | null {
  const alliancesDir = getAlliancesDirectory();
  
  if (!fs.existsSync(alliancesDir)) {
    return null;
  }
  
  // Look for a file that starts with the alliance ID
  const files = fs.readdirSync(alliancesDir);
  const allianceFile = files.find(file => file.startsWith(`${allianceId}-`) && file.endsWith('.json'));
  
  if (!allianceFile) {
    return null;
  }
  
  try {
    const filePath = path.join(alliancesDir, allianceFile);
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as AllianceData;
  } catch (error) {
    console.error(`Error loading alliance ${allianceId}:`, error);
    return null;
  }
}

/**
 * Save alliance data to file
 */
export function saveAllianceData(allianceData: AllianceData): boolean {
  const alliancesDir = getAlliancesDirectory();
  
  if (!fs.existsSync(alliancesDir)) {
    fs.mkdirSync(alliancesDir, { recursive: true });
  }
  
  // Create filename
  const sanitizedName = allianceData.alliance_name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
  
  const filename = `${allianceData.alliance_id}-${sanitizedName}.json`;
  const filePath = path.join(alliancesDir, filename);
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(allianceData, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving alliance ${allianceData.alliance_id}:`, error);
    return false;
  }
}

/**
 * Find a nation across all alliances
 */
export function findNationById(nationId: number): { alliance: AllianceData; nation: NationData } | null {
  const alliances = loadAllAlliances();
  
  for (const alliance of alliances.values()) {
    const nation = alliance.nations[nationId.toString()];
    if (nation) {
      return {
        alliance,
        nation: {
          nation_id: nationId,
          ...nation
        }
      };
    }
  }
  
  return null;
}

/**
 * Update a specific nation's data
 */
export function updateNationData(
  allianceId: number, 
  nationId: number, 
  updates: Partial<Omit<NationData, 'nation_id'>>
): boolean {
  const alliance = loadAllianceById(allianceId);
  
  if (!alliance || !alliance.nations[nationId.toString()]) {
    return false;
  }
  
  // Update the nation data
  const nation = alliance.nations[nationId.toString()];
  Object.assign(nation, updates);
  
  // Save the updated alliance data
  return saveAllianceData(alliance);
}

/**
 * Get all nations from all alliances in a flat array
 */
export function getAllNationsFlat(): NationData[] {
  const alliances = loadAllAlliances();
  const nations: NationData[] = [];
  
  for (const alliance of alliances.values()) {
    for (const [nationId, nationData] of Object.entries(alliance.nations)) {
      nations.push({
        nation_id: parseInt(nationId),
        ...nationData
      });
    }
  }
  
  return nations;
}
