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
import { prisma } from '../utils/prisma.js';
import { isAidOfferExpired, calculateAidDateInfo, getAidDaysUntilExpiration } from '../utils/dateUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for loaded data to avoid repeated database queries
interface DataCache {
  data: { nations: Nation[]; aidOffers: AidOffer[]; wars: any[] };
  timestamp: number;
}

let dataCache: DataCache | null = null;
const CACHE_TTL_MS = 60000;
let loadingPromise: Promise<{ nations: Nation[]; aidOffers: AidOffer[]; wars: any[] }> | null = null; // 60 seconds cache TTL

/**
 * Invalidate the data cache to force a fresh load on next request
 */
export function invalidateDataCache(): void {
  dataCache = null;
}

/**
 * Parse nations from standardized CSV file
 */
async function parseNationsFromFile(filePath: string): Promise<Nation[]> {
  return new Promise((resolve, reject) => {
    const nations: Nation[] = [];
    let currentRank = 1; // Start at rank 1 (strongest nation)
    
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
            rank: currentRank, // Assign current rank
            strength: parseFloat(row.strength?.replace(/,/g, '') || '0'),
            activity: row.activity || '',
            technology: row.technology || '0',
            infrastructure: row.infrastructure || '0',
            land: row.baseLand || '0',
            nuclearWeapons: parseInt(row.nukes) || 0,
            governmentType: row.governmentType || '',
            inWarMode: row.warStatus === 'War Mode'
          });
          currentRank++; // Increment rank for next nation
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
          const baseOffer = {
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
          };

          // Don't calculate date fields here - do it on-demand to avoid performance issues
          aidOffers.push(baseOffer);
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
            warId: parseInt(row.warId),
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
            status: row.warStatus || '',
            date: row.beginDate || '',
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
    let currentRank = 1; // Start at rank 1 (strongest nation)

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
          rank: currentRank, // Assign current rank
          strength: parseFloat((row['Strength'] as string)?.replace(/,/g, '')) || 0,
          activity: row['Activity'] as string || '',
          technology: row['Technology'] as string || '0',
          infrastructure: row['Infrastructure'] as string || '0',
          land: row['Base Land'] as string || '0',
          nuclearWeapons: parseInt(row['Nukes'] as string) || 0,
          governmentType: row['Government Type'] as string || '',
          inWarMode: row['War Status'] ? (row['War Status'] as string).toLowerCase().includes('war') : false,
          attackingCasualties: parseInt((row['Attacking Casualties'] as string)?.replace(/,/g, '')) || 0,
          defensiveCasualties: parseInt((row['Defensive Casualties'] as string)?.replace(/,/g, '')) || 0
        };
        nations.push(nation);
        currentRank++; // Increment rank for next nation
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
        const baseOffer: AidOffer = {
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

        // Don't calculate date fields here - do it on-demand to avoid performance issues
        aidOffers.push(baseOffer);
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

export async function loadDataFromFiles(checkForUpdates: boolean = true): Promise<{ nations: Nation[]; aidOffers: AidOffer[]; wars: any[] }> {
  // Check cache first
  const now = Date.now();
  if (dataCache && (now - dataCache.timestamp) < CACHE_TTL_MS) {
    // Cache is still valid, return cached data
    console.log('Using cached data (cache hit)');
    return dataCache.data;
  }

  // If another request is already loading, wait for it instead of loading again
  if (loadingPromise) {
    console.log('Another request is loading data, waiting for it to complete...');
    return await loadingPromise;
  }

  // Load from database
  loadingPromise = (async () => {
    try {
      console.log('Loading data from database...');
    
    // Load nations
    const nationRecords = await prisma.nation.findMany({
      where: { isActive: true },
      include: {
        alliance: true,
      },
    });
    
    const nations: Nation[] = nationRecords.map((n: any) => ({
      id: n.id,
      rulerName: n.rulerName,
      nationName: n.nationName,
      alliance: n.alliance.name,
      allianceId: n.allianceId,
      team: n.team,
      strength: n.strength,
      activity: n.activity,
      technology: n.technology,
      infrastructure: n.infrastructure,
      land: n.land,
      nuclearWeapons: n.nuclearWeapons,
      governmentType: n.governmentType,
      inWarMode: n.inWarMode,
      attackingCasualties: n.attackingCasualties ?? undefined,
      defensiveCasualties: n.defensiveCasualties ?? undefined,
      warchest: n.warchest ?? undefined,
      spyglassLastUpdated: n.spyglassLastUpdated ?? undefined,
      rank: n.rank ?? undefined,
    }));

    // Load aid offers
    const aidOfferRecords = await prisma.aidOffer.findMany({
      include: {
        declaringNation: {
          include: { alliance: true },
        },
        receivingNation: {
          include: { alliance: true },
        },
      },
    });
    
    const aidOffers: AidOffer[] = aidOfferRecords.map((a: any) => ({
      aidId: a.aidId,
      declaringId: a.declaringNationId,
      declaringRuler: a.declaringNation.rulerName,
      declaringNation: a.declaringNation.nationName,
      declaringAlliance: a.declaringNation.alliance.name,
      declaringAllianceId: a.declaringNation.allianceId,
      receivingId: a.receivingNationId,
      receivingRuler: a.receivingNation.rulerName,
      receivingNation: a.receivingNation.nationName,
      receivingAlliance: a.receivingNation.alliance.name,
      receivingAllianceId: a.receivingNation.allianceId,
      status: a.status,
      money: a.money,
      technology: a.technology,
      soldiers: a.soldiers,
      date: a.date,
      reason: a.reason,
      isExpired: a.isExpired ?? undefined,
    }));

    // Load wars
    const warRecords = await prisma.war.findMany({
      include: {
        declaringNation: {
          include: { alliance: true },
        },
        receivingNation: {
          include: { alliance: true },
        },
      },
    });
    
    const wars: any[] = warRecords.map((w: any) => ({
      warId: w.warId,
      declaringId: w.declaringNationId,
      declaringRuler: w.declaringNation.rulerName,
      declaringNation: w.declaringNation.nationName,
      declaringAlliance: w.declaringNation.alliance.name,
      declaringAllianceId: w.declaringNation.allianceId,
      receivingId: w.receivingNationId,
      receivingRuler: w.receivingNation.rulerName,
      receivingNation: w.receivingNation.nationName,
      receivingAlliance: w.receivingNation.alliance.name,
      receivingAllianceId: w.receivingNation.allianceId,
      status: w.status,
      date: w.date,
      endDate: w.endDate,
      reason: w.reason ?? undefined,
      destruction: w.destruction ?? undefined,
      attackPercent: w.attackPercent ?? undefined,
      defendPercent: w.defendPercent ?? undefined,
      formattedEndDate: w.formattedEndDate ?? undefined,
      daysUntilExpiration: w.daysUntilExpiration ?? undefined,
      expirationColor: w.expirationColor ?? undefined,
      isExpired: w.isExpired ?? undefined,
    }));

      const result = { nations, aidOffers, wars };
      
      // Update cache
      dataCache = {
        data: result,
        timestamp: now
      };

      console.log(`Successfully loaded ${nations.length} nations, ${aidOffers.length} aid offers, ${wars.length} wars from database`);
      return result;
    } catch (error) {
      console.error('Error loading data from database:', error);
      // Fallback to cached data if available, otherwise empty data
      if (dataCache) {
        console.log('Using cached data due to error');
        return dataCache.data;
      }
      return { nations: [], aidOffers: [], wars: [] };
    } finally {
      // Clear the loading promise so future requests can load again if needed
      loadingPromise = null;
    }
  })();

  return await loadingPromise;
}

export async function loadDataFromFilesWithUpdate(): Promise<{ nations: Nation[]; aidOffers: AidOffer[]; wars: any[] }> {
  // Wars are now all in the same table, no merging needed
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


/**
 * Helper function to check if an aid offer is expired (by status or by date)
 */
function isOfferExpired(offer: AidOffer): boolean {
  // Check status first
  if (offer.status === 'Expired' || offer.status === 'Cancelled') {
    return true;
  }
  
  // Check date-based expiration - use the calculated field if available
  if (offer.isExpired === true) {
    return true;
  }
  
  // Also check daysUntilExpiration - if 0 or negative, it's expired
  if (offer.daysUntilExpiration !== undefined) {
    if (offer.daysUntilExpiration <= 0) {
      return true;
    }
    // If daysUntilExpiration > 0, it's not expired
    return false;
  }
  
  // Calculate expiration based on date if not already calculated
  if (offer.date) {
    try {
      return isAidOfferExpired(offer.date);
    } catch (error) {
      console.warn(`Failed to calculate expiration for aid offer ${offer.aidId} with date "${offer.date}":`, error);
      // If we can't parse the date, don't filter it out - allow it through
      return false;
    }
  }
  
  // If no date available, can't determine expiration - don't filter it out
  return false;
}

export async function getAidSlotsForAlliance(allianceId: number, nations: Nation[], aidOffers: AidOffer[]): Promise<NationAidSlots[]> {
  const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
  
  // Calculate date fields for all offers and filter out expired ones
  const activeAidOffers = aidOffers
    .map(offer => {
      // Always recalculate date fields to ensure accuracy
      if (offer.date) {
        try {
          const dateInfo = calculateAidDateInfo(offer.date);
          return {
            ...offer,
            expirationDate: dateInfo.expirationDate,
            daysUntilExpiration: dateInfo.daysUntilExpiration,
            isExpired: dateInfo.isExpired,
          };
        } catch (error) {
          console.warn(`Failed to calculate date info for aid offer ${offer.aidId} with date "${offer.date}":`, error);
          // If we can't calculate, keep the offer but mark as not expired (will be checked again in filter)
          return {
            ...offer,
            isExpired: false,
          };
        }
      }
      // If no date, can't determine expiration - keep offer but mark as not expired
      return {
        ...offer,
        isExpired: false,
      };
    })
    .filter(offer => !isOfferExpired(offer));

  return Promise.all(allianceNations.map(async nation => {
    const nationAidSlots: NationAidSlots = {
      nation,
      aidSlots: []
    };

    // Always create 6 slots for display purposes
    // DRA is only used for aid assignment logic, not for slot display
    const totalSlots = 6;

    // Get all active aid offers for this nation (both outgoing and incoming)
    // regardless of their alliance membership when the aid was sent/received
    const nationAidOffers = activeAidOffers.filter(offer => 
      offer.declaringId === nation.id || offer.receivingId === nation.id
    );

    // Create slots for each nation (always 6 slots for display)
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
