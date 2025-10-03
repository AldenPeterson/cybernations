import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import { ensureRecentFiles } from '../utils/dataDownloader.js';
import { Nation } from '../models/Nation.js';
import { AidOffer } from '../models/AidOffer.js';
import { Alliance } from '../models/Alliance.js';
import { AidSlot, NationAidSlots } from '../models/AidSlot.js';

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
          date: row['Begin Date'] as string || ''
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
  const rawDataPath = path.join(process.cwd(), 'src', 'raw_data', 'extracted');
  
  // Ensure we have recent files
  await ensureRecentFiles();
  
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
