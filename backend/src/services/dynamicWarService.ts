import { DynamicWar } from '../models/DynamicWar.js';
import { promises as fs } from 'fs';
import path from 'path';

const DYNAMIC_WARS_FILE = path.join(process.cwd(), 'src', 'data', 'dynamic_wars.json');

export class DynamicWarService {
  private static dynamicWars: DynamicWar[] = [];
  private static initialized = false;

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
   * Initialize the service by loading dynamic wars from file
   */
  private static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.access(DYNAMIC_WARS_FILE);
      const data = await fs.readFile(DYNAMIC_WARS_FILE, 'utf-8');
      this.dynamicWars = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty array
      this.dynamicWars = [];
      // Only try to save file in development environment
      if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
        await this.saveToFile();
      }
    }

    this.initialized = true;
  }

  /**
   * Save dynamic wars to file
   */
  private static async saveToFile(): Promise<void> {
    // Skip file operations in serverless environments like Vercel
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.log('Skipping dynamic wars save in serverless environment');
      return;
    }

    try {
      await fs.mkdir(path.dirname(DYNAMIC_WARS_FILE), { recursive: true });
      await fs.writeFile(DYNAMIC_WARS_FILE, JSON.stringify(this.dynamicWars, null, 2));
    } catch (error) {
      console.error('Error saving dynamic wars to file:', error);
      throw new Error('Failed to save dynamic wars');
    }
  }

  /**
   * Add a new dynamic war
   */
  static async addDynamicWar(warData: Omit<DynamicWar, 'addedAt' | 'source'>, source: DynamicWar['source'] = 'api'): Promise<DynamicWar> {
    await this.initialize();

    // Check if war already exists (by warId)
    const existingWar = this.dynamicWars.find(war => war.warId === warData.warId);
    if (existingWar) {
      throw new Error(`War with ID ${warData.warId} already exists in dynamic wars`);
    }

    const dynamicWar: DynamicWar = {
      ...warData,
      addedAt: new Date().toISOString(),
      source
    };

    this.dynamicWars.push(dynamicWar);
    await this.saveToFile();

    return dynamicWar;
  }

  /**
   * Get all dynamic wars
   */
  static async getAllDynamicWars(): Promise<DynamicWar[]> {
    await this.initialize();
    return [...this.dynamicWars]; // Return copy to prevent external modification
  }

  /**
   * Get dynamic wars that are active (not ended/expired)
   */
  static async getActiveDynamicWars(): Promise<DynamicWar[]> {
    await this.initialize();
    return this.dynamicWars.filter(war => 
      war.status.toLowerCase() !== 'ended' &&
      war.status.toLowerCase() !== 'expired'
    );
  }

  /**
   * Remove a dynamic war by warId
   */
  static async removeDynamicWar(warId: number): Promise<boolean> {
    await this.initialize();

    const initialLength = this.dynamicWars.length;
    this.dynamicWars = this.dynamicWars.filter(war => war.warId !== warId);
    
    if (this.dynamicWars.length < initialLength) {
      await this.saveToFile();
      return true;
    }

    return false;
  }

  /**
   * Clear all dynamic wars (useful for cleanup after CSV update)
   */
  static async clearAllDynamicWars(): Promise<void> {
    await this.initialize();
    this.dynamicWars = [];
    await this.saveToFile();
  }

  /**
   * Get dynamic wars by alliance ID (either declaring or receiving)
   */
  static async getDynamicWarsByAlliance(allianceId: number): Promise<DynamicWar[]> {
    await this.initialize();
    return this.dynamicWars.filter(war => 
      war.declaringAllianceId === allianceId || war.receivingAllianceId === allianceId
    );
  }

  /**
   * Get dynamic wars by nation ID (either declaring or receiving)
   */
  static async getDynamicWarsByNation(nationId: number): Promise<DynamicWar[]> {
    await this.initialize();
    return this.dynamicWars.filter(war => 
      war.declaringId === nationId || war.receivingId === nationId
    );
  }

  /**
   * Clean up old dynamic wars (older than specified days)
   */
  static async cleanupOldWars(olderThanDays: number = 7): Promise<number> {
    await this.initialize();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const initialLength = this.dynamicWars.length;
    this.dynamicWars = this.dynamicWars.filter(war => {
      const warDate = new Date(war.date);
      return warDate > cutoffDate;
    });

    const removedCount = initialLength - this.dynamicWars.length;
    
    if (removedCount > 0) {
      await this.saveToFile();
    }

    return removedCount;
  }

  /**
   * Merge dynamic wars with CSV wars, removing duplicates
   */
  static async mergeWithCSVWars(csvWars: any[]): Promise<any[]> {
    await this.initialize();

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
}
