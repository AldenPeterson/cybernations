import { prisma } from './prisma.js';
import { calculateAidDateInfo } from './dateUtils.js';

export interface AllianceData {
  alliance_id: number;
  alliance_name: string;
  nations: {
    [nationId: number]: {
      ruler_name: string;
      nation_name: string;
      discord_handle: string;
      has_dra: boolean;
      notes?: string;
      slots: {
        sendTech: number;
        sendCash: number;
        getTech: number;
        getCash: number;
        external: number;
        send_priority?: number;
        receive_priority?: number;
      };
      current_stats?: {
        technology: string;
        infrastructure: string;
        strength: string;
      };
    };
  };
}

export interface NationData {
  nation_id: number;
  ruler_name: string;
  nation_name: string;
  discord_handle: string;
  has_dra: boolean;
  notes?: string;
  slots: {
    sendTech: number;
    sendCash: number;
    getTech: number;
    getCash: number;
    external: number;
    send_priority?: number;
    receive_priority?: number;
  };
  current_stats?: {
    technology: string;
    infrastructure: string;
    strength: string;
  };
}

/**
 * Load all alliances from database
 */
export async function loadAllAlliances(): Promise<Map<number, AllianceData>> {
  const alliances = new Map<number, AllianceData>();
  
  try {
    const allianceRecords = await prisma.alliance.findMany({
      include: {
        nations: {
          include: {
            nationConfig: true,
          },
        },
      },
    });

    for (const alliance of allianceRecords) {
      const nations: { [nationId: number]: any } = {};
      
      for (const nation of alliance.nations) {
        const config = nation.nationConfig;
        if (!config) continue;
        nations[nation.id] = {
          ruler_name: nation.rulerName,
          nation_name: nation.nationName,
          discord_handle: config.discordHandle || '',
          has_dra: config.hasDra,
          notes: config.notes || undefined,
          slots: {
            sendTech: config.sendTechSlots,
            sendCash: config.sendCashSlots,
            getTech: config.getTechSlots,
            getCash: config.getCashSlots,
            external: config.externalSlots,
            send_priority: config.sendPriority,
            receive_priority: config.receivePriority,
          },
          current_stats: {
            technology: nation.technology || '0',
            infrastructure: nation.infrastructure || '0',
            strength: nation.strength.toString() || '0',
          },
        };
      }

      alliances.set(alliance.id, {
        alliance_id: alliance.id,
        alliance_name: alliance.name,
        nations,
      });
    }
  } catch (error) {
    console.error('Error loading alliances from database:', error);
  }
  
  return alliances;
}

/**
 * Load a specific alliance by ID
 */
export async function loadAllianceById(allianceId: number): Promise<AllianceData | null> {
  try {
    const alliance = await prisma.alliance.findUnique({
      where: { id: allianceId },
      include: {
        nations: {
          include: {
            nationConfig: true,
          },
        },
      },
    });

    if (!alliance) {
    return null;
  }
  
    const nations: { [nationId: number]: any } = {};
    
    for (const nation of alliance.nations) {
      const config = nation.nationConfig;
      if (!config) continue;
      nations[nation.id] = {
        ruler_name: nation.rulerName,
        nation_name: nation.nationName,
        discord_handle: config.discordHandle || '',
        has_dra: config.hasDra,
        notes: config.notes || undefined,
        slots: {
          sendTech: config.sendTechSlots,
          sendCash: config.sendCashSlots,
          getTech: config.getTechSlots,
          getCash: config.getCashSlots,
          external: config.externalSlots,
          send_priority: config.sendPriority,
          receive_priority: config.receivePriority,
        },
        current_stats: {
          technology: nation.technology || '0',
          infrastructure: nation.infrastructure || '0',
          strength: nation.strength.toString() || '0',
        },
      };
    }

    return {
      alliance_id: alliance.id,
      alliance_name: alliance.name,
      nations,
    };
  } catch (error) {
    console.error(`Error loading alliance ${allianceId} from database:`, error);
    return null;
  }
}

/**
 * Save alliance data to database
 */
export async function saveAllianceData(allianceData: AllianceData): Promise<boolean> {
  try {
    // Upsert alliance
    await prisma.alliance.upsert({
      where: { id: allianceData.alliance_id },
      update: { name: allianceData.alliance_name },
      create: { id: allianceData.alliance_id, name: allianceData.alliance_name },
    });

    // Upsert nation configs
    for (const [nationIdStr, nationData] of Object.entries(allianceData.nations)) {
      const nationId = parseInt(nationIdStr);
      
      // Ensure nation exists
      const nation = await prisma.nation.findUnique({
        where: { id: nationId },
      });

      if (!nation) {
        console.warn(`Nation ${nationId} not found, skipping config update`);
        continue;
      }

      await prisma.nationConfig.upsert({
        where: { nationId },
        update: {
          hasDra: nationData.has_dra,
          discordHandle: nationData.discord_handle || null,
          notes: nationData.notes || null,
          sendTechSlots: nationData.slots.sendTech || 0,
          sendCashSlots: nationData.slots.sendCash || 0,
          getTechSlots: nationData.slots.getTech || 0,
          getCashSlots: nationData.slots.getCash || 0,
          externalSlots: nationData.slots.external || 0,
          sendPriority: nationData.slots.send_priority ?? 3,
          receivePriority: nationData.slots.receive_priority ?? 3,
        },
        create: {
          nationId,
          hasDra: nationData.has_dra,
          discordHandle: nationData.discord_handle || null,
          notes: nationData.notes || null,
          sendTechSlots: nationData.slots.sendTech || 0,
          sendCashSlots: nationData.slots.sendCash || 0,
          getTechSlots: nationData.slots.getTech || 0,
          getCashSlots: nationData.slots.getCash || 0,
          externalSlots: nationData.slots.external || 0,
          sendPriority: nationData.slots.send_priority ?? 3,
          receivePriority: nationData.slots.receive_priority ?? 3,
        },
      });
    }

    return true;
  } catch (error) {
    console.error(`Error saving alliance ${allianceData.alliance_id} to database:`, error);
    return false;
  }
}

/**
 * Find a nation across all alliances
 */
export async function findNationById(nationId: number): Promise<{ alliance: AllianceData; nation: NationData } | null> {
  try {
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: {
        alliance: true,
        nationConfig: true,
      },
    });

    if (!nation || !nation.nationConfig) {
      return null;
    }

    const config = nation.nationConfig;
    const allianceData: AllianceData = {
      alliance_id: nation.alliance.id,
      alliance_name: nation.alliance.name,
      nations: {},
    };

    const nationData: NationData = {
      nation_id: nation.id,
      ruler_name: nation.rulerName,
      nation_name: nation.nationName,
      discord_handle: config.discordHandle || '',
      has_dra: config.hasDra,
      notes: config.notes || undefined,
      slots: {
        sendTech: config.sendTechSlots,
        sendCash: config.sendCashSlots,
        getTech: config.getTechSlots,
        getCash: config.getCashSlots,
        external: config.externalSlots,
        send_priority: config.sendPriority,
        receive_priority: config.receivePriority,
      },
      current_stats: {
        technology: nation.technology || '0',
        infrastructure: nation.infrastructure || '0',
        strength: nation.strength.toString() || '0',
      },
    };

    allianceData.nations[nation.id] = {
      ruler_name: nation.rulerName,
      nation_name: nation.nationName,
      discord_handle: config.discordHandle || '',
      has_dra: config.hasDra,
      notes: config.notes || undefined,
      slots: {
        sendTech: config.sendTechSlots,
        sendCash: config.sendCashSlots,
        getTech: config.getTechSlots,
        getCash: config.getCashSlots,
        external: config.externalSlots,
        send_priority: config.sendPriority,
        receive_priority: config.receivePriority,
      },
      current_stats: {
        technology: nation.technology || '0',
        infrastructure: nation.infrastructure || '0',
        strength: nation.strength.toString() || '0',
      },
    };

    return { alliance: allianceData, nation: nationData };
  } catch (error) {
    console.error(`Error finding nation ${nationId} in database:`, error);
    return null;
  }
}

/**
 * Update a specific nation's data
 */
export async function updateNationData(
  allianceId: number, 
  nationId: number, 
  updates: Partial<Omit<NationData, 'nation_id'>>
): Promise<boolean> {
  try {
    // Get existing config
    const existingConfig = await prisma.nationConfig.findUnique({
      where: { nationId },
    });

    if (!existingConfig) {
      // Create new config if it doesn't exist
      const nation = await prisma.nation.findUnique({
        where: { id: nationId },
      });

      if (!nation) {
    return false;
  }
  
    const defaultSlots = {
      sendTech: 0,
      sendCash: 0,
      getTech: 0,
      getCash: 0,
      external: 0,
      send_priority: 3,
        receive_priority: 3,
      };

      await prisma.nationConfig.create({
        data: {
          nationId,
          hasDra: updates.has_dra ?? false,
          discordHandle: updates.discord_handle || null,
          notes: updates.notes || null,
          sendTechSlots: updates.slots?.sendTech ?? defaultSlots.sendTech,
          sendCashSlots: updates.slots?.sendCash ?? defaultSlots.sendCash,
          getTechSlots: updates.slots?.getTech ?? defaultSlots.getTech,
          getCashSlots: updates.slots?.getCash ?? defaultSlots.getCash,
          externalSlots: updates.slots?.external ?? defaultSlots.external,
          sendPriority: updates.slots?.send_priority ?? defaultSlots.send_priority,
          receivePriority: updates.slots?.receive_priority ?? defaultSlots.receive_priority,
        },
      });

      return true;
    }

    // Merge slots updates
    const slotsUpdate: any = {};
    if (updates.slots) {
      slotsUpdate.sendTechSlots = updates.slots.sendTech ?? existingConfig.sendTechSlots;
      slotsUpdate.sendCashSlots = updates.slots.sendCash ?? existingConfig.sendCashSlots;
      slotsUpdate.getTechSlots = updates.slots.getTech ?? existingConfig.getTechSlots;
      slotsUpdate.getCashSlots = updates.slots.getCash ?? existingConfig.getCashSlots;
      slotsUpdate.externalSlots = updates.slots.external ?? existingConfig.externalSlots;
      slotsUpdate.sendPriority = updates.slots.send_priority ?? existingConfig.sendPriority;
      slotsUpdate.receivePriority = updates.slots.receive_priority ?? existingConfig.receivePriority;
    }

    // Update config
    await prisma.nationConfig.update({
      where: { nationId },
      data: {
        hasDra: updates.has_dra ?? existingConfig.hasDra,
        discordHandle: updates.discord_handle !== undefined ? (updates.discord_handle || null) : existingConfig.discordHandle,
        notes: updates.notes !== undefined ? (updates.notes || null) : existingConfig.notes,
        ...slotsUpdate,
      },
    });

    return true;
  } catch (error) {
    console.error(`Error updating nation ${nationId} data:`, error);
    return false;
  }
}

/**
 * Get all nations from all alliances in a flat array
 */
export async function getAllNationsFlat(): Promise<NationData[]> {
  try {
    const configs = await prisma.nationConfig.findMany({
      include: {
        nation: true,
      },
    });

    return configs.map((config: any) => {
      const nation = config.nation;
      return {
        nation_id: nation.id,
        ruler_name: nation.rulerName,
        nation_name: nation.nationName,
        discord_handle: config.discordHandle || '',
        has_dra: config.hasDra,
        notes: config.notes || undefined,
        slots: {
          sendTech: config.sendTechSlots,
          sendCash: config.sendCashSlots,
          getTech: config.getTechSlots,
          getCash: config.getCashSlots,
          external: config.externalSlots,
          send_priority: config.sendPriority,
          receive_priority: config.receivePriority,
        },
        current_stats: {
          technology: nation.technology || '0',
          infrastructure: nation.infrastructure || '0',
          strength: nation.strength.toString() || '0',
        },
      };
    });
  } catch (error) {
    console.error('Error loading all nations from database:', error);
    return [];
  }
}

/**
 * Load alliance data with JSON priority - uses database config if available, falls back to raw data
 */
export async function loadAllianceData(allianceId: number): Promise<{
  nations: any[];
  aidOffers: any[];
  useJsonData: boolean;
}> {
  const { prisma } = await import('../utils/prisma.js');
  
  // First try to load from database configuration
  const allianceData = await loadAllianceById(allianceId);
  
  if (allianceData && Object.keys(allianceData.nations).length > 0) {
    // Query only nations in this alliance for war mode status
    const allianceNationIds = Object.keys(allianceData.nations).map(id => parseInt(id));
    const rawNationRecords = await prisma.nation.findMany({
      where: { id: { in: allianceNationIds } },
      select: { id: true, inWarMode: true }
    });
    
    // Create a dictionary of raw nations keyed by nation ID for efficient lookups
    const rawNationsDict: Record<number, { inWarMode: boolean }> = {};
    rawNationRecords.forEach(n => {
      rawNationsDict[n.id] = { inWarMode: n.inWarMode };
    });

    // Query aid offers involving nations in this alliance
    // Only get active offers (present in latest CSV data)
    // Don't filter by status here - we'll filter by date-based expiration in memory
    const aidOfferRecords = await prisma.aidOffer.findMany({
      where: {
        isActive: true,
        OR: [
          { declaringNationId: { in: allianceNationIds } },
          { receivingNationId: { in: allianceNationIds } }
        ]
      },
      include: {
        declaringNation: {
          include: { alliance: true },
        },
        receivingNation: {
          include: { alliance: true },
        },
      },
    });
    
    const aidOffers = aidOfferRecords
      .map((a: any) => {
        // Calculate all date-related fields
        let dateInfo: { expirationDate?: string; daysUntilExpiration?: number; isExpired?: boolean } = {};
        try {
          if (a.date) {
            dateInfo = calculateAidDateInfo(a.date);
          }
        } catch (error) {
          console.warn(`Failed to calculate date info for aid offer ${a.aidId} with date "${a.date}":`, error);
        }
        
        return {
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
          expirationDate: dateInfo.expirationDate,
          daysUntilExpiration: dateInfo.daysUntilExpiration,
          isExpired: dateInfo.isExpired ?? a.isExpired ?? false,
        };
      })
      // Filter out expired offers (by status OR by date calculation)
      .filter(offer => {
        const isStatusExpired = offer.status === 'Expired' || offer.status === 'Cancelled';
        const isDateExpired = offer.isExpired === true;
        return !isStatusExpired && !isDateExpired;
      });

    // Convert database data to the format expected by the frontend and enrich with war mode status
    const nationsArray = Object.entries(allianceData.nations).map(([nationId, nationData]) => {
      // Ensure all slots have default values including priorities
      const defaultSlots = {
        sendTech: 0,
        sendCash: 0,
        getTech: 0,
        getCash: 0,
        external: 0,
        send_priority: 3,
        receive_priority: 3
      };
      
      return {
        id: parseInt(nationId),
        nation_id: parseInt(nationId),
        rulerName: nationData.ruler_name,
        nationName: nationData.nation_name,
        discord_handle: nationData.discord_handle || '',
        alliance: allianceData.alliance_name,
        allianceId: allianceId,
        team: '', // Not available in config
        strength: parseFloat(nationData.current_stats?.strength?.replace(/,/g, '') || '0'),
        activity: '', // Not available in config
        technology: nationData.current_stats?.technology || '0',
        infrastructure: nationData.current_stats?.infrastructure || '0',
        inWarMode: rawNationsDict[parseInt(nationId)]?.inWarMode ?? false,
        has_dra: nationData.has_dra,
        slots: { ...defaultSlots, ...nationData.slots }
      };
    });
    
    return {
      nations: nationsArray,
      aidOffers,
      useJsonData: true
    };
  }
  
  // Fall back to querying only alliance nations and their aid offers from database
  const nationRecords = await prisma.nation.findMany({
    where: { allianceId },
    include: { alliance: true },
  });
  
  const nations = nationRecords.map((n: any) => ({
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
  
  const allianceNationIds = nations.map(n => n.id);
  
  // Query aid offers involving nations in this alliance
  // Only get active offers (present in latest CSV data)
  // Don't filter by status here - we'll filter by date-based expiration in memory
  const aidOfferRecords = await prisma.aidOffer.findMany({
    where: {
      isActive: true,
      OR: [
        { declaringNationId: { in: allianceNationIds } },
        { receivingNationId: { in: allianceNationIds } }
      ]
    },
    include: {
      declaringNation: {
        include: { alliance: true },
      },
      receivingNation: {
        include: { alliance: true },
      },
    },
  });
  
  const aidOffers = aidOfferRecords
    .map((a: any) => {
      // Calculate all date-related fields
      let dateInfo: { expirationDate?: string; daysUntilExpiration?: number; isExpired?: boolean } = {};
      try {
        if (a.date) {
          dateInfo = calculateAidDateInfo(a.date);
        }
      } catch (error) {
        console.warn(`Failed to calculate date info for aid offer ${a.aidId} with date "${a.date}":`, error);
      }
      
      return {
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
        expirationDate: dateInfo.expirationDate,
        daysUntilExpiration: dateInfo.daysUntilExpiration,
        isExpired: dateInfo.isExpired ?? a.isExpired ?? false,
      };
    })
    // Filter out expired offers (by status OR by date calculation)
    .filter(offer => {
      const isStatusExpired = offer.status === 'Expired' || offer.status === 'Cancelled';
      const isDateExpired = offer.isExpired === true;
      return !isStatusExpired && !isDateExpired;
    });
  
  return {
    nations,
    aidOffers,
    useJsonData: false
  };
}
