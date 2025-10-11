import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface SpyglassData {
  nationName: string;
  ruler: string;
  alliance: string;
  strength: number;
  warchest: number;
  daysOld: number;
}

/**
 * Get the path to the spyglass data file, trying multiple locations
 */
function getSpyglassFilePath(): string {
  const candidates: string[] = [];
  
  // 1) dist relative (when running compiled code)
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    candidates.push(join(__dirname, '..', 'data', 'spyglass.txt')); // dist/services -> dist/data
    candidates.push(join(__dirname, '..', '..', 'src', 'data', 'spyglass.txt')); // fallback to src from dist
  } catch {}
  
  // 2) process cwd variants
  candidates.push(join(process.cwd(), 'dist', 'data', 'spyglass.txt'));
  candidates.push(join(process.cwd(), 'src', 'data', 'spyglass.txt'));
  candidates.push(join(process.cwd(), 'data', 'spyglass.txt'));

  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {}
  }
  
  // Default to src path as fallback
  return join(process.cwd(), 'src', 'data', 'spyglass.txt');
}

/**
 * Parse the spyglass.txt file to extract warchest information
 */
export function parseSpyglassData(filePath?: string): Map<string, SpyglassData> {
  // Use provided path or auto-detect
  const resolvedPath = filePath || getSpyglassFilePath();
  
  try {
    // Check if file exists before trying to read
    if (!existsSync(resolvedPath)) {
      console.log(`Spyglass file not found at ${resolvedPath}, returning empty data`);
      return new Map();
    }
    
    const content = readFileSync(resolvedPath, 'utf-8');
    const lines = content.split('\n');
    const spyglassMap = new Map<string, SpyglassData>();
    
    let currentEntry: Partial<SpyglassData> = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and the header
      if (!line || line.startsWith('Spyglass Results')) {
        continue;
      }
      
      // Check if this is a numbered entry (start of new nation)
      const numberMatch = line.match(/^\d+\.\s+(.+)$/);
      if (numberMatch) {
        // Save previous entry if complete
        if (currentEntry.nationName && currentEntry.ruler) {
          const key = `${currentEntry.ruler}|${currentEntry.nationName}`.toLowerCase();
          spyglassMap.set(key, currentEntry as SpyglassData);
        }
        
        // Start new entry
        currentEntry = {
          nationName: numberMatch[1],
        };
      } else if (line.startsWith('Ruler:')) {
        currentEntry.ruler = line.replace('Ruler:', '').trim();
      } else if (line.startsWith('Alliance:')) {
        currentEntry.alliance = line.replace('Alliance:', '').trim();
      } else if (line.startsWith('Strength:')) {
        const strengthStr = line.replace('Strength:', '').trim().replace(/,/g, '');
        currentEntry.strength = parseFloat(strengthStr) || 0;
      } else if (line.startsWith('Warchest:')) {
        const warchestStr = line.replace('Warchest:', '').trim()
          .replace(/\$/g, '')
          .replace(/,/g, '')
          .replace(/\.00$/, ''); // Remove trailing .00 if present
        currentEntry.warchest = parseFloat(warchestStr) || 0;
      } else if (line.startsWith('Last Updated:')) {
        const daysMatch = line.match(/(\d+)\s+days?\s+old/);
        currentEntry.daysOld = daysMatch ? parseInt(daysMatch[1]) : 0;
      }
    }
    
    // Save last entry if complete
    if (currentEntry.nationName && currentEntry.ruler) {
      const key = `${currentEntry.ruler}|${currentEntry.nationName}`.toLowerCase();
      spyglassMap.set(key, currentEntry as SpyglassData);
    }
    
    console.log(`Parsed ${spyglassMap.size} nations from spyglass data`);
    return spyglassMap;
  } catch (error) {
    console.error('Error parsing spyglass data:', error);
    return new Map();
  }
}

/**
 * Load spyglass data from the standard location
 */
export function loadSpyglassData(): Map<string, SpyglassData> {
  // Auto-detect the correct path
  return parseSpyglassData();
}

/**
 * Get spyglass data for a specific nation by ruler and nation name
 */
export function getSpyglassDataForNation(
  spyglassMap: Map<string, SpyglassData>,
  ruler: string,
  nationName: string
): SpyglassData | undefined {
  const key = `${ruler}|${nationName}`.toLowerCase();
  return spyglassMap.get(key);
}

