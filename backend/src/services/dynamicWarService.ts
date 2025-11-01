import { DynamicWar } from '../models/DynamicWar.js';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isWarExpired } from '../utils/dateUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible paths for dynamic wars file in different environments
const getDynamicWarsFilePath = (): string | null => {
  const possiblePaths = [
    path.join(process.cwd(), 'src', 'data', 'dynamic_wars.json'),
    path.join(__dirname, '..', 'data', 'dynamic_wars.json'),
    path.join(process.cwd(), 'dist', 'src', 'data', 'dynamic_wars.json'),
    path.join(__dirname, '..', '..', 'data', 'dynamic_wars.json')
  ];
  
  for (const filePath of possiblePaths) {
    try {
      if (fsSync.existsSync(filePath)) {
        console.log(`Found dynamic wars file at: ${filePath}`);
        return filePath;
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  console.log('Dynamic wars file not found in any of the expected locations');
  return null;
};

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

    console.log(`Environment: VERCEL=${process.env.VERCEL}, NODE_ENV=${process.env.NODE_ENV}`);
    
    const dynamicWarsFilePath = getDynamicWarsFilePath();
    
    if (dynamicWarsFilePath) {
      try {
        console.log('Dynamic wars file found, reading...');
        const data = await fs.readFile(dynamicWarsFilePath, 'utf-8');
        this.dynamicWars = JSON.parse(data);
        console.log(`Loaded ${this.dynamicWars.length} dynamic wars from file`);
      } catch (error) {
        console.log(`Failed to load dynamic wars file: ${error}`);
        this.dynamicWars = [];
      }
    } else {
      console.log('Dynamic wars file not found, starting with empty array');
      this.dynamicWars = [];
    }

    // Only try to save file in development environment
    if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
      await this.saveToFile();
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
      const dynamicWarsFilePath = getDynamicWarsFilePath();
      if (dynamicWarsFilePath) {
        await fs.writeFile(dynamicWarsFilePath, JSON.stringify(this.dynamicWars, null, 2));
      } else {
        // Use the first possible path for development
        const devPath = path.join(process.cwd(), 'src', 'data', 'dynamic_wars.json');
        await fs.mkdir(path.dirname(devPath), { recursive: true });
        await fs.writeFile(devPath, JSON.stringify(this.dynamicWars, null, 2));
      }
    } catch (error) {
      console.error('Error saving dynamic wars to file:', error);
      // Don't throw error in production, just log it
      if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
        throw new Error('Failed to save dynamic wars');
      }
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
   * Get dynamic wars that are active (not ended/expired by status or date)
   */
  static async getActiveDynamicWars(): Promise<DynamicWar[]> {
    await this.initialize();
    return this.dynamicWars.filter(war => {
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
