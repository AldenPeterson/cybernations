import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AllianceData, NationData } from './allianceDataLoader.js';
import { Nation } from '../models/Nation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to the alliances directory
 */
function getAlliancesDirectory(): string {
  return path.join(__dirname, '../config/alliances');
}

/**
 * Sync alliance files with new nation data
 * This function should be called after new data is downloaded
 */
export async function syncAllianceFilesWithNewData(nations: Nation[]): Promise<void> {
  // Skip file operations in serverless environments like Vercel
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('Skipping alliance file sync in serverless environment');
    return;
  }

  console.log('Starting alliance file synchronization...');
  
  const alliancesDir = getAlliancesDirectory();
  
  if (!fs.existsSync(alliancesDir)) {
    console.log('No alliances directory found, skipping sync');
    return;
  }
  
  // Get all alliance JSON files
  const allianceFiles = fs.readdirSync(alliancesDir).filter(file => file.endsWith('.json'));
  
  console.log('Alliance files:', allianceFiles);
  if (allianceFiles.length === 0) {
    console.log('No alliance files found, skipping sync');
    return;
  }
  
  // Group nations by alliance ID
  const nationsByAlliance = new Map<number, Nation[]>();
  nations.forEach(nation => {
    if (nation.allianceId && nation.allianceId !== 0) {
      if (!nationsByAlliance.has(nation.allianceId)) {
        nationsByAlliance.set(nation.allianceId, []);
      }
      nationsByAlliance.get(nation.allianceId)!.push(nation);
    }
  });
  
  console.log(`Found ${nationsByAlliance.size} alliances with nations in new data`);
  
  // Process each alliance file
  for (const allianceFile of allianceFiles) {
    try {
      const filePath = path.join(alliancesDir, allianceFile);
      const allianceData = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AllianceData;
      
      console.log(`Syncing alliance: ${allianceData.alliance_name} (ID: ${allianceData.alliance_id})`);
      
      const newNations = nationsByAlliance.get(allianceData.alliance_id) || [];
      
      if (newNations.length === 0) {
        console.log(`No nations found in new data for alliance ${allianceData.alliance_name}, skipping`);
        continue;
      }
      
      const updatedAlliance = await syncAllianceData(allianceData, newNations);
      
      // Save the updated alliance data
      const success = saveAllianceData(updatedAlliance);
      
      if (success) {
        console.log(`Successfully synced alliance: ${allianceData.alliance_name}`);
      } else {
        console.error(`Failed to save alliance: ${allianceData.alliance_name}`);
      }
      
    } catch (error) {
      console.error(`Error syncing alliance file ${allianceFile}:`, error);
    }
  }
  
  console.log('Alliance file synchronization completed');
}

/**
 * Sync a single alliance with new nation data
 */
async function syncAllianceData(allianceData: AllianceData, newNations: Nation[]): Promise<AllianceData> {
  const updatedAlliance = { ...allianceData };
  const currentNationIds = new Set(Object.keys(allianceData.nations).map(id => parseInt(id)));
  const newNationIds = new Set(newNations.map(nation => nation.id));
  
  console.log(`  Current nations in file: ${currentNationIds.size}`);
  console.log(`  New nations from data: ${newNationIds.size}`);
  
  // 1. Add new nations to the alliance
  const addedNations: string[] = [];
  for (const newNation of newNations) {
    const nationId = newNation.id;
    
    if (!allianceData.nations[nationId]) {
       console.log(`  Adding new nation: ${newNation.nationName}`);
      // Add new nation with default values
      // Note: discord_handle is now stored in a separate file (nation_discord_handles.json)
      updatedAlliance.nations[nationId] = {
        ruler_name: newNation.rulerName,
        nation_name: newNation.nationName,
        discord_handle: '', // Deprecated: now stored in nation_discord_handles.json
        has_dra: false, // Default to false, will need to be updated manually
        notes: '',
        slots: {
          sendTech: 0,
          sendCash: 0,
          getTech: 0,
          getCash: 0,
          send_priority: 3,
          receive_priority: 3
        },
        current_stats: {
          technology: newNation.technology,
          infrastructure: newNation.infrastructure,
          strength: newNation.strength.toString()
        }
      };
      addedNations.push(newNation.nationName);
    }
  }
  
  if (addedNations.length > 0) {
    console.log(`  Added ${addedNations.length} new nations: ${addedNations.join(', ')}`);
  }
  
  // 2. Remove nations that are no longer in the alliance
  const removedNations: string[] = [];
  for (const currentNationId of currentNationIds) {
    if (!newNationIds.has(currentNationId)) {
      const nationName = allianceData.nations[currentNationId]?.nation_name || `ID: ${currentNationId}`;
      delete updatedAlliance.nations[currentNationId];
      console.log(`  Removed nation: ${nationName}`);
      removedNations.push(nationName);
    }
  }
  
  if (removedNations.length > 0) {
    console.log(`  Removed ${removedNations.length} nations: ${removedNations.join(', ')}`);
  }
  
  // 3. Update existing nations with new data (preserve existing custom fields)
  const updatedNations: string[] = [];
  for (const newNation of newNations) {
    const nationId = newNation.id;
    const existingNation = updatedAlliance.nations[nationId];
    
    if (existingNation) {
      let hasChanges = false;
      
      // Only update ruler_name if it has changed
      if (existingNation.ruler_name !== newNation.rulerName) {
        existingNation.ruler_name = newNation.rulerName;
        hasChanges = true;
      }
      
      // Only update nation_name if it has changed
      if (existingNation.nation_name !== newNation.nationName) {
        existingNation.nation_name = newNation.nationName;
        hasChanges = true;
      }
      
      // Only update current_stats if they have changed
      const newStats = {
        technology: newNation.technology,
        infrastructure: newNation.infrastructure,
        strength: newNation.strength.toString()
      };
      
      if (!existingNation.current_stats ||
          existingNation.current_stats.technology !== newStats.technology ||
          existingNation.current_stats.infrastructure !== newStats.infrastructure ||
          existingNation.current_stats.strength !== newStats.strength) {
        existingNation.current_stats = newStats;
        hasChanges = true;
      }
      
      // Preserve existing custom fields (has_dra, notes, slots)
      // These are not updated from the raw data and should remain as configured
      // Note: discord_handle is stored separately in nation_discord_handles.json and not synced here
      
      if (hasChanges) {
        updatedNations.push(newNation.nationName);
      }
    }
  }
  
  if (updatedNations.length > 0) {
    console.log(`  Updated ${updatedNations.length} existing nations: ${updatedNations.join(', ')}`);
  }
  
  return updatedAlliance;
}

/**
 * Save alliance data to file (reused from allianceDataLoader)
 */
function saveAllianceData(allianceData: AllianceData): boolean {
  // Skip file operations in serverless environments like Vercel
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('Skipping alliance data save in serverless environment');
    return false;
  }

  const alliancesDir = getAlliancesDirectory();
  
  try {
    if (!fs.existsSync(alliancesDir)) {
      fs.mkdirSync(alliancesDir, { recursive: true });
    }
  } catch (error) {
    console.error('Could not create alliances directory:', error);
    return false;
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
 * Get statistics about the sync process
 */
export function getSyncStatistics(allianceData: AllianceData, newNations: Nation[]): {
  totalNationsInFile: number;
  totalNationsInNewData: number;
  nationsToAdd: number;
  nationsToRemove: number;
  nationsToUpdate: number;
} {
  const currentNationIds = new Set(Object.keys(allianceData.nations).map(id => parseInt(id)));
  const newNationIds = new Set(newNations.map(nation => nation.id));
  
  const nationsToAdd = newNations.filter(nation => !currentNationIds.has(nation.id)).length;
  const nationsToRemove = Array.from(currentNationIds).filter(id => !newNationIds.has(id)).length;
  const nationsToUpdate = newNations.filter(nation => currentNationIds.has(nation.id)).length;
  
  return {
    totalNationsInFile: currentNationIds.size,
    totalNationsInNewData: newNationIds.size,
    nationsToAdd,
    nationsToRemove,
    nationsToUpdate
  };
}
