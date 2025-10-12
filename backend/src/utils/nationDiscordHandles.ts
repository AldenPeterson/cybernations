import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface NationDiscordData {
  discord_handle: string;
  last_updated: string;
}

export interface NationDiscordHandles {
  [nationId: string]: NationDiscordData;
}

/**
 * Get the path to the nation discord handles file
 */
function getDiscordHandlesFilePath(): string {
  return path.join(process.cwd(), 'src', 'data', 'nation_discord_handles.json');
}

/**
 * Load all nation discord handles from file
 */
export function loadNationDiscordHandles(): NationDiscordHandles {
  // Skip file operations in serverless environments like Vercel
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('Skipping discord handles load in serverless environment');
    return {};
  }

  const filePath = getDiscordHandlesFilePath();
  
  if (!fs.existsSync(filePath)) {
    console.log('Nation discord handles file does not exist, returning empty object');
    return {};
  }
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data) as NationDiscordHandles;
  } catch (error) {
    console.error('Error loading nation discord handles:', error);
    return {};
  }
}

/**
 * Save nation discord handles to file
 */
export function saveNationDiscordHandles(handles: NationDiscordHandles): boolean {
  // Skip file operations in serverless environments like Vercel
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('Skipping discord handles save in serverless environment');
    return false;
  }

  const filePath = getDiscordHandlesFilePath();
  
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(handles, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving nation discord handles:', error);
    return false;
  }
}

/**
 * Get discord handle for a specific nation
 */
export function getDiscordHandle(nationId: number): string | null {
  const handles = loadNationDiscordHandles();
  const data = handles[nationId.toString()];
  return data ? data.discord_handle : null;
}

/**
 * Update discord handle for a specific nation
 */
export function updateDiscordHandle(nationId: number, discordHandle: string): boolean {
  const handles = loadNationDiscordHandles();
  
  handles[nationId.toString()] = {
    discord_handle: discordHandle,
    last_updated: new Date().toISOString()
  };
  
  return saveNationDiscordHandles(handles);
}

/**
 * Delete discord handle for a specific nation
 */
export function deleteDiscordHandle(nationId: number): boolean {
  const handles = loadNationDiscordHandles();
  delete handles[nationId.toString()];
  return saveNationDiscordHandles(handles);
}

/**
 * Get all nations with discord handles
 */
export function getAllNationsWithDiscordHandles(): { nationId: number; discordHandle: string; lastUpdated: string }[] {
  const handles = loadNationDiscordHandles();
  return Object.entries(handles).map(([nationId, data]) => ({
    nationId: parseInt(nationId),
    discordHandle: data.discord_handle,
    lastUpdated: data.last_updated
  }));
}

/**
 * Merge discord handles into nation data
 * This is a utility function to join discord handle data with nation data
 */
export function mergeDiscordHandles<T extends { nation_id?: number; id?: number }>(
  nations: T[],
  handleField: string = 'discord_handle'
): T[] {
  const handles = loadNationDiscordHandles();
  
  return nations.map(nation => {
    const nationId = nation.nation_id || nation.id;
    if (nationId) {
      const handleData = handles[nationId.toString()];
      return {
        ...nation,
        [handleField]: handleData ? handleData.discord_handle : ''
      };
    }
    return nation;
  });
}

