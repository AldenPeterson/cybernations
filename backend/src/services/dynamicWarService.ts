import { prisma } from '../utils/prisma.js';

export interface DynamicWarInput {
  warId: number;
  declaringId: number;
  receivingId: number;
  status: string;
  date: string;
  endDate: string;
  reason?: string;
  destruction?: string;
  attackPercent?: number;
  defendPercent?: number;
}

export class DynamicWarService {
  /**
   * Add or update a war in the War table (same logic as CSV import)
   * This replaces the old dynamic wars table approach
   */
  static async addDynamicWar(warData: DynamicWarInput): Promise<any> {
    // Ensure nations exist
    const declaringNation = await prisma.nation.findUnique({
      where: { id: warData.declaringId },
    });
    const receivingNation = await prisma.nation.findUnique({
      where: { id: warData.receivingId },
    });

    if (!declaringNation || !receivingNation) {
      throw new Error('Declaring or receiving nation not found');
    }

    const now = new Date();

    // Check if war already exists
    const existingWar = await prisma.war.findUnique({
      where: { warId: warData.warId },
      select: { warId: true, version: true },
    });

    const warDataToUpsert = {
      warId: warData.warId,
      declaringNationId: warData.declaringId,
      receivingNationId: warData.receivingId,
      declaringAllianceId: declaringNation.allianceId,
      receivingAllianceId: receivingNation.allianceId,
      status: warData.status,
      date: warData.date,
      endDate: warData.endDate,
      reason: warData.reason || null,
      destruction: warData.destruction || null,
      attackPercent: warData.attackPercent || null,
      defendPercent: warData.defendPercent || null,
      lastSeenAt: now,
      isActive: true,
    };

    let war;
    if (existingWar) {
      // Update existing war
      const currentVersion = existingWar.version || 1;
      war = await prisma.war.update({
        where: { warId: warData.warId },
        data: {
          ...warDataToUpsert,
          version: currentVersion + 1,
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
    } else {
      // Create new war
      war = await prisma.war.create({
        data: {
          ...warDataToUpsert,
          firstSeenAt: now,
          version: 1,
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
    }

    return this.mapToWarModel(war);
  }

  /**
   * Map Prisma war to War model format
   */
  private static mapToWarModel(dbWar: any): any {
    return {
      warId: dbWar.warId,
      declaringId: dbWar.declaringNationId,
      declaringRuler: dbWar.declaringNation.rulerName,
      declaringNation: dbWar.declaringNation.nationName,
      declaringAlliance: dbWar.declaringNation.alliance.name,
      declaringAllianceId: dbWar.declaringNation.allianceId,
      receivingId: dbWar.receivingNationId,
      receivingRuler: dbWar.receivingNation.rulerName,
      receivingNation: dbWar.receivingNation.nationName,
      receivingAlliance: dbWar.receivingNation.alliance.name,
      receivingAllianceId: dbWar.receivingNation.allianceId,
      status: dbWar.status,
      date: dbWar.date,
      endDate: dbWar.endDate,
      reason: dbWar.reason || undefined,
      destruction: dbWar.destruction || undefined,
      attackPercent: dbWar.attackPercent || undefined,
      defendPercent: dbWar.defendPercent || undefined,
      formattedEndDate: dbWar.formattedEndDate || undefined,
      daysUntilExpiration: dbWar.daysUntilExpiration || undefined,
      expirationColor: dbWar.expirationColor || undefined,
      isExpired: dbWar.isExpired || undefined,
    };
  }
}
