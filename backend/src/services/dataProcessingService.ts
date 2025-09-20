import * as fs from 'fs';
import * as path from 'path';
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

export function parseNationStats(filePath: string): Nation[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Invalid nation stats file format');
    }

    const header = lines[0].split('|');
    const nations: Nation[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('|');
      if (values.length >= header.length) {
        const nation: Nation = {
          id: parseInt(values[0]) || 0,
          rulerName: decodeHtmlEntities(values[1] || ''),
          nationName: decodeHtmlEntities(values[2] || ''),
          alliance: decodeHtmlEntities(values[3] || ''),
          allianceId: parseInt(values[4]) || 0,
          team: values[9] || '',
          strength: parseFloat(values[18]?.replace(/,/g, '')) || 0,
          activity: values[24] || '',
          technology: values[11] || '0',
          infrastructure: values[12] || '0'
        };
        nations.push(nation);
      }
    }

    return nations;
  } catch (error) {
    console.error('Error parsing nation stats:', error);
    return [];
  }
}

export function parseAidStats(filePath: string): AidOffer[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Invalid aid stats file format');
    }

    const header = lines[0].split('|');
    const aidOffers: AidOffer[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('|');
      if (values.length >= header.length) {
        const aidOffer: AidOffer = {
          aidId: parseInt(values[18]) || 0, // Aid ID is the last column
          declaringId: parseInt(values[0]) || 0, // Declaring ID is first
          declaringRuler: decodeHtmlEntities(values[1] || ''),
          declaringNation: decodeHtmlEntities(values[2] || ''),
          declaringAlliance: decodeHtmlEntities(values[3] || ''),
          declaringAllianceId: parseInt(values[4]) || 0,
          receivingId: parseInt(values[6]) || 0,
          receivingRuler: decodeHtmlEntities(values[7] || ''),
          receivingNation: decodeHtmlEntities(values[8] || ''),
          receivingAlliance: decodeHtmlEntities(values[9] || ''),
          receivingAllianceId: parseInt(values[10]) || 0,
          status: values[12] || '',
          money: parseFloat(values[13]?.replace(/,/g, '')) || 0,
          technology: parseFloat(values[14]?.replace(/,/g, '')) || 0,
          soldiers: parseFloat(values[15]?.replace(/,/g, '')) || 0,
          date: values[16] || '',
          reason: values[17] || ''
        };
        aidOffers.push(aidOffer);
      }
    }

    return aidOffers;
  } catch (error) {
    console.error('Error parsing aid stats:', error);
    return [];
  }
}

export function parseWarStats(filePath: string): any[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Invalid war stats file format');
    }

    const header = lines[0].split('|');
    const wars: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('|');
      if (values.length >= header.length) {
        const war = {
          warId: parseInt(values[0]) || 0,
          declaringId: parseInt(values[1]) || 0,
          declaringRuler: decodeHtmlEntities(values[2] || ''),
          declaringNation: decodeHtmlEntities(values[3] || ''),
          declaringAlliance: decodeHtmlEntities(values[4] || ''),
          declaringAllianceId: parseInt(values[5]) || 0,
          receivingId: parseInt(values[6]) || 0,
          receivingRuler: decodeHtmlEntities(values[7] || ''),
          receivingNation: decodeHtmlEntities(values[8] || ''),
          receivingAlliance: decodeHtmlEntities(values[9] || ''),
          receivingAllianceId: parseInt(values[10]) || 0,
          status: values[11] || '',
          date: values[12] || ''
        };
        wars.push(war);
      }
    }

    return wars;
  } catch (error) {
    console.error('Error parsing war stats:', error);
    return [];
  }
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
        const nationData = parseNationStats(filePath);
        nations.push(...nationData);
      } else if (file.includes('Aid_Stats')) {
        const aidData = parseAidStats(filePath);
        aidOffers.push(...aidData);
      } else if (file.includes('War_Stats')) {
        const warData = parseWarStats(filePath);
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
