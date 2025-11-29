#!/usr/bin/env node
/**
 * Manual Data Download Script
 * 
 * This script allows you to manually download nation, aid, or war data
 * with a custom filename when the automated download link is broken.
 * 
 * Usage:
 *   npx tsx manual-download.ts nation <filename>
 *   npx tsx manual-download.ts aid <filename>
 *   npx tsx manual-download.ts war <filename>
 * 
 * Example:
 *   npx tsx manual-download.ts nation CyberNations_SE_Nation_Stats_10142025510001.zip
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { extractZipFile } from './src/utils/zipExtractor.js';
import { upsertFileDownload } from './src/services/fileDownloadService.js';
import { FileType } from './src/utils/dataDownloader.js';

const BASE_URL = 'https://www.cybernations.net/assets/';

interface DownloadConfig {
  type: string;
  outputFile: string;
}

const FILE_TYPE_MAP: Record<string, DownloadConfig & { fileType: FileType }> = {
  nation: { type: 'Nation_Stats', outputFile: 'nations.csv', fileType: FileType.NATION_STATS },
  aid: { type: 'Aid_Stats', outputFile: 'aid_offers.csv', fileType: FileType.AID_STATS },
  war: { type: 'War_Stats', outputFile: 'wars.csv', fileType: FileType.WAR_STATS }
};

function downloadFile(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    file.on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
    
    console.log(`Downloading from: ${url}`);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(filePath, () => {});
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      response.on('error', (err) => {
        file.close();
        fs.unlink(filePath, () => {});
        reject(err);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

async function extractCsvFromZip(zipPath: string, outputPath: string): Promise<void> {
  const tempExtractDir = path.join(path.dirname(zipPath), 'temp_extract');
  
  try {
    console.log('Extracting ZIP file...');
    await extractZipFile(zipPath, tempExtractDir);
    
    const extractedFiles = fs.readdirSync(tempExtractDir, { recursive: true }) as string[];
    const csvFile = extractedFiles.find((file: string) => 
      file.endsWith('.txt') && file.includes('CyberNations_SE')
    );
    
    if (!csvFile) {
      throw new Error('No CSV/TXT file found in ZIP');
    }
    
    const sourcePath = path.join(tempExtractDir, csvFile);
    const csvContent = fs.readFileSync(sourcePath, 'utf8');
    
    fs.writeFileSync(outputPath, csvContent);
    console.log(`✓ Extracted to: ${outputPath}`);
    
  } finally {
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
  }
}

async function manualDownload(dataType: string, filename: string): Promise<void> {
  const config = FILE_TYPE_MAP[dataType.toLowerCase()];
  
  if (!config) {
    console.error(`Invalid data type: ${dataType}`);
    console.error('Valid types: nation, aid, war');
    process.exit(1);
  }
  
  const dataPath = path.join(process.cwd(), 'src', 'data');
  
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  
  const tempZipPath = path.join(dataPath, `temp_manual_${config.type}.zip`);
  const outputPath = path.join(dataPath, config.outputFile);
  const url = `${BASE_URL}${filename}`;
  
  try {
    console.log(`\nManual Download: ${config.type}`);
    console.log(`Filename: ${filename}`);
    console.log(`Output: ${config.outputFile}\n`);
    
    // Download the file
    await downloadFile(url, tempZipPath);
    console.log('✓ Download complete');
    
    // Extract the CSV
    await extractCsvFromZip(tempZipPath, outputPath);
    
    // Update the database tracker
    await upsertFileDownload(config.fileType, filename);
    console.log('✓ Updated database tracker');
    
    console.log('\n✅ Manual download complete!\n');
    
  } catch (error: any) {
    console.error('\n❌ Download failed:', error.message);
    process.exit(1);
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.log(`
Manual Data Download Script

Usage:
  npx tsx manual-download.ts <type> <filename>

Arguments:
  type      Data type to download: nation, aid, or war
  filename  The exact filename to download from CyberNations

Examples:
  npx tsx manual-download.ts nation CyberNations_SE_Nation_Stats_10142025510001.zip
  npx tsx manual-download.ts aid CyberNations_SE_Aid_Stats_10142025520001.zip
  npx tsx manual-download.ts war CyberNations_SE_War_Stats_10142025525001.zip
`);
  process.exit(1);
}

const [dataType, filename] = args;
manualDownload(dataType, filename);

