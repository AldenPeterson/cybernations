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
  const day = String(now.getDate());
  
  // Convert to Central Time (UTC-6 or UTC-5 depending on DST)
  // For simplicity, we'll use a fixed offset of UTC-6 (CST)
  // In production, you'd want to use a proper timezone library like date-fns-tz
  const utcHour = now.getUTCHours();
  const centralHour = (utcHour - 5 + 24) % 24; // Convert UTC to CST (UTC-6)
  
  // Determine if it's between 6am and 6pm Central Time
  const isDaytime = centralHour >= 6 && centralHour < 18;
  const timeSuffix = isDaytime ? '1' : '2';
  
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
        reject(new Error(`Failed to download file from ${url}: ${response.statusCode}`));
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
    // Ensure the extracted directory exists before trying to read it
    if (!fs.existsSync(extractedPath)) {
      console.log(`Extracted directory does not exist, skipping cleanup for ${fileType}`);
      return;
    }
    
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

/**
 * Check if we have recent files without downloading
 */
async function checkForRecentFiles(): Promise<boolean> {
  try {
    const rawDataPath = path.join(process.cwd(), 'src', 'raw_data', 'extracted');
    
    if (!fs.existsSync(rawDataPath)) {
      return false;
    }
    
    const files = fs.readdirSync(rawDataPath, { withFileTypes: true });
    const hasRecentData = files.some(file => 
      file.isDirectory() && 
      file.name.includes('CyberNations_SE') &&
      fs.existsSync(path.join(rawDataPath, file.name, 'CyberNations_SE_Nation_Stats.txt'))
    );
    
    return hasRecentData;
  } catch (error) {
    console.warn('Error checking for recent files:', error);
    return false;
  }
}

/**
 * Download files with timeout protection for serverless environments
 */
async function downloadWithTimeout(): Promise<void> {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Download timeout')), 25000); // 25 second timeout
  });
  
  const downloadPromise = performDownload();
  
  await Promise.race([downloadPromise, timeoutPromise]);
}

/**
 * Perform the actual download (extracted from the existing logic)
 */
async function performDownload(): Promise<void> {
  const baseUrl = 'https://www.cybernations.net/assets/';
  
  // Use a more robust path resolution that works in different environments
  let rawDataPath: string;
  let extractedPath: string;
  
  try {
    // Try to use the project root first
    const projectRoot = process.cwd();
    rawDataPath = path.join(projectRoot, 'src', 'raw_data');
    extractedPath = path.join(rawDataPath, 'extracted');
  } catch (error) {
    console.error('Error setting up paths:', error);
    throw error;
  }
  
  // Ensure directories exist
  if (!fs.existsSync(rawDataPath)) {
    fs.mkdirSync(rawDataPath, { recursive: true });
  }
  if (!fs.existsSync(extractedPath)) {
    fs.mkdirSync(extractedPath, { recursive: true });
  }
  
  const filesToDownload = [
    { type: FileType.NATION_STATS, url: `${baseUrl}CyberNations_SE_${FileType.NATION_STATS}_${getDownloadNumberSlug('51000')}.zip` },
    { type: FileType.AID_STATS, url: `${baseUrl}CyberNations_SE_${FileType.AID_STATS}_${getDownloadNumberSlug('52000')}.zip` },
    { type: FileType.WAR_STATS, url: `${baseUrl}CyberNations_SE_${FileType.WAR_STATS}_${getDownloadNumberSlug('52500')}.zip` }
  ];
  
  // Download files in parallel but with individual timeouts
  const downloadPromises = filesToDownload.map(async (file) => {
    try {
      const fileName = file.url.split('/').pop() || `${file.type}.zip`;
      const zipPath = path.join(rawDataPath, fileName);
      await downloadFile(file.url, zipPath);
      console.log(`Successfully downloaded ${file.type}`);
    } catch (error) {
      console.warn(`Failed to download ${file.type}:`, error);
      // Don't throw - allow other downloads to continue
    }
  });
  
  await Promise.allSettled(downloadPromises);
}

export async function ensureRecentFiles(): Promise<void> {
  // Check if we have recent files first, regardless of environment
  const hasRecentFiles = await checkForRecentFiles();
  
  if (hasRecentFiles) {
    console.log('Recent files found, skipping download');
    return;
  }
  
  // In production/serverless, try to download but with timeout protection
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('Production environment detected, attempting download with timeout protection');
    try {
      await downloadWithTimeout();
    } catch (error) {
      console.warn('Download failed in production, using existing files:', error);
      // Don't throw - allow the system to continue with existing files
    }
    return;
  }

  const baseUrl = 'https://www.cybernations.net/assets/';
  
  // Use a more robust path resolution that works in different environments
  let rawDataPath: string;
  let extractedPath: string;
  
  try {
    // Try to use the project root first
    const projectRoot = process.cwd();
    rawDataPath = path.join(projectRoot, 'src', 'raw_data');
    extractedPath = path.join(rawDataPath, 'extracted');
    
    // Ensure directories exist
    if (!fs.existsSync(rawDataPath)) {
      fs.mkdirSync(rawDataPath, { recursive: true });
    }
    if (!fs.existsSync(extractedPath)) {
      fs.mkdirSync(extractedPath, { recursive: true });
    }
  } catch (error) {
    console.warn('Could not create raw_data directories, skipping file operations:', error);
    return;
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
      console.error(`Error updating ${fileType} :`, error);
      // Continue with other files even if one fails
    }
  }
  
  // If any files were updated, sync alliance files
  if (anyFilesUpdated) {
    try {
      console.log('Files were updated, syncing alliance files...');
      // Import and call the data parser to get the new nation data
      const { loadDataFromFiles } = await import('../services/dataProcessingService.js');
      const { nations } = await loadDataFromFiles();
      
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
