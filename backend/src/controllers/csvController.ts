import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { 
  importNationsFromCsv, 
  importAidOffersFromCsv, 
  importWarsFromCsv 
} from '../services/csvImportService.js';
import { 
  FileType, 
  downloadFileWithFallback,
  extractCsvToStandardFile 
} from '../utils/dataDownloader.js';

const FILE_TYPE_MAP: Record<string, { type: FileType; outputFile: string }> = {
  nations: {
    type: FileType.NATION_STATS,
    outputFile: 'nations.csv'
  },
  'aid-offers': {
    type: FileType.AID_STATS,
    outputFile: 'aid_offers.csv'
  },
  wars: {
    type: FileType.WAR_STATS,
    outputFile: 'wars.csv'
  }
};

function getDataPath(): string {
  return path.join(process.cwd(), 'src', 'data');
}

export class CsvController {
  /**
   * Download a CSV file
   * POST /api/csv/:type/download
   * Types: nations, aid-offers, wars
   */
  static async downloadCsv(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const config = FILE_TYPE_MAP[type];
      
      if (!config) {
        return res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${Object.keys(FILE_TYPE_MAP).join(', ')}`
        });
      }

      const dataPath = getDataPath();
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
      }

      const tempZipPath = path.join(dataPath, `temp_${config.type}_${Date.now()}.zip`);
      const outputPath = path.join(dataPath, config.outputFile);

      const baseUrl = 'https://www.cybernations.net/assets/';
      
      console.log(`Downloading ${config.type}...`);
      
      try {
        // Use the same download logic as dataDownloader
        const result = await downloadFileWithFallback(baseUrl, config.type, tempZipPath);
        console.log(`Downloaded ${config.type}: ${result.filename}`);
        
        // Extract CSV from zip
        await extractCsvToStandardFile(tempZipPath, outputPath, config.type);
        console.log(`Extracted ${config.type} to ${config.outputFile}`);
        
        // Clean up temp zip
        if (fs.existsSync(tempZipPath)) {
          fs.unlinkSync(tempZipPath);
        }
        
        res.json({
          success: true,
          message: `Successfully downloaded and extracted ${config.outputFile}`,
          file: config.outputFile,
          path: outputPath,
          originalFile: result.filename
        });
      } catch (downloadError: any) {
        // Clean up on error
        if (fs.existsSync(tempZipPath)) {
          fs.unlinkSync(tempZipPath);
        }
        
        throw downloadError;
      }
    } catch (error: any) {
      console.error('Error downloading CSV:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to download CSV file'
      });
    }
  }

  /**
   * Parse a CSV file and return the data (without saving to database)
   * GET /api/csv/:type/parse
   * Types: nations, aid-offers, wars
   */
  static async parseCsv(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const config = FILE_TYPE_MAP[type];
      
      if (!config) {
        return res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${Object.keys(FILE_TYPE_MAP).join(', ')}`
        });
      }

      const dataPath = getDataPath();
      const csvPath = path.join(dataPath, config.outputFile);

      if (!fs.existsSync(csvPath)) {
        return res.status(404).json({
          success: false,
          error: `CSV file not found: ${config.outputFile}. Please download it first.`
        });
      }

      // Parse the CSV file
      const csvParser = await import('csv-parser');
      const { createReadStream } = await import('fs');
      const records: any[] = [];
      let rowCount = 0;

      return new Promise<void>((resolve, reject) => {
        createReadStream(csvPath)
          .pipe(csvParser.default({
            separator: '|',
            headers: type === 'nations' 
              ? ['id', 'rulerName', 'nationName', 'alliance', 'allianceId', 'allianceDate', 'allianceStatus', 'governmentType', 'religion', 'team', 'created', 'technology', 'infrastructure', 'baseLand', 'warStatus', 'resource1', 'resource2', 'votes', 'strength', 'defcon', 'baseSoldiers', 'tanks', 'cruise', 'nukes', 'activity', 'connectedResource1', 'connectedResource2', 'connectedResource3', 'connectedResource4', 'connectedResource5', 'connectedResource6', 'connectedResource7', 'connectedResource8', 'connectedResource9', 'connectedResource10', 'attackingCasualties', 'defensiveCasualties']
              : type === 'aid-offers'
              ? ['declaringId', 'declaringRuler', 'declaringNation', 'declaringAlliance', 'declaringAllianceId', 'declaringTeam', 'receivingId', 'receivingRuler', 'receivingNation', 'receivingAlliance', 'receivingAllianceId', 'receivingTeam', 'status', 'money', 'technology', 'soldiers', 'date', 'reason', 'aidId']
              : ['declaringId', 'declaringRuler', 'declaringNation', 'declaringAlliance', 'declaringAllianceId', 'declaringTeam', 'receivingId', 'receivingRuler', 'receivingNation', 'receivingAlliance', 'receivingAllianceId', 'receivingTeam', 'warStatus', 'beginDate', 'endDate', 'reason', 'warId', 'destruction', 'attackPercent', 'defendPercent']
          }))
          .on('data', (row: any) => {
            rowCount++;
            if (rowCount <= 10) {
              // Only include first 10 rows in response to avoid huge payloads
              records.push(row);
            }
          })
          .on('end', () => {
            res.json({
              success: true,
              message: `Parsed ${rowCount} rows from ${config.outputFile}`,
              totalRows: rowCount,
              sampleRows: records,
              file: config.outputFile
            });
            resolve();
          })
          .on('error', (error: Error) => {
            reject(error);
          });
      });
    } catch (error: any) {
      console.error('Error parsing CSV:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to parse CSV file'
      });
    }
  }

  /**
   * Update database from CSV file
   * POST /api/csv/:type/update
   * Types: nations, aid-offers, wars
   */
  static async updateFromCsv(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const config = FILE_TYPE_MAP[type];
      
      if (!config) {
        return res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${Object.keys(FILE_TYPE_MAP).join(', ')}`
        });
      }

      const dataPath = getDataPath();
      const csvPath = path.join(dataPath, config.outputFile);

      if (!fs.existsSync(csvPath)) {
        return res.status(404).json({
          success: false,
          error: `CSV file not found: ${config.outputFile}. Please download it first.`
        });
      }

      let result;
      if (type === 'nations') {
        result = await importNationsFromCsv(csvPath);
      } else if (type === 'aid-offers') {
        result = await importAidOffersFromCsv(csvPath);
      } else if (type === 'wars') {
        result = await importWarsFromCsv(csvPath);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid type'
        });
      }

      res.json({
        success: true,
        message: `Successfully updated database from ${config.outputFile}`,
        imported: result.imported,
        updated: result.updated,
        file: config.outputFile
      });
    } catch (error: any) {
      console.error('Error updating from CSV:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update database from CSV file'
      });
    }
  }

  /**
   * Download, parse, and update database in one operation
   * POST /api/csv/:type/sync
   * Types: nations, aid-offers, wars
   */
  static async syncCsv(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const config = FILE_TYPE_MAP[type];
      
      if (!config) {
        return res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${Object.keys(FILE_TYPE_MAP).join(', ')}`
        });
      }

      // Step 1: Download
      const dataPath = getDataPath();
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
      }

      const tempZipPath = path.join(dataPath, `temp_${config.type}_${Date.now()}.zip`);
      const outputPath = path.join(dataPath, config.outputFile);

      const baseUrl = 'https://www.cybernations.net/assets/';
      console.log(`Downloading ${config.type}...`);
      
      // Step 1: Download
      const downloadResult = await downloadFileWithFallback(baseUrl, config.type, tempZipPath);
      console.log(`Downloaded ${config.type}: ${downloadResult.filename}`);
      
      // Step 2: Extract
      await extractCsvToStandardFile(tempZipPath, outputPath, config.type);
      console.log(`Extracted ${config.type} to ${config.outputFile}`);
      
      // Clean up temp zip
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }

      // Step 3: Update database
      let importResult: { imported: number; updated: number };
      if (type === 'nations') {
        importResult = await importNationsFromCsv(outputPath);
      } else if (type === 'aid-offers') {
        importResult = await importAidOffersFromCsv(outputPath);
      } else if (type === 'wars') {
        importResult = await importWarsFromCsv(outputPath);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid type'
        });
      }

      res.json({
        success: true,
        message: `Successfully synced ${config.type}`,
        steps: {
          downloaded: true,
          extracted: true,
          updated: true
        },
        imported: importResult.imported,
        updated: importResult.updated,
        file: config.outputFile
      });
    } catch (error: any) {
      console.error('Error syncing CSV:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync CSV file'
      });
    }
  }
}

