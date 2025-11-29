import { DynamicWar } from '../models/DynamicWar.js';
import { prisma } from '../utils/prisma.js';
import { isWarExpired } from '../utils/dateUtils.js';

export class DynamicWarService {
  /**
   * Simple date normalization - just add default time if missing
   * @param dateString - Raw date string from input
   * @returns Date string with time component
   */
  private static normalizeDateString(dateString: string): string {
    if (!dateString || typeof dateString !== 'string') {
      return dateString;
    }

    const trimmed = dateString.trim();
    
    // If it already has a time component, return as-is
    if (trimmed.includes(' ') && (trimmed.includes('AM') || trimmed.includes('PM') || trimmed.match(/\d{1,2}:\d{2}:\d{2}$/))) {
      return trimmed;
    }

    // If it's just a date without time, add default time
    if (trimmed.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      return `${trimmed} 12:00:00 AM`;
    }

    // Otherwise return as-is
    return trimmed;
  }

  /**
   * Add a new dynamic war
   */
  static async addDynamicWar(warData: Omit<DynamicWar, 'addedAt' | 'source'>, source: DynamicWar['source'] = 'api'): Promise<DynamicWar> {
    // Check if war already exists (by warId)
    const existingWar = await prisma.dynamicWar.findUnique({
      where: { warId: warData.warId },
    });

    if (existingWar) {
      throw new Error(`War with ID ${warData.warId} already exists in dynamic wars`);
    }

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

    const dynamicWar = await prisma.dynamicWar.create({
      data: {
        warId: warData.warId,
        declaringNationId: warData.declaringId,
        receivingNationId: warData.receivingId,
        status: warData.status,
        date: warData.date,
        endDate: warData.endDate,
        reason: warData.reason || null,
        destruction: warData.destruction || null,
        attackPercent: warData.attackPercent || null,
        defendPercent: warData.defendPercent || null,
        addedAt: new Date(),
        source,
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

    return this.mapToDynamicWar(dynamicWar);
  }

  /**
   * Get all dynamic wars
   */
  static async getAllDynamicWars(): Promise<DynamicWar[]> {
    const wars = await prisma.dynamicWar.findMany({
      include: {
        declaringNation: {
          include: { alliance: true },
        },
        receivingNation: {
          include: { alliance: true },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    return wars.map(w => this.mapToDynamicWar(w));
  }

  /**
   * Get dynamic wars that are active (not ended/expired by status or date)
   */
  static async getActiveDynamicWars(): Promise<DynamicWar[]> {
    const allWars = await this.getAllDynamicWars();
    
    return allWars.filter(war => {
      // Filter by status first
      if (war.status.toLowerCase() === 'ended' || war.status.toLowerCase() === 'expired') {
        return false;
      }
      
      // Also filter by date - check if the war has expired based on its end date
      try {
        // Normalize the end date to ensure it has a time component
        const normalizedEndDate = this.normalizeDateString(war.endDate);
        return !isWarExpired(normalizedEndDate);
      } catch (error) {
        // If we can't parse the date, exclude the war to be safe
        console.warn(`Failed to parse end date for war ${war.warId}: ${error}`);
        return false;
      }
    });
  }

  /**
   * Remove a dynamic war by warId
   */
  static async removeDynamicWar(warId: number): Promise<boolean> {
    try {
      await prisma.dynamicWar.delete({
        where: { warId },
      });
      return true;
    } catch (error) {
      // War not found or other error
      return false;
    }
  }

  /**
   * Clear all dynamic wars (useful for cleanup after CSV update)
   */
  static async clearAllDynamicWars(): Promise<void> {
    await prisma.dynamicWar.deleteMany({});
  }

  /**
   * Get dynamic wars by alliance ID (either declaring or receiving)
   */
  static async getDynamicWarsByAlliance(allianceId: number): Promise<DynamicWar[]> {
    const wars = await prisma.dynamicWar.findMany({
      where: {
        OR: [
          { declaringNation: { allianceId } },
          { receivingNation: { allianceId } },
        ],
      },
      include: {
        declaringNation: {
          include: { alliance: true },
        },
        receivingNation: {
          include: { alliance: true },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    return wars.map(w => this.mapToDynamicWar(w));
  }

  /**
   * Get dynamic wars by nation ID (either declaring or receiving)
   */
  static async getDynamicWarsByNation(nationId: number): Promise<DynamicWar[]> {
    const wars = await prisma.dynamicWar.findMany({
      where: {
        OR: [
          { declaringNationId: nationId },
          { receivingNationId: nationId },
        ],
      },
      include: {
        declaringNation: {
          include: { alliance: true },
        },
        receivingNation: {
          include: { alliance: true },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    return wars.map(w => this.mapToDynamicWar(w));
  }

  /**
   * Clean up old dynamic wars (older than specified days)
   */
  static async cleanupOldWars(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Get all wars and filter by parsed date
    const allWars = await prisma.dynamicWar.findMany();
    const warsToDelete = allWars.filter(war => {
      try {
        // Parse the date string - it's in format like "10/7/2025 8:36:21 AM"
        const warDate = new Date(war.date);
        return warDate < cutoffDate;
      } catch {
        return false;
      }
    });

    // Delete wars that are too old
    let deletedCount = 0;
    for (const war of warsToDelete) {
      try {
        await prisma.dynamicWar.delete({
          where: { warId: war.warId },
        });
        deletedCount++;
      } catch (error) {
        console.warn(`Failed to delete war ${war.warId}:`, error);
      }
    }

    return deletedCount;
  }

  /**
   * Merge dynamic wars with database wars, removing duplicates
   */
  static async mergeWithCSVWars(csvWars: any[]): Promise<any[]> {
    // Get active dynamic wars
    const activeDynamicWars = await this.getActiveDynamicWars();
    
    // Create a set of CSV war IDs for quick lookup
    const csvWarIds = new Set(csvWars.map(war => war.warId));
    
    // Filter out dynamic wars that exist in CSV (to avoid duplicates)
    const uniqueDynamicWars = activeDynamicWars.filter(war => !csvWarIds.has(war.warId));
    
    // Convert dynamic wars to the same format as CSV wars, applying simple date normalization
    const formattedDynamicWars = uniqueDynamicWars.map(war => ({
      warId: war.warId,
      declaringId: war.declaringId,
      declaringRuler: war.declaringRuler,
      declaringNation: war.declaringNation,
      declaringAlliance: war.declaringAlliance,
      declaringAllianceId: war.declaringAllianceId,
      receivingId: war.receivingId,
      receivingRuler: war.receivingRuler,
      receivingNation: war.receivingNation,
      receivingAlliance: war.receivingAlliance,
      receivingAllianceId: war.receivingAllianceId,
      status: war.status,
      date: this.normalizeDateString(war.date),
      endDate: this.normalizeDateString(war.endDate),
      reason: war.reason,
      destruction: war.destruction,
      attackPercent: war.attackPercent,
      defendPercent: war.defendPercent
    }));

    // Combine CSV wars with unique dynamic wars
    return [...csvWars, ...formattedDynamicWars];
  }

  /**
   * Map Prisma dynamic war to DynamicWar model
   */
  private static mapToDynamicWar(dbWar: any): DynamicWar {
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
      addedAt: dbWar.addedAt.toISOString(),
      source: dbWar.source as 'chrome_extension' | 'manual' | 'api',
    };
  }
}
