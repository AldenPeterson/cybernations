import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { extractZipFile } from './zipExtractor.js';
import { syncAllianceFilesWithNewData } from './allianceSync.js';
import { isInBlackoutWindow } from './dateUtils.js';

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

function getDownloadNumberSlug(file_flag: string, hoursOffset: number = 0): string {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - (hoursOffset * 60 * 60 * 1000));
  const centralNow = offsetDate.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const centralDate = new Date(centralNow);
  const year = centralDate.getFullYear();
  const month = centralDate.getMonth() + 1;
  const day = centralDate.getDate();
  const hours = centralDate.getHours();
 
  
  // Determine if it's between 6am and 6pm Central Time
  const isDaytime = hours >= 6 && hours < 18;
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
    
    // Add error handler to the file stream immediately
    file.on('error', (err) => {
      fs.unlink(filePath, () => {}); // Delete the file on error
      reject(err);
    });
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(filePath, () => {});
        reject(new Error(`Failed to download file from ${url}: ${response.statusCode}`));
        return;
      }
      
      // Add error handler to the response stream
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

async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  const result = await extractZipFile(zipPath, extractDir);
  
  if (!result.success) {
    throw new Error(`Failed to extract ZIP file: ${result.error}`);
  }
  
  console.log(`Extracted ${result.extractedFiles.length} files from ZIP`);
}

/**
 * Read the latest downloads tracker if present
 */
function readLatestDownloadsTracker(): Record<string, { timestamp: number; originalFile: string; downloadTime: string }> | null {
  try {
    const dataPath = path.join(process.cwd(), 'src', 'data');
    const trackerPath = path.join(dataPath, 'latest_downloads.json');
    if (!fs.existsSync(trackerPath)) return null;
    const raw = fs.readFileSync(trackerPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Convert a Date to our fixed Central time representation by applying a
 * constant UTC-5 offset (matches existing logic in this file).
 */
function toFixedCentral(date: Date): Date {
  const offsetMs = 5 * 60 * 60 * 1000; // UTC-5 per existing logic
  return new Date(date.getTime() - offsetMs);
}

/**
 * Convert a fixed Central time Date back to UTC by reversing the offset.
 */
function fromFixedCentral(centralDate: Date): Date {
  const offsetMs = 5 * 60 * 60 * 1000; // UTC-5 per existing logic
  return new Date(centralDate.getTime() + offsetMs);
}

/**
 * Get the most recent scheduled update time (in UTC ms) prior to now,
 * based on a twice-daily schedule at 6:00 and 18:00 Central.
 */
function getLastScheduledUpdateUtcMs(now: Date): number {
  const centralNow = toFixedCentral(now);
  const centralYear = centralNow.getFullYear();
  const centralMonth = centralNow.getMonth();
  const centralDay = centralNow.getDate();

  const centralHour = centralNow.getHours();

  let centralScheduled = new Date(centralYear, centralMonth, centralDay, 0, 0, 0, 0);
  if (centralHour >= 18) {
    centralScheduled.setHours(18, 0, 0, 0);
  } else if (centralHour >= 6) {
    centralScheduled.setHours(6, 0, 0, 0);
  } else {
    // Before 6am: previous day's 6pm
    const prevDay = new Date(centralYear, centralMonth, centralDay, 0, 0, 0, 0);
    prevDay.setDate(prevDay.getDate() - 1);
    prevDay.setHours(18, 0, 0, 0);
    centralScheduled = prevDay;
  }

  return fromFixedCentral(centralScheduled).getTime();
}

/**
 * Determine which file types are stale based on latest_downloads.json
 * using the twice-daily schedule at 6am/6pm Central.
 */
function getStaleFileTypesFromLatestDownloads(): FileType[] {
  const tracker = readLatestDownloadsTracker();
  const requiredKeys: { key: string; type: FileType; csv: string }[] = [
    { key: FileType.NATION_STATS, type: FileType.NATION_STATS, csv: 'nations.csv' },
    { key: FileType.AID_STATS, type: FileType.AID_STATS, csv: 'aid_offers.csv' },
    { key: FileType.WAR_STATS, type: FileType.WAR_STATS, csv: 'wars.csv' }
  ];

  const dataPath = path.join(process.cwd(), 'src', 'data');
  const nowUtcMs = Date.now();
  const lastScheduledUtcMs = getLastScheduledUpdateUtcMs(new Date(nowUtcMs));

  const stale: FileType[] = [];

  for (const item of requiredKeys) {
    const csvPath = path.join(dataPath, item.csv);
    const hasCsv = fs.existsSync(csvPath);
    const record = tracker ? tracker[item.key] : undefined;

    if (!record || !hasCsv) {
      stale.push(item.type);
      continue;
    }

    // Fresh if we have downloaded at or after the most recent scheduled time
    const isFreshByTime = record.timestamp >= lastScheduledUtcMs;
    
    // Check if a custom filename is being used (via environment variable or manual download)
    const customFilename = getCustomFilename(item.type);
    console.log(`Custom filename: ${customFilename}`);
    const expectedFileInfo = getFileInfo(item.type);
    console.log(`Expected filename: ${expectedFileInfo.name}`);
    const isFreshByFilename = record.originalFile === expectedFileInfo.name;
    
    // Consider file fresh if:
    // 1. Using a custom filename AND timestamp is recent, OR
    // 2. Both timestamp and filename match expected values
    const isFreshWithCustom = customFilename && isFreshByTime;
    const isFreshWithAuto = isFreshByTime && isFreshByFilename;
    
    // If we have a recent timestamp but non-matching filename, it's likely from manual download
    // In this case, trust the recent timestamp (consider fresh if downloaded in last 24 hours)
    const isRecentManualDownload = isFreshByTime && !isFreshByFilename && 
                                    (nowUtcMs - record.timestamp < 24 * 60 * 60 * 1000);
    
    if (!isFreshByFilename || (!customFilename && !isFreshWithCustom && !isFreshWithAuto && !isRecentManualDownload)) {
      stale.push(item.type);
    }
  }

  return stale;
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
    // Check recency against 6am/6pm Central schedule using latest_downloads.json
    const stale = getStaleFileTypesFromLatestDownloads();
    if (stale.length === 0) {
      console.log('Found recent standardized data files via latest_downloads.json');
      return true;
    }
    
    // Fallback: check for old extracted files
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
 * Perform the actual download with standardized file naming
 */
async function performDownload(): Promise<void> {
  const baseUrl = 'https://www.cybernations.net/assets/';
  
  // Use standardized paths for bundled data
  let dataPath: string;
  
  try {
    const projectRoot = process.cwd();
    dataPath = path.join(projectRoot, 'src', 'data');
  } catch (error) {
    console.error('Error setting up paths:', error);
    throw error;
  }
  
  // Ensure data directory exists
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  
  const filesToDownload = [
    { type: FileType.NATION_STATS, outputFile: 'nations.csv' },
    { type: FileType.AID_STATS, outputFile: 'aid_offers.csv' },
    { type: FileType.WAR_STATS, outputFile: 'wars.csv' }
  ];
  
  // Merge with existing tracker to preserve fresh entries
  const existingTracker = readLatestDownloadsTracker() || {};
  const latestDownloads: { [key: string]: { timestamp: number; originalFile: string; downloadTime: string } } = { ...existingTracker };
  
  // Download and process files
  const downloadPromises = filesToDownload.map(async (file) => {
    try {
      const tempZipPath = path.join(dataPath, `temp_${file.type}.zip`);
      const outputPath = path.join(dataPath, file.outputFile);
      
      // Download the zip file with fallback
      const result = await downloadFileWithFallback(baseUrl, file.type, tempZipPath);
      console.log(`Downloaded ${file.type}`);
      
      // Extract the CSV content to standardized filename
      await extractCsvToStandardFile(tempZipPath, outputPath, file.type);
      console.log(`Extracted ${file.type} to ${file.outputFile}`);
      
      // Track this download
      latestDownloads[file.type] = {
        timestamp: Date.now(),
        originalFile: result.filename,
        downloadTime: new Date().toISOString()
      };
      
      // Clean up temp zip file
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
      
    } catch (error) {
      console.warn(`Failed to download/process ${file.type}:`, error);
    }
  });
  
  await Promise.allSettled(downloadPromises);
  
  // Write the latest downloads tracker
  const trackerPath = path.join(dataPath, 'latest_downloads.json');
  fs.writeFileSync(trackerPath, JSON.stringify(latestDownloads, null, 2));
  console.log('Updated latest downloads tracker');
}

/**
 * Extract CSV content from zip file to standardized filename
 */
async function extractCsvToStandardFile(zipPath: string, outputPath: string, fileType: FileType): Promise<void> {
  const tempExtractDir = path.join(path.dirname(zipPath), 'temp_extract');
  
  try {
    // Ensure temp extraction directory exists
    if (!fs.existsSync(tempExtractDir)) {
      fs.mkdirSync(tempExtractDir, { recursive: true });
    }
    
    // Extract zip to temp directory
    await extractZipFile(zipPath, tempExtractDir);
    
    // Find the extracted CSV file that matches the expected file type
    // Use a recursive function to find files since readdirSync recursive might not be available
    const findFilesRecursively = (dir: string): string[] => {
      const files: string[] = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...findFilesRecursively(fullPath));
          } else {
            files.push(path.relative(tempExtractDir, fullPath));
          }
        }
      } catch (error) {
        console.warn(`Error reading directory ${dir}:`, error);
      }
      return files;
    };
    
    const extractedFiles = findFilesRecursively(tempExtractDir);
    const csvFile = extractedFiles.find((file: string) => 
      file.endsWith('.txt') && file.includes('CyberNations_SE') && file.includes(fileType)
    );
    
    if (!csvFile) {
      throw new Error(`No CSV file found in ${fileType} zip`);
    }
    
    const sourcePath = path.join(tempExtractDir, csvFile);
    const csvContent = fs.readFileSync(sourcePath, 'utf8');
    
    // Write to standardized output file
    fs.writeFileSync(outputPath, csvContent);
    
  } finally {
    // Clean up temp extraction directory
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
  }
}

export async function ensureRecentFiles(): Promise<void> {
  // Check if we're in the blackout window before doing anything
  if (isInBlackoutWindow()) {
    // Don't spam logs - only check staleness if we would actually try to download
    return;
  }

  const isProd = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');

  // Determine staleness using latest_downloads.json
  const staleTypes = getStaleFileTypesFromLatestDownloads();

  if (staleTypes.length === 0) {
    console.log('All standardized files are fresh according to latest_downloads.json');
    return;
  }

  if (isProd) {
    console.log('Production environment detected, attempting download with timeout protection for stale files:', staleTypes.join(', '));
    try {
      // Fallback to full download in prod for simplicity/timeouts
      await downloadWithTimeout();
    } catch (error) {
      console.warn('Download failed in production, using existing files:', error);
      return;
    }
  } else {
    try {
      console.log('Development environment detected, downloading stale standardized files:', staleTypes.join(', '));
      await performSelectiveDownload(staleTypes);
    } catch (error) {
      console.warn('Selective standardized download failed in development:', error);
    }
  }

  // After refreshing standardized files, sync alliance files using the new data
  try {
    console.log('Syncing alliance files with refreshed data...');
    const { loadDataFromFiles } = await import('../services/dataProcessingService.js');
    const { nations } = await loadDataFromFiles();
    if (nations.length > 0) {
      await syncAllianceFilesWithNewData(nations);
    } else {
      console.log('No nation data found after download, skipping alliance sync');
    }
  } catch (error) {
    console.error('Error syncing alliance files after download:', error);
  }
}

/**
 * Get custom filename from environment variables if specified
 */
function getCustomFilename(fileType: FileType): string | undefined {
  const envVarMap = {
    [FileType.NATION_STATS]: 'CUSTOM_NATION_STATS_FILE',
    [FileType.AID_STATS]: 'CUSTOM_AID_STATS_FILE',
    [FileType.WAR_STATS]: 'CUSTOM_WAR_STATS_FILE'
  };
  
  const envVar = envVarMap[fileType];
  const customFilename = process.env[envVar];
  
  if (customFilename) {
    console.log(`Using custom filename from ${envVar}: ${customFilename}`);
  }
  
  return customFilename;
}

/**
 * Try to download a file with fallback to previous time periods
 * Supports custom filename override via environment variables
 */
async function downloadFileWithFallback(
  baseUrl: string,
  fileType: FileType,
  tempZipPath: string
): Promise<{ success: boolean; filename: string }> {
  // Check for custom filename override first
  const customFilename = getCustomFilename(fileType);
  if (customFilename) {
    const url = `${baseUrl}${customFilename}`;
    try {
      console.log(`Trying to download custom file: ${customFilename}...`);
      await downloadFile(url, tempZipPath);
      console.log(`✓ Successfully downloaded ${customFilename}`);
      return { success: true, filename: customFilename };
    } catch (error: any) {
      console.error(`Failed to download custom file ${customFilename}:`, error.message);
      throw error;
    }
  }

  const flag_map = {
    [FileType.NATION_STATS]: '51000',
    [FileType.AID_STATS]: '52000',
    [FileType.WAR_STATS]: '52500'
  };

  // Always compute filename strictly from current Central date and day-part
  const flag = flag_map[fileType];
  const timestamp = getDownloadNumberSlug(flag, 0);
  const filename = `CyberNations_SE_${fileType}_${timestamp}.zip`;
  const url = `${baseUrl}${filename}`;

  console.log(`Attempting download for scheduled file: ${filename} (central-date/day-part)`);
  await downloadFile(url, tempZipPath);
  console.log(`✓ Successfully downloaded ${filename}`);
  return { success: true, filename };
}

/**
 * Download only the specified file types and update the tracker
 */
async function performSelectiveDownload(staleTypes: FileType[]): Promise<void> {
  const baseUrl = 'https://www.cybernations.net/assets/';

  // Setup data path
  let dataPath: string;
  try {
    const projectRoot = process.cwd();
    dataPath = path.join(projectRoot, 'src', 'data');
  } catch (error) {
    console.error('Error setting up paths:', error);
    throw error;
  }

  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }

  const mapping: Record<FileType, { outputFile: string }> = {
    [FileType.NATION_STATS]: { outputFile: 'nations.csv' },
    [FileType.AID_STATS]: { outputFile: 'aid_offers.csv' },
    [FileType.WAR_STATS]: { outputFile: 'wars.csv' }
  };

  const existingTracker = readLatestDownloadsTracker() || {};
  const latestDownloads: { [key: string]: { timestamp: number; originalFile: string; downloadTime: string } } = { ...existingTracker };

  for (const type of staleTypes) {
    const tempZipPath = path.join(dataPath, `temp_${type}.zip`);
    const outputPath = path.join(dataPath, mapping[type].outputFile);

    try {
      const result = await downloadFileWithFallback(baseUrl, type, tempZipPath);
      await extractCsvToStandardFile(tempZipPath, outputPath, type);
      latestDownloads[type] = {
        timestamp: Date.now(),
        originalFile: result.filename,
        downloadTime: new Date().toISOString()
      };
    } finally {
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
    }
  }

  const trackerPath = path.join(dataPath, 'latest_downloads.json');
  fs.writeFileSync(trackerPath, JSON.stringify(latestDownloads, null, 2));
  console.log('Updated latest downloads tracker (selective)');
}
