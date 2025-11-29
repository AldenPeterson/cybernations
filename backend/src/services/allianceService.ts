import { 
  loadAllianceById, 
  saveAllianceData as saveAllianceDataUtil, 
  updateNationData,
  AllianceData,
  loadAllianceDataWithJsonPriority
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
  static async getAllianceDataWithJsonPriority(allianceId: number) {
    return await loadAllianceDataWithJsonPriority(allianceId);
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
    const { nations, aidOffers } = await loadDataFromFilesWithUpdate();
    const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    const allianceNationIds = new Set(allianceNations.map(nation => nation.id));
    
    // Filter aid offers involving current alliance members, regardless of alliance at aid time
    const allianceAidOffers = aidOffers.filter(offer => 
      (allianceNationIds.has(offer.declaringId) || allianceNationIds.has(offer.receivingId)) && 
      offer.status !== 'Expired'
    );

    const outgoingOffers = allianceAidOffers.filter(offer => allianceNationIds.has(offer.declaringId));
    const incomingOffers = allianceAidOffers.filter(offer => allianceNationIds.has(offer.receivingId));

    return {
      totalNations: allianceNations.length,
      totalOutgoingAid: outgoingOffers.length,
      totalIncomingAid: incomingOffers.length,
      totalMoneyOut: outgoingOffers.reduce((sum, offer) => sum + offer.money, 0),
      totalMoneyIn: incomingOffers.reduce((sum, offer) => sum + offer.money, 0),
      totalTechOut: outgoingOffers.reduce((sum, offer) => sum + offer.technology, 0),
      totalTechIn: incomingOffers.reduce((sum, offer) => sum + offer.technology, 0),
      totalSoldiersOut: outgoingOffers.reduce((sum, offer) => sum + offer.soldiers, 0),
      totalSoldiersIn: incomingOffers.reduce((sum, offer) => sum + offer.soldiers, 0)
    };
  }

  /**
   * Get alliance nations configuration
   */
  static async getNationsConfig(allianceId: number) {
    const allianceData = await loadAllianceById(allianceId);
    
    // Load discord handles from database
    const discordHandles = await loadNationDiscordHandles();

    // Get raw nations data and convert to dictionary for efficient lookups
    const { nations: rawNations } = await loadDataFromFilesWithUpdate();
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