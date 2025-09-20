import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { extractZipFile } from './zipExtractor.js';
import { syncAllianceFilesWithNewData } from './allianceSync.js';

export enum FileType {
  NATION_STATS = 'Nation_Stats',
  AID_STATS = 'Aid_Stats',
  WAR_STATS = 'War_Stats'
}

interface FileInfo {
  name: string;
  timestamp: number;
  isRecent: boolean;
}

function getDownloadNumberSlug(file_flag: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // No padding
  const day = String(now.getDate()).padStart(2, '0');
  
  // Convert to Central Time (UTC-6 or UTC-5 depending on DST)
  // For simplicity, we'll use a fixed offset of UTC-6 (CST)
  // In production, you'd want to use a proper timezone library like date-fns-tz
  const utcHour = now.getUTCHours();
  const centralHour = (utcHour - 5 + 24) % 24; // Convert UTC to CST (UTC-6)
  
  // Determine if it's between 6am and 6pm Central Time
  const isDaytime = centralHour >= 6 && centralHour < 18;
  const timeSuffix = isDaytime ? '1' : '2';

  console.log(`isDaytime: ${isDaytime}`);
  console.log(`centralHour: ${centralHour}`);
  console.log(`timeSuffix: ${timeSuffix}`);
  console.log(`utcHour: ${utcHour}`);
  
  // Format: MMDDYYYYXXXX where XXXX is 4-digit file identifier + toggle
  // Example: 91820250002 (9/18/2025, file 0002, daytime=1)
  return `${month}${day}${year}${file_flag}${timeSuffix}`;
}


export function getFileInfo(fileType: FileType): FileInfo {
  const flag_map = {
    [FileType.NATION_STATS]: '51000',
    [FileType.AID_STATS]: '52000',
    [FileType.WAR_STATS]: '52500'
  };

  const flag = flag_map[fileType];
  const currentTimestamp = getDownloadNumberSlug(flag);
  const filename = `CyberNations_SE_${fileType}_${currentTimestamp}.zip`;
  
  return {
    name: filename,
    timestamp: parseInt(currentTimestamp),
    isRecent: true
  };
}

function downloadFile(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filePath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  const result = await extractZipFile(zipPath, extractDir);
  
  if (!result.success) {
    throw new Error(`Failed to extract ZIP file: ${result.error}`);
  }
  
  console.log(`Extracted ${result.extractedFiles.length} files from ZIP`);
}

async function cleanupOldFiles(fileType: FileType, extractedPath: string): Promise<void> {
  try {
    // Find all directories for this file type
    const existingDirs = fs.readdirSync(extractedPath)
      .filter(dir => {
        const fullPath = path.join(extractedPath, dir);
        return fs.statSync(fullPath).isDirectory() && dir.includes(fileType);
      });
    
    if (existingDirs.length > 0) {
      console.log(`Cleaning up ${existingDirs.length} old ${fileType} directories...`);
      
      // Delete all old directories for this file type
      for (const dir of existingDirs) {
        const dirPath = path.join(extractedPath, dir);
        try {
          // Remove directory and all contents recursively
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(`Deleted old directory: ${dir}`);
        } catch (error) {
          console.error(`Error deleting directory ${dir}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error cleaning up old ${fileType} files:`, error);
  }
}

export async function ensureRecentFiles(): Promise<void> {
  const baseUrl = 'https://www.cybernations.net/assets/';
  const rawDataPath = path.join(process.cwd(), 'src', 'raw_data');
  const extractedPath = path.join(rawDataPath, 'extracted');
  
  // Ensure directories exist
  if (!fs.existsSync(rawDataPath)) {
    fs.mkdirSync(rawDataPath, { recursive: true });
  }
  if (!fs.existsSync(extractedPath)) {
    fs.mkdirSync(extractedPath, { recursive: true });
  }
  
  const fileTypes: FileType[] = [FileType.NATION_STATS, FileType.AID_STATS, FileType.WAR_STATS];
  let anyFilesUpdated = false;
  
  for (const fileType of fileTypes) {
    try {
      const fileInfo = getFileInfo(fileType);
      const zipPath = path.join(rawDataPath, fileInfo.name);
      const extractDir = path.join(extractedPath, fileInfo.name.replace('.zip', ''));
      const txtFile = path.join(extractDir, `CyberNations_SE_${fileType}.txt`);
      
      console.log(`Checking ${txtFile} file...`);

      // Check if we already have the most recent file
      if (fs.existsSync(txtFile)) {
        console.log(`${fileType} file is up to date`);
        continue;
      }
      
      // Clean up old files for this file type before downloading new ones
      await cleanupOldFiles(fileType, extractedPath);
      
      console.log(`Downloading ${fileType}...`);
      const url = `${baseUrl}${fileInfo.name}`;
      await downloadFile(url, zipPath);
      
      console.log(`Extracting ${fileType}...`);
      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }
      await extractZip(zipPath, extractDir);
      
      // Clean up zip file
      fs.unlinkSync(zipPath);
      
      console.log(`${fileType} updated successfully`);
      anyFilesUpdated = true;
    } catch (error) {
      console.error(`Error updating ${fileType}:`, error);
      // Continue with other files even if one fails
    }
  }
  
  // If any files were updated, sync alliance files
  if (anyFilesUpdated) {
    try {
      console.log('Files were updated, syncing alliance files...');
      // Import and call the data parser to get the new nation data
      const { loadDataFromFiles } = await import('./dataParser.js');
      const { nations } = loadDataFromFiles();
      
      if (nations.length > 0) {
        await syncAllianceFilesWithNewData(nations);
      } else {
        console.log('No nation data found, skipping alliance sync');
      }
    } catch (error) {
      console.error('Error syncing alliance files:', error);
    }
  }
}
