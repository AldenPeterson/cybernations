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
 * Determine which file types are stale based on latest_downloads.json
 */
function getStaleFileTypesFromLatestDownloads(maxAgeMs: number): FileType[] {
  const tracker = readLatestDownloadsTracker();
  const requiredKeys: { key: string; type: FileType; csv: string }[] = [
    { key: FileType.NATION_STATS, type: FileType.NATION_STATS, csv: 'nations.csv' },
    { key: FileType.AID_STATS, type: FileType.AID_STATS, csv: 'aid_offers.csv' },
    { key: FileType.WAR_STATS, type: FileType.WAR_STATS, csv: 'wars.csv' }
  ];

  const dataPath = path.join(process.cwd(), 'src', 'data');
  const now = Date.now();

  const stale: FileType[] = [];

  for (const item of requiredKeys) {
    const csvPath = path.join(dataPath, item.csv);
    const hasCsv = fs.existsSync(csvPath);
    const record = tracker ? tracker[item.key] : undefined;

    if (!record || !hasCsv) {
      stale.push(item.type);
      continue;
    }

    const isFresh = now - record.timestamp < maxAgeMs;
    if (!isFresh) {
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
    // Check recency using latest_downloads.json as source of truth
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    const stale = getStaleFileTypesFromLatestDownloads(THREE_HOURS_MS);
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
    { type: FileType.NATION_STATS, url: `${baseUrl}${getFileInfo(FileType.NATION_STATS).name}`, outputFile: 'nations.csv' },
    { type: FileType.AID_STATS, url: `${baseUrl}${getFileInfo(FileType.AID_STATS).name}`, outputFile: 'aid_offers.csv' },
    { type: FileType.WAR_STATS, url: `${baseUrl}${getFileInfo(FileType.WAR_STATS).name}`, outputFile: 'wars.csv' }
  ];
  
  // Merge with existing tracker to preserve fresh entries
  const existingTracker = readLatestDownloadsTracker() || {};
  const latestDownloads: { [key: string]: { timestamp: number; originalFile: string; downloadTime: string } } = { ...existingTracker };
  
  // Download and process files
  const downloadPromises = filesToDownload.map(async (file) => {
    try {
      const tempZipPath = path.join(dataPath, `temp_${file.type}.zip`);
      const outputPath = path.join(dataPath, file.outputFile);
      
      // Download the zip file
      await downloadFile(file.url, tempZipPath);
      console.log(`Downloaded ${file.type}`);
      
      // Extract the CSV content to standardized filename
      await extractCsvToStandardFile(tempZipPath, outputPath, file.type);
      console.log(`Extracted ${file.type} to ${file.outputFile}`);
      
      // Track this download
      latestDownloads[file.type] = {
        timestamp: Date.now(),
        originalFile: file.url.split('/').pop() || '',
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
    // Extract zip to temp directory
    await extractZipFile(zipPath, tempExtractDir);
    
    // Find the extracted CSV file
    const extractedFiles = fs.readdirSync(tempExtractDir, { recursive: true }) as string[];
    const csvFile = extractedFiles.find((file: string) => 
      file.endsWith('.txt') && file.includes('CyberNations_SE')
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
  const isProd = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');

  // Determine staleness using latest_downloads.json
  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
  const staleTypes = getStaleFileTypesFromLatestDownloads(THREE_HOURS_MS);

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
    const fileInfo = getFileInfo(type);
    const url = `${baseUrl}${fileInfo.name}`;
    const tempZipPath = path.join(dataPath, `temp_${type}.zip`);
    const outputPath = path.join(dataPath, mapping[type].outputFile);

    try {
      await downloadFile(url, tempZipPath);
      await extractCsvToStandardFile(tempZipPath, outputPath, type);
      latestDownloads[type] = {
        timestamp: Date.now(),
        originalFile: fileInfo.name,
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
