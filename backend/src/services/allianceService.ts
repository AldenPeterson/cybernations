import { 
  loadAllianceById, 
  saveAllianceData as saveAllianceDataUtil, 
  updateNationData,
  AllianceData,
  loadAllianceData
} from '../utils/allianceDataLoader.js';
// Alliance sync is now handled via database - no file sync needed
import { 
  loadDataFromFilesWithUpdate,
  createNationsDictionary
} from './dataProcessingService.js';
import { Nation } from '../models/Nation.js';
import { loadNationDiscordHandles } from '../utils/nationDiscordHandles.js';

export class AllianceService {
  /**
   * Get alliance data by ID
   */
  static async getAllianceById(allianceId: number): Promise<AllianceData | null> {
    return await loadAllianceById(allianceId);
  }

  /**
   * Get alliance data with JSON priority
   */
  static async getAllianceData(allianceId: number) {
    return await loadAllianceData(allianceId);
  }

  /**
   * Update nation data in alliance files
   */
  static async updateNationData(allianceId: number, nationId: number, updates: any): Promise<boolean> {
    return await updateNationData(allianceId, nationId, updates);
  }

  /**
   * Save alliance data
   */
  static async saveAllianceData(allianceId: number, allianceData: AllianceData): Promise<boolean> {
    return await saveAllianceDataUtil(allianceData);
  }

  /**
   * Create and persist an alliance config file based on raw data if it doesn't exist.
   * Returns the created AllianceData or null if it could not be created.
   */
  static async createAllianceConfigFromRaw(allianceId: number): Promise<AllianceData | null> {
    // Load existing config first in case it was just created by another process
    const existing = await loadAllianceById(allianceId);
    if (existing) {
      return existing;
    }

    const { nations: rawNations } = await loadDataFromFilesWithUpdate();
    const discordHandles = await loadNationDiscordHandles();

    const defaultSlots = {
      sendTech: 0,
      sendCash: 0,
      getTech: 0,
      getCash: 0,
      external: 0,
      send_priority: 3,
      receive_priority: 3
    };

    const allianceNations = rawNations.filter(
      n => n.allianceId === allianceId && n.alliance && n.alliance.trim() !== ''
    );

    if (allianceNations.length === 0) {
      return null;
    }

    const allianceName = allianceNations[0].alliance || 'Unknown Alliance';

    const nationsMap: AllianceData['nations'] = {};
    for (const n of allianceNations) {
      const discordHandle = discordHandles[n.id.toString()]?.discord_handle || '';

      nationsMap[n.id] = {
        ruler_name: n.rulerName,
        nation_name: n.nationName,
        discord_handle: discordHandle,
        has_dra: false,
        slots: { ...defaultSlots },
        current_stats: {
          technology: n.technology,
          infrastructure: n.infrastructure,
          strength: n.strength.toLocaleString()
        }
      };
    }

    const allianceData: AllianceData = {
      alliance_id: allianceId,
      alliance_name: allianceName,
      nations: nationsMap
    };

    const saved = await saveAllianceDataUtil(allianceData);
    if (!saved) {
      return null;
    }

    return allianceData;
  }

  /**
   * Sync alliance files with new data
   * @deprecated Alliance data is now stored in the database via CSV imports
   * This method is kept for backwards compatibility but does nothing
   */
  static async syncAllianceFilesWithNewData(nations: Nation[]): Promise<void> {
    console.log('Alliance sync is no longer needed - data is stored in database via CSV imports');
    // Alliance data is automatically updated when CSV files are imported
    // No file-based sync is needed anymore
  }

  /**
   * Get alliance statistics
   */
  static async getAllianceStats(allianceId: number) {
    const { prisma } = await import('../utils/prisma.js');
    
    // Query only nations in this alliance
    const allianceNations = await prisma.nation.findMany({
      where: { allianceId },
      select: { id: true }
    });
    
    const allianceNationIds = allianceNations.map(n => n.id);
    
    if (allianceNationIds.length === 0) {
      return {
        totalNations: 0,
        totalOutgoingAid: 0,
        totalIncomingAid: 0,
        totalMoneyOut: 0,
        totalMoneyIn: 0,
        totalTechOut: 0,
        totalTechIn: 0,
        totalSoldiersOut: 0,
        totalSoldiersIn: 0
      };
    }
    
    // Query only aid offers involving nations in this alliance
    const allianceAidOffers = await prisma.aidOffer.findMany({
      where: {
        status: { not: 'Expired' },
        OR: [
          { declaringNationId: { in: allianceNationIds } },
          { receivingNationId: { in: allianceNationIds } }
        ]
      },
      select: {
        declaringNationId: true,
        receivingNationId: true,
        money: true,
        technology: true,
        soldiers: true
      }
    });

    const outgoingOffers = allianceAidOffers.filter(offer => allianceNationIds.includes(offer.declaringNationId));
    const incomingOffers = allianceAidOffers.filter(offer => allianceNationIds.includes(offer.receivingNationId));

    return {
      totalNations: allianceNationIds.length,
      totalOutgoingAid: outgoingOffers.length,
      totalIncomingAid: incomingOffers.length,
      totalMoneyOut: outgoingOffers.reduce((sum, offer) => sum + (offer.money || 0), 0),
      totalMoneyIn: incomingOffers.reduce((sum, offer) => sum + (offer.money || 0), 0),
      totalTechOut: outgoingOffers.reduce((sum, offer) => sum + (offer.technology || 0), 0),
      totalTechIn: incomingOffers.reduce((sum, offer) => sum + (offer.technology || 0), 0),
      totalSoldiersOut: outgoingOffers.reduce((sum, offer) => sum + (offer.soldiers || 0), 0),
      totalSoldiersIn: incomingOffers.reduce((sum, offer) => sum + (offer.soldiers || 0), 0)
    };
  }

  /**
   * Get alliance nations configuration
   */
  static async getNationsConfig(allianceId: number) {
    const allianceData = await loadAllianceById(allianceId);
    
    // Load discord handles from database
    const discordHandles = await loadNationDiscordHandles();

    // Query only nations in this alliance from database
    const { prisma } = await import('../utils/prisma.js');
    const rawNationRecords = await prisma.nation.findMany({
      where: { allianceId },
      include: { alliance: true }
    });
    
    const rawNations = rawNationRecords.map((n: any) => ({
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
    
    const rawNationsDict = createNationsDictionary(rawNations);

    // If alliance is not present in config files, build nations list from raw data
    if (!allianceData) {
      const defaultSlots = {
        sendTech: 0,
        sendCash: 0,
        getTech: 0,
        getCash: 0,
        external: 0,
        send_priority: 3,
        receive_priority: 3
      };

      const nationsArrayFromRaw = rawNations
        .filter(n => n.allianceId === allianceId && n.alliance && n.alliance.trim() !== '')
        .map(n => ({
          nation_id: n.id,
          ruler_name: n.rulerName,
          nation_name: n.nationName,
          discord_handle: discordHandles[n.id.toString()]?.discord_handle || '',
          has_dra: false,
          slots: { ...defaultSlots },
          current_stats: {
            technology: n.technology,
            infrastructure: n.infrastructure,
            strength: n.strength.toLocaleString()
          },
          inWarMode: n.inWarMode
        }));

      const allianceName = nationsArrayFromRaw[0]?.nation_name ? rawNations.find(n => n.allianceId === allianceId)?.alliance : undefined;

      return {
        allianceExists: true,
        allianceName: allianceName || 'Unknown Alliance',
        nations: nationsArrayFromRaw
      };
    }

    // Convert nations object back to array format and enrich with war mode status
    const nationsArray: any[] = [];
    for (const nationId in allianceData.nations) {
      const nationData = allianceData.nations[nationId];
      const nationIdNum = Number(nationId);
      
      // Ensure all slot fields have default values
      const defaultSlots = {
        sendTech: 0,
        sendCash: 0,
        getTech: 0,
        getCash: 0,
        external: 0,
        send_priority: 3,
        receive_priority: 3
      };
      
      // Get discord handle from separate file, falling back to alliance data if not found
      const discordHandle = discordHandles[nationId]?.discord_handle || nationData.discord_handle || '';
      
      const completeNationData = {
        nation_id: nationIdNum,
        ...nationData,
        discord_handle: discordHandle,
        slots: { ...defaultSlots, ...nationData.slots }, // Merge defaults with existing slots
        inWarMode: rawNationsDict[nationIdNum]?.inWarMode ?? false
      };
      
      nationsArray.push(completeNationData);
    }

    return {
      allianceExists: true,
      allianceName: allianceData.alliance_name,
      nations: nationsArray
    };
  }
}