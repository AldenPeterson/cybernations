import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import { ensureRecentFiles } from '../utils/dataDownloader.js';
import { Nation } from '../models/Nation.js';
import { AidOffer } from '../models/AidOffer.js';
import { Alliance } from '../models/Alliance.js';
import { AidSlot, NationAidSlots } from '../models/AidSlot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse nations from standardized CSV file
 */
async function parseNationsFromFile(filePath: string): Promise<Nation[]> {
  return new Promise((resolve, reject) => {
    const nations: Nation[] = [];
    
    createReadStream(filePath)
      .pipe(csv({
        separator: '|',
        headers: ['id', 'rulerName', 'nationName', 'alliance', 'allianceId', 'allianceDate', 'allianceStatus', 'governmentType', 'religion', 'team', 'created', 'technology', 'infrastructure', 'baseLand', 'warStatus', 'resource1', 'resource2', 'votes', 'strength', 'defcon', 'baseSoldiers', 'tanks', 'cruise', 'nukes', 'activity', 'connectedResource1', 'connectedResource2', 'connectedResource3', 'connectedResource4', 'connectedResource5', 'connectedResource6', 'connectedResource7', 'connectedResource8', 'connectedResource9', 'connectedResource10', 'attackingCasualties', 'defensiveCasualties']
      }))
      .on('data', (row) => {
        if (row.id && row.rulerName) {
          nations.push({
            id: parseInt(row.id),
            rulerName: decodeHtmlEntities(row.rulerName),
            nationName: decodeHtmlEntities(row.nationName),
            alliance: decodeHtmlEntities(row.alliance || ''),
            allianceId: parseInt(row.allianceId) || 0,
            team: row.team || '',
            strength: parseFloat(row.strength?.replace(/,/g, '') || '0'),
            activity: row.activity || '',
            technology: row.technology || '0',
            infrastructure: row.infrastructure || '0',
            nuclearWeapons: parseInt(row.nukes) || 0,
            governmentType: row.governmentType || '',
            inWarMode: row.warStatus === 'War Mode'
          });
        }
      })
      .on('end', () => {
        console.log(`Parsed ${nations.length} nations from standardized file`);
        resolve(nations);
      })
      .on('error', (error) => {
        console.error('Error parsing nations from standardized file:', error);
        reject(error);
      });
  });
}

/**
 * Parse aid offers from standardized CSV file
 */
async function parseAidOffersFromFile(filePath: string): Promise<AidOffer[]> {
  return new Promise((resolve, reject) => {
    const aidOffers: AidOffer[] = [];
    
    createReadStream(filePath)
      .pipe(csv({
        separator: '|',
        headers: ['declaringId', 'declaringRuler', 'declaringNation', 'declaringAlliance', 'declaringAllianceId', 'declaringTeam', 'receivingId', 'receivingRuler', 'receivingNation', 'receivingAlliance', 'receivingAllianceId', 'receivingTeam', 'status', 'money', 'technology', 'soldiers', 'date', 'reason', 'aidId']
      }))
      .on('data', (row) => {
        if (row.aidId && row.declaringId && row.receivingId) {
          aidOffers.push({
            aidId: parseInt(row.aidId),
            declaringId: parseInt(row.declaringId),
            declaringRuler: decodeHtmlEntities(row.declaringRuler || ''),
            declaringNation: decodeHtmlEntities(row.declaringNation),
            declaringAlliance: decodeHtmlEntities(row.declaringAlliance || ''),
            declaringAllianceId: parseInt(row.declaringAllianceId) || 0,
            receivingId: parseInt(row.receivingId),
            receivingRuler: decodeHtmlEntities(row.receivingRuler || ''),
            receivingNation: decodeHtmlEntities(row.receivingNation),
            receivingAlliance: decodeHtmlEntities(row.receivingAlliance || ''),
            receivingAllianceId: parseInt(row.receivingAllianceId) || 0,
            status: row.status || '',
            money: parseFloat(row.money?.replace(/,/g, '') || '0'),
            technology: parseFloat(row.technology?.replace(/,/g, '') || '0'),
            soldiers: parseInt(row.soldiers) || 0,
            date: row.date || '',
            reason: row.reason || ''
          });
        }
      })
      .on('end', () => {
        console.log(`Parsed ${aidOffers.length} aid offers from standardized file`);
        resolve(aidOffers);
      })
      .on('error', (error) => {
        console.error('Error parsing aid offers from standardized file:', error);
        reject(error);
      });
  });
}

/**
 * Parse wars from standardized CSV file
 */
async function parseWarsFromFile(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const wars: any[] = [];
    
    createReadStream(filePath)
      .pipe(csv({
        separator: '|',
        headers: ['declaringId', 'declaringRuler', 'declaringNation', 'declaringAlliance', 'declaringAllianceId', 'declaringTeam', 'receivingId', 'receivingRuler', 'receivingNation', 'receivingAlliance', 'receivingAllianceId', 'receivingTeam', 'warStatus', 'beginDate', 'endDate', 'reason', 'warId', 'destruction', 'attackPercent', 'defendPercent']
      }))
      .on('data', (row) => {
        if (row.warId && row.declaringId && row.receivingId) {
          wars.push({
            id: parseInt(row.warId),
            attackerNation: decodeHtmlEntities(row.declaringNation),
            attackerNationId: parseInt(row.declaringId),
            attackerAlliance: decodeHtmlEntities(row.declaringAlliance || ''),
            attackerAllianceId: parseInt(row.declaringAllianceId) || 0,
            defenderNation: decodeHtmlEntities(row.receivingNation),
            defenderNationId: parseInt(row.receivingId),
            defenderAlliance: decodeHtmlEntities(row.receivingAlliance || ''),
            defenderAllianceId: parseInt(row.receivingAllianceId) || 0,
            warType: row.reason || '',
            status: row.warStatus || '',
            startDate: row.beginDate || '',
            endDate: row.endDate || ''
          });
        }
      })
      .on('end', () => {
        console.log(`Parsed ${wars.length} wars from standardized file`);
        resolve(wars);
      })
      .on('error', (error) => {
        console.error('Error parsing wars from standardized file:', error);
        reject(error);
      });
  });
}

/**
 * Decodes HTML entities in a string
 * @param str - String that may contain HTML entities
 * @returns Decoded string
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return str;
  
  // Common HTML entities mapping
  const htmlEntities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
    '&#228;': 'ä',
    '&#229;': 'å',
    '&#246;': 'ö',
    '&#196;': 'Ä',
    '&#197;': 'Å',
    '&#214;': 'Ö',
    '&#252;': 'ü',
    '&#220;': 'Ü',
    '&#223;': 'ß',
    '&#233;': 'é',
    '&#232;': 'è',
    '&#224;': 'à',
    '&#225;': 'á',
    '&#226;': 'â',
    '&#227;': 'ã',
    '&#231;': 'ç',
    '&#237;': 'í',
    '&#238;': 'î',
    '&#239;': 'ï',
    '&#243;': 'ó',
    '&#244;': 'ô',
    '&#245;': 'õ',
    '&#250;': 'ú',
    '&#251;': 'û',
    '&#253;': 'ý',
    '&#255;': 'ÿ'
  };
  
  return str.replace(/&#?\w+;/g, (entity) => {
    return htmlEntities[entity] || entity;
  });
}

export function parseNationStats(filePath: string): Promise<Nation[]> {
  return new Promise((resolve, reject) => {
    const nations: Nation[] = [];
    let headerColumns: string[] = [];
    let isFirstRow = true;

    createReadStream(filePath)
      .pipe(csv({
        separator: '|'
      }))
      .on('headers', (headers: string[]) => {
        headerColumns = headers;
      })
      .on('data', (row: any) => {
        if (isFirstRow) {
          // Skip header row
          isFirstRow = false;
          return;
        }

        // Use row object directly with column names as keys
        const nation: Nation = {
          id: parseInt(row['Nation ID'] as string) || 0,
          rulerName: decodeHtmlEntities(row['Ruler Name'] as string || ''),
          nationName: decodeHtmlEntities(row['Nation Name'] as string || ''),
          alliance: decodeHtmlEntities(row['Alliance'] as string || ''),
          allianceId: parseInt(row['Alliance ID'] as string) || 0,
          team: row['Team'] as string || '',
          strength: parseFloat((row['Strength'] as string)?.replace(/,/g, '')) || 0,
          activity: row['Activity'] as string || '',
          technology: row['Technology'] as string || '0',
          infrastructure: row['Infrastructure'] as string || '0',
          nuclearWeapons: parseInt(row['Nukes'] as string) || 0,
          governmentType: row['Government Type'] as string || '',
          inWarMode: row['War Status'] ? (row['War Status'] as string).toLowerCase().includes('war') : false,
          attackingCasualties: parseInt((row['Attacking Casualties'] as string)?.replace(/,/g, '')) || 0,
          defensiveCasualties: parseInt((row['Defensive Casualties'] as string)?.replace(/,/g, '')) || 0
        };
        nations.push(nation);
      })
      .on('end', () => {
        resolve(nations);
      })
      .on('error', (error) => {
        console.error('Error parsing nation stats:', error);
        reject(error);
      });
  });
}

export function parseAidStats(filePath: string): Promise<AidOffer[]> {
  return new Promise((resolve, reject) => {
    const aidOffers: AidOffer[] = [];
    let headerColumns: string[] = [];
    let isFirstRow = true;

    createReadStream(filePath)
      .pipe(csv({
        separator: '|'
      }))
      .on('headers', (headers: string[]) => {
        headerColumns = headers;
      })
      .on('data', (row: any) => {
        if (isFirstRow) {
          // Skip header row
          isFirstRow = false;
          return;
        }

        // Use row object directly with column names as keys
        const aidOffer: AidOffer = {
          aidId: parseInt(row['Aid ID'] as string) || 0,
          declaringId: parseInt(row['Declaring ID'] as string) || 0,
          declaringRuler: decodeHtmlEntities(row['Declaring Ruler'] as string || ''),
          declaringNation: decodeHtmlEntities(row['Declaring Nation'] as string || ''),
          declaringAlliance: decodeHtmlEntities(row['Declaring Alliance'] as string || ''),
          declaringAllianceId: parseInt(row['Declaring Alliance ID'] as string) || 0,
          receivingId: parseInt(row['Receiving ID'] as string) || 0,
          receivingRuler: decodeHtmlEntities(row['Receiving Ruler'] as string || ''),
          receivingNation: decodeHtmlEntities(row['Receiving Nation'] as string || ''),
          receivingAlliance: decodeHtmlEntities(row['Receiving Alliance'] as string || ''),
          receivingAllianceId: parseInt(row['Receiving Alliance ID'] as string) || 0,
          status: row['Status'] as string || '',
          money: parseFloat((row['Money'] as string)?.replace(/,/g, '')) || 0,
          technology: parseFloat((row['Technology'] as string)?.replace(/,/g, '')) || 0,
          soldiers: parseFloat((row['Soldiers'] as string)?.replace(/,/g, '')) || 0,
          date: row['Date'] as string || '',
          reason: row['Reason'] as string || ''
        };
        aidOffers.push(aidOffer);
      })
      .on('end', () => {
        resolve(aidOffers);
      })
      .on('error', (error) => {
        console.error('Error parsing aid stats:', error);
        reject(error);
      });
  });
}

export function parseWarStats(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const wars: any[] = [];
    let headerColumns: string[] = [];
    let isFirstRow = true;

    createReadStream(filePath)
      .pipe(csv({
        separator: '|'
      }))
      .on('headers', (headers: string[]) => {
        headerColumns = headers;
      })
      .on('data', (row: any) => {
        if (isFirstRow) {
          // Skip header row
          isFirstRow = false;
          return;
        }

        // Use row object directly with column names as keys
        const war = {
          warId: parseInt(row['War ID'] as string) || 0,
          declaringId: parseInt(row['Declaring ID'] as string) || 0,
          declaringRuler: decodeHtmlEntities(row['Declaring Ruler'] as string || ''),
          declaringNation: decodeHtmlEntities(row['Declaring Nation'] as string || ''),
          declaringAlliance: decodeHtmlEntities(row['Declaring Alliance'] as string || ''),
          declaringAllianceId: parseInt(row['Declaring Alliance ID'] as string) || 0,
          receivingId: parseInt(row['Receiving ID'] as string) || 0,
          receivingRuler: decodeHtmlEntities(row['Receiving Ruler'] as string || ''),
          receivingNation: decodeHtmlEntities(row['Receiving Nation'] as string || ''),
          receivingAlliance: decodeHtmlEntities(row['Receiving Alliance'] as string || ''),
          receivingAllianceId: parseInt(row['Receiving Alliance ID'] as string) || 0,
          status: row['War Status'] as string || '',
          date: row['Begin Date'] as string || '',
          endDate: row['End Date'] as string || ''
        };
        wars.push(war);
      })
      .on('end', () => {
        resolve(wars);
      })
      .on('error', (error) => {
        console.error('Error parsing war stats:', error);
        reject(error);
      });
  });
}

export async function loadDataFromFiles(): Promise<{ nations: Nation[]; aidOffers: AidOffer[]; wars: any[] }> {
  // Try to load from new standardized data files first
  const standardizedDataPath = path.join(process.cwd(), 'src', 'data');
  
  if (fs.existsSync(standardizedDataPath)) {
    const nationsFile = path.join(standardizedDataPath, 'nations.csv');
    const aidOffersFile = path.join(standardizedDataPath, 'aid_offers.csv');
    const warsFile = path.join(standardizedDataPath, 'wars.csv');
    
    if (fs.existsSync(nationsFile) && fs.existsSync(aidOffersFile) && fs.existsSync(warsFile)) {
      console.log('Loading from standardized data files');
      
      const nations = await parseNationsFromFile(nationsFile);
      const aidOffers = await parseAidOffersFromFile(aidOffersFile);
      const wars = await parseWarsFromFile(warsFile);
      
      return { nations, aidOffers, wars };
    }
  }
  
  // Fallback to old system
  let rawDataPath = '';
  
  // In production, try to load from available files without downloading
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('Production environment detected, attempting to load from available files');
    
    // Try different possible paths for the raw data
    const possiblePaths = [
      path.join(process.cwd(), 'src', 'raw_data', 'extracted'),
      path.join(__dirname, '..', 'raw_data', 'extracted'),
      path.join(process.cwd(), 'dist', 'src', 'raw_data', 'extracted'),
      path.join(__dirname, '..', '..', 'raw_data', 'extracted')
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        rawDataPath = possiblePath;
        break;
      }
    }
    
    if (!rawDataPath) {
      console.warn('Raw data directory not found in production, returning empty data');
      return { nations: [], aidOffers: [], wars: [] };
    }
    
    console.log('Using raw data path in production:', rawDataPath);
  } else {
    // In development, use the normal flow with file downloads
    rawDataPath = path.join(process.cwd(), 'src', 'raw_data', 'extracted');
    
    // Ensure we have recent files
    await ensureRecentFiles();
    
    // Ensure the extracted directory exists
    if (!fs.existsSync(rawDataPath)) {
      console.warn('Extracted data directory does not exist:', rawDataPath);
      return { nations: [], aidOffers: [], wars: [] };
    }
  }
  
  const nations: Nation[] = [];
  const aidOffers: AidOffer[] = [];
  const wars: any[] = [];

  // Find all extracted directories
  const extractedDirs = fs.readdirSync(rawDataPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const dir of extractedDirs) {
    const dirPath = path.join(rawDataPath, dir);
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      if (file.includes('Nation_Stats')) {
        const nationData = await parseNationStats(filePath);
        nations.push(...nationData);
      } else if (file.includes('Aid_Stats')) {
        const aidData = await parseAidStats(filePath);
        aidOffers.push(...aidData);
      } else if (file.includes('War_Stats')) {
        const warData = await parseWarStats(filePath);
        wars.push(...warData);
      }
    }
  }

  return { nations, aidOffers, wars };
}

export async function loadDataFromFilesWithUpdate(): Promise<{ nations: Nation[]; aidOffers: AidOffer[]; wars: any[] }> {
  return await loadDataFromFiles();
}

export function groupNationsByAlliance(nations: Nation[]): Alliance[] {
  const allianceMap = new Map<number, Alliance>();

  nations.forEach(nation => {
    if (!allianceMap.has(nation.allianceId)) {
      allianceMap.set(nation.allianceId, {
        id: nation.allianceId,
        name: nation.alliance,
        nations: []
      });
    }
    allianceMap.get(nation.allianceId)!.nations.push(nation);
  });

  return Array.from(allianceMap.values());
}

/**
 * Converts raw nations array to a dictionary keyed by nation ID for efficient lookups
 * @param rawNations - Array of raw nation data
 * @returns Dictionary of nation ID to nation data
 */
export function createNationsDictionary(rawNations: Nation[]): Record<number, Nation> {
  const nationsDict: Record<number, Nation> = {};
  rawNations.forEach(nation => {
    nationsDict[nation.id] = nation;
  });
  return nationsDict;
}


export async function getAidSlotsForAlliance(allianceId: number, nations: Nation[], aidOffers: AidOffer[]): Promise<NationAidSlots[]> {
  const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
  
  // Get all active aid offers (not filtered by alliance)
  const activeAidOffers = aidOffers.filter(offer => offer.status !== 'Expired');

  return Promise.all(allianceNations.map(async nation => {
    const nationAidSlots: NationAidSlots = {
      nation,
      aidSlots: []
    };

    // Check if nation has DRA to determine number of slots
    const { getNationFromJson } = await import('./nationCategorizationService.js');
    const { has_dra } = getNationFromJson(nation.id);
    const totalSlots = has_dra ? 6 : 5;

    // Get all active aid offers for this nation (both outgoing and incoming)
    // regardless of their alliance membership when the aid was sent/received
    const nationAidOffers = activeAidOffers.filter(offer => 
      offer.declaringId === nation.id || offer.receivingId === nation.id
    );

    // Create slots for each nation (total slots based on DRA status)
    for (let i = 1; i <= totalSlots; i++) {
      const slot: AidSlot = {
        slotNumber: i,
        aidOffer: null,
        isOutgoing: false // Will be determined when aid offer is assigned
      };
      nationAidSlots.aidSlots.push(slot);
    }

    // Fill slots with existing aid offers
    nationAidOffers.forEach((offer, index) => {
      if (index < totalSlots) {
        const slot = nationAidSlots.aidSlots[index];
        slot.aidOffer = offer;
        slot.isOutgoing = offer.declaringId === nation.id;
      }
    });

    return nationAidSlots;
  }));
}
