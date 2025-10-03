import { 
  loadAllianceById, 
  saveAllianceData as saveAllianceDataUtil, 
  updateNationData,
  AllianceData,
  loadAllianceDataWithJsonPriority
} from '../utils/allianceDataLoader.js';
import { syncAllianceFilesWithNewData as syncAllianceFilesUtil } from '../utils/allianceSync.js';
import { 
  loadDataFromFilesWithUpdate,
  createNationsDictionary
} from './dataProcessingService.js';
import { Nation } from '../models/Nation.js';

export class AllianceService {
  /**
   * Get alliance data by ID
   */
  static getAllianceById(allianceId: number): AllianceData | null {
    return loadAllianceById(allianceId);
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
  static updateNationData(allianceId: number, nationId: number, updates: any): boolean {
    return updateNationData(allianceId, nationId, updates);
  }

  /**
   * Save alliance data
   */
  static saveAllianceData(allianceId: number, allianceData: AllianceData): boolean {
    return saveAllianceDataUtil(allianceData);
  }

  /**
   * Sync alliance files with new data
   */
  static async syncAllianceFilesWithNewData(nations: Nation[]): Promise<void> {
    return await syncAllianceFilesUtil(nations);
  }

  /**
   * Get alliance statistics
   */
  static async getAllianceStats(allianceId: number) {
    const { nations, aidOffers } = await loadDataFromFilesWithUpdate();
    const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    const allianceAidOffers = aidOffers.filter(offer => 
      (offer.declaringAllianceId === allianceId || offer.receivingAllianceId === allianceId) && 
      offer.status !== 'Expired'
    );

    const outgoingOffers = allianceAidOffers.filter(offer => offer.declaringAllianceId === allianceId);
    const incomingOffers = allianceAidOffers.filter(offer => offer.receivingAllianceId === allianceId);

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
    const allianceData = loadAllianceById(allianceId);
    
    if (!allianceData) {
      return {
        allianceExists: false,
        nations: []
      };
    }

    // Get raw nations data and convert to dictionary for efficient lookups
    const { nations: rawNations } = await loadDataFromFilesWithUpdate();
    const rawNationsDict = createNationsDictionary(rawNations);

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
        send_priority: 3,
        receive_priority: 3
      };
      
      const completeNationData = {
        nation_id: nationIdNum,
        ...nationData,
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