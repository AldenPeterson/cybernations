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

export interface DynamicWarResult {
  war: any;
  wasNew: boolean;
}

export class DynamicWarService {
  /**
   * Add a war to the War table - only creates new wars, does not update existing ones
   * This prevents overwriting accurate CSV data with potentially incomplete scraper data
   */
  static async addDynamicWar(warData: DynamicWarInput): Promise<DynamicWarResult> {
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
      select: { warId: true },
    });

    // If war already exists, skip it - only create new wars
    if (existingWar) {
      console.log(`War ${warData.warId} already exists, skipping update`);
      // Return the existing war without modification
      const war = await prisma.war.findUnique({
        where: { warId: warData.warId },
        include: {
          declaringNation: {
            include: { alliance: true },
          },
          receivingNation: {
            include: { alliance: true },
          },
        },
      });
      return {
        war: this.mapToWarModel(war),
        wasNew: false
      };
    }

    // Create new war only if it doesn't exist
    const warDataToCreate = {
      warId: warData.warId,
      declaringNationId: warData.declaringId,
      receivingNationId: warData.receivingId,
      declaringAllianceId: declaringNation.allianceId,
      receivingAllianceId: receivingNation.allianceId,
      status: warData.status,
      date: warData.date,
      endDate: warData.endDate,
      reason: warData.reason ?? null,
      destruction: warData.destruction ?? null,
      attackPercent: warData.attackPercent ?? null,
      defendPercent: warData.defendPercent ?? null,
      lastSeenAt: now,
      firstSeenAt: now,
      isActive: true,
      version: 1,
    };

    const war = await prisma.war.create({
      data: warDataToCreate,
      include: {
        declaringNation: {
          include: { alliance: true },
        },
        receivingNation: {
          include: { alliance: true },
        },
      },
    });

    console.log(`Created new war ${war.warId}`);
    return {
      war: this.mapToWarModel(war),
      wasNew: true
    };
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
