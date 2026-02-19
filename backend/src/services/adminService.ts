import { prisma } from '../utils/prisma.js';

export interface NationSearchResult {
  id: number;
  rulerName: string;
  nationName: string;
  allianceId: number;
  allianceName: string;
  targetingAllianceId: number | null;
  targetingAllianceName: string | null;
  strength: number;
  rank: number | null;
}

export interface WarSearchResult {
  warId: number;
  declaringNationId: number;
  declaringNationName: string;
  declaringRulerName: string;
  declaringAllianceId: number | null;
  declaringAllianceName: string | null;
  receivingNationId: number;
  receivingNationName: string;
  receivingRulerName: string;
  receivingAllianceId: number | null;
  receivingAllianceName: string | null;
  status: string;
  date: string;
  endDate: string;
}

export class AdminService {
  /**
   * Search for nations by name or ruler name
   */
  static async searchNations(query: string, limit: number = 50): Promise<NationSearchResult[]> {
    const nations = await prisma.nation.findMany({
      where: {
        isActive: true,
        OR: [
          { nationName: { contains: query, mode: 'insensitive' } },
          { rulerName: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        alliance: true
      },
      take: limit,
      orderBy: [
        { strength: 'desc' }
      ]
    });

    // Get targeting alliance names if they exist
    const targetingAllianceIds = nations
      .map(n => n.targetingAllianceId)
      .filter((id): id is number => id !== null);
    
    const targetingAlliances = targetingAllianceIds.length > 0
      ? await prisma.alliance.findMany({
          where: { id: { in: targetingAllianceIds } }
        })
      : [];
    
    const targetingAllianceMap = new Map(
      targetingAlliances.map(a => [a.id, a.name])
    );

    return nations.map(n => ({
      id: n.id,
      rulerName: n.rulerName,
      nationName: n.nationName,
      allianceId: n.allianceId,
      allianceName: n.alliance.name,
      targetingAllianceId: n.targetingAllianceId,
      targetingAllianceName: n.targetingAllianceId 
        ? targetingAllianceMap.get(n.targetingAllianceId) || null
        : null,
      strength: n.strength,
      rank: n.rank
    }));
  }

  /**
   * Set or clear the targeting alliance override for a nation
   */
  static async setNationTargetingAlliance(
    nationId: number,
    targetingAllianceId: number | null
  ): Promise<NationSearchResult> {
    // Verify nation exists
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: { alliance: true }
    });

    if (!nation) {
      throw new Error('Nation not found');
    }

    // If setting an alliance override, verify the alliance exists
    if (targetingAllianceId !== null) {
      const alliance = await prisma.alliance.findUnique({
        where: { id: targetingAllianceId }
      });
      if (!alliance) {
        throw new Error('Targeting alliance not found');
      }
    }

    // Update the nation
    const updated = await prisma.nation.update({
      where: { id: nationId },
      data: { targetingAllianceId },
      include: { alliance: true }
    });

    // Get targeting alliance name if set
    let targetingAllianceName: string | null = null;
    if (updated.targetingAllianceId) {
      const targetingAlliance = await prisma.alliance.findUnique({
        where: { id: updated.targetingAllianceId }
      });
      targetingAllianceName = targetingAlliance?.name || null;
    }

    return {
      id: updated.id,
      rulerName: updated.rulerName,
      nationName: updated.nationName,
      allianceId: updated.allianceId,
      allianceName: updated.alliance.name,
      targetingAllianceId: updated.targetingAllianceId,
      targetingAllianceName,
      strength: updated.strength,
      rank: updated.rank
    };
  }

  /**
   * Search for wars by war ID, nation name, or ruler name
   */
  static async searchWars(query: string, limit: number = 50, activeOnly: boolean = true): Promise<WarSearchResult[]> {
    const queryNum = parseInt(query, 10);
    const isNumeric = !isNaN(queryNum);

    const wars = await prisma.war.findMany({
      where: {
        AND: [
          {
            OR: [
              ...(isNumeric ? [{ warId: queryNum }] : []),
              {
                declaringNation: {
                  OR: [
                    { nationName: { contains: query, mode: 'insensitive' } },
                    { rulerName: { contains: query, mode: 'insensitive' } }
                  ]
                }
              },
              {
                receivingNation: {
                  OR: [
                    { nationName: { contains: query, mode: 'insensitive' } },
                    { rulerName: { contains: query, mode: 'insensitive' } }
                  ]
                }
              }
            ]
          },
          ...(activeOnly ? [{ isActive: true }] : [])
        ]
      },
      include: {
        declaringNation: {
          include: { alliance: true }
        },
        receivingNation: {
          include: { alliance: true }
        }
      },
      take: limit,
      orderBy: [
        { warId: 'desc' }
      ]
    });

    // Get unique alliance IDs that need to be looked up
    const allianceIdsToLookup = new Set<number>();
    wars.forEach(w => {
      if (w.declaringAllianceId) allianceIdsToLookup.add(w.declaringAllianceId);
      if (w.receivingAllianceId) allianceIdsToLookup.add(w.receivingAllianceId);
    });

    // Fetch all needed alliances
    const alliancesMap = new Map<number, string>();
    if (allianceIdsToLookup.size > 0) {
      const alliances = await prisma.alliance.findMany({
        where: { id: { in: Array.from(allianceIdsToLookup) } },
        select: { id: true, name: true }
      });
      alliances.forEach(a => alliancesMap.set(a.id, a.name));
    }

    return wars.map(w => ({
      warId: w.warId,
      declaringNationId: w.declaringNationId,
      declaringNationName: w.declaringNation.nationName,
      declaringRulerName: w.declaringNation.rulerName,
      declaringAllianceId: w.declaringAllianceId,
      declaringAllianceName: w.declaringAllianceId
        ? (alliancesMap.get(w.declaringAllianceId) || null)
        : null,
      receivingNationId: w.receivingNationId,
      receivingNationName: w.receivingNation.nationName,
      receivingRulerName: w.receivingNation.rulerName,
      receivingAllianceId: w.receivingAllianceId,
      receivingAllianceName: w.receivingAllianceId
        ? (alliancesMap.get(w.receivingAllianceId) || null)
        : null,
      status: w.status,
      date: w.date,
      endDate: w.endDate
    }));
  }

  /**
   * Update the declaring or receiving alliance ID for a war
   */
  static async updateWarAllianceIds(
    warId: number,
    declaringAllianceId: number | null | undefined,
    receivingAllianceId: number | null | undefined
  ): Promise<WarSearchResult> {
    // Verify war exists
    const war = await prisma.war.findUnique({
      where: { warId },
      include: {
        declaringNation: {
          include: { alliance: true }
        },
        receivingNation: {
          include: { alliance: true }
        }
      }
    });

    if (!war) {
      throw new Error('War not found');
    }

    // Verify alliances exist if provided
    if (declaringAllianceId !== null && declaringAllianceId !== undefined) {
      const alliance = await prisma.alliance.findUnique({
        where: { id: declaringAllianceId }
      });
      if (!alliance) {
        throw new Error('Declaring alliance not found');
      }
    }

    if (receivingAllianceId !== null && receivingAllianceId !== undefined) {
      const alliance = await prisma.alliance.findUnique({
        where: { id: receivingAllianceId }
      });
      if (!alliance) {
        throw new Error('Receiving alliance not found');
      }
    }

    // Build update data
    const updateData: {
      declaringAllianceId?: number | null;
      receivingAllianceId?: number | null;
    } = {};

    if (declaringAllianceId !== undefined) {
      updateData.declaringAllianceId = declaringAllianceId;
    }
    if (receivingAllianceId !== undefined) {
      updateData.receivingAllianceId = receivingAllianceId;
    }

    // Update the war
    const updated = await prisma.war.update({
      where: { warId },
      data: updateData,
      include: {
        declaringNation: {
          include: { alliance: true }
        },
        receivingNation: {
          include: { alliance: true }
        }
      }
    });

    // Get alliance names - look up by the alliance IDs stored on the war
    let declaringAllianceName: string | null = null;
    if (updated.declaringAllianceId) {
      const alliance = await prisma.alliance.findUnique({
        where: { id: updated.declaringAllianceId },
        select: { name: true }
      });
      declaringAllianceName = alliance?.name || null;
    }

    let receivingAllianceName: string | null = null;
    if (updated.receivingAllianceId) {
      const alliance = await prisma.alliance.findUnique({
        where: { id: updated.receivingAllianceId },
        select: { name: true }
      });
      receivingAllianceName = alliance?.name || null;
    }

    return {
      warId: updated.warId,
      declaringNationId: updated.declaringNationId,
      declaringNationName: updated.declaringNation.nationName,
      declaringRulerName: updated.declaringNation.rulerName,
      declaringAllianceId: updated.declaringAllianceId,
      declaringAllianceName,
      receivingNationId: updated.receivingNationId,
      receivingNationName: updated.receivingNation.nationName,
      receivingRulerName: updated.receivingNation.rulerName,
      receivingAllianceId: updated.receivingAllianceId,
      receivingAllianceName,
      status: updated.status,
      date: updated.date,
      endDate: updated.endDate
    };
  }
}

