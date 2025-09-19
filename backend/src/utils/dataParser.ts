import * as fs from 'fs';
import * as path from 'path';
import { ensureRecentFiles } from './dataDownloader.js';

export interface Nation {
  id: number;
  rulerName: string;
  nationName: string;
  alliance: string;
  allianceId: number;
  team: string;
  strength: number;
  activity: string;
  technology: string;
  infrastructure: string;
}

export interface AidOffer {
  aidId: number;
  declaringId: number;
  declaringRuler: string;
  declaringNation: string;
  declaringAlliance: string;
  declaringAllianceId: number;
  receivingId: number;
  receivingRuler: string;
  receivingNation: string;
  receivingAlliance: string;
  receivingAllianceId: number;
  status: string;
  money: number;
  technology: number;
  soldiers: number;
  date: string;
  reason: string;
}

export interface Alliance {
  id: number;
  name: string;
  nations: Nation[];
}

export interface AidSlot {
  slotNumber: number;
  aidOffer: AidOffer | null;
  isOutgoing: boolean;
}

export interface NationAidSlots {
  nation: Nation;
  aidSlots: AidSlot[];
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
          rulerName: values[1] || '',
          nationName: values[2] || '',
          alliance: values[3] || '',
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
          aidId: parseInt(values[18]) || 0,
          declaringId: parseInt(values[0]) || 0,
          declaringRuler: values[1] || '',
          declaringNation: values[2] || '',
          declaringAlliance: values[3] || '',
          declaringAllianceId: parseInt(values[4]) || 0,
          receivingId: parseInt(values[6]) || 0,
          receivingRuler: values[7] || '',
          receivingNation: values[8] || '',
          receivingAlliance: values[9] || '',
          receivingAllianceId: parseInt(values[10]) || 0,
          status: values[12] || '',
          money: parseInt(values[13]) || 0,
          technology: parseInt(values[14]) || 0,
          soldiers: parseInt(values[15]) || 0,
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

export function groupNationsByAlliance(nations: Nation[]): Alliance[] {
  const allianceMap = new Map<number, Alliance>();

  nations.forEach(nation => {
    if (nation.allianceId === 0) return; // Skip nations without alliance

    if (!allianceMap.has(nation.allianceId)) {
      allianceMap.set(nation.allianceId, {
        id: nation.allianceId,
        name: nation.alliance,
        nations: []
      });
    }

    allianceMap.get(nation.allianceId)!.nations.push(nation);
  });

  // Sort nations within each alliance by strength (descending)
  allianceMap.forEach(alliance => {
    alliance.nations.sort((a, b) => b.strength - a.strength);
  });

  return Array.from(allianceMap.values()).sort((a, b) => b.nations.length - a.nations.length);
}

export function createAidSlotsForNation(nation: Nation, aidOffers: AidOffer[]): NationAidSlots {
  const aidSlots: AidSlot[] = [];
  
  // Initialize 6 empty slots
  for (let i = 1; i <= 6; i++) {
    aidSlots.push({
      slotNumber: i,
      aidOffer: null,
      isOutgoing: false
    });
  }

  // Find all aid offers for this nation (both incoming and outgoing, exclude only expired)
  const outgoingOffers = aidOffers.filter(offer => 
    offer.declaringId === nation.id && offer.status !== 'Expired'
  );

  const incomingOffers = aidOffers.filter(offer => 
    offer.receivingId === nation.id && offer.status !== 'Expired'
  );

  // Combine all offers and sort by date (most recent first)
  const allOffers = [
    ...outgoingOffers.map(offer => ({ ...offer, isOutgoing: true })),
    ...incomingOffers.map(offer => ({ ...offer, isOutgoing: false }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Fill up to 6 slots with the most recent offers
  allOffers.slice(0, 6).forEach((offer, index) => {
    aidSlots[index] = {
      slotNumber: index + 1,
      aidOffer: offer,
      isOutgoing: offer.isOutgoing
    };
  });

  return {
    nation,
    aidSlots
  };
}

export function getAidSlotsForAlliance(allianceId: number, nations: Nation[], aidOffers: AidOffer[]): NationAidSlots[] {
  const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
  
  return allianceNations.map(nation => createAidSlotsForNation(nation, aidOffers));
}


export function loadDataFromFiles(): { nations: Nation[], aidOffers: AidOffer[] } {
  const rawDataPath = path.join(process.cwd(), 'src', 'raw_data', 'extracted');
  
  let nations: Nation[] = [];
  let aidOffers: AidOffer[] = [];

  try {
    // Find nation stats file
    const nationStatsDir = fs.readdirSync(rawDataPath).find(dir => 
      dir.includes('Nation_Stats') && fs.statSync(path.join(rawDataPath, dir)).isDirectory()
    );
    
    if (nationStatsDir) {
      const nationStatsFile = path.join(rawDataPath, nationStatsDir, 'CyberNations_SE_Nation_Stats.txt');
      if (fs.existsSync(nationStatsFile)) {
        nations = parseNationStats(nationStatsFile);
        console.log(`Loaded ${nations.length} nations`);
      }
    }

    // Find aid stats file
    const aidStatsDir = fs.readdirSync(rawDataPath).find(dir => 
      dir.includes('Aid_Stats') && fs.statSync(path.join(rawDataPath, dir)).isDirectory()
    );
    
    if (aidStatsDir) {
      const aidStatsFile = path.join(rawDataPath, aidStatsDir, 'CyberNations_SE_Aid_Stats.txt');
      if (fs.existsSync(aidStatsFile)) {
        aidOffers = parseAidStats(aidStatsFile);
        console.log(`Loaded ${aidOffers.length} aid offers`);
      }
    }
  } catch (error) {
    console.error('Error loading data files:', error);
  }

  return { nations, aidOffers };
}

export async function loadDataFromFilesWithUpdate(): Promise<{ nations: Nation[], aidOffers: AidOffer[] }> {
  // First ensure we have the most recent files
  await ensureRecentFiles();
  
  // Then load the data as usual
  return loadDataFromFiles();
}
