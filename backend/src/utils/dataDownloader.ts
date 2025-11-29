import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { extractZipFile } from './zipExtractor.js';
// Alliance sync is now handled via database - no file sync needed
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

  // Between 12am-6am Central, use the previous day's date
  // Between 6am-12am Central, use the current day's date
  let actualDate = centralDate;
  if (hours >= 0 && hours < 6) {
    actualDate = new Date(centralDate);
    actualDate.setDate(actualDate.getDate() - 1);
  }
  
  const actualYear = actualDate.getFullYear();
  const actualMonth = actualDate.getMonth() + 1;
  const actualDay = actualDate.getDate();
  
  // Determine if it's between 6am and 6pm Central Time
  const isDaytime = hours >= 6 && hours < 18;
  const timeSuffix = isDaytime ? '1' : '2';
  
  // Format: MMDDYYYYXXXX where XXXX is 4-digit file identifier + toggle
  // Example: 91820250002 (9/18/2025, file 0002, daytime=1)
  const slug = `${actualMonth}${actualDay}${actualYear}${file_flag}${timeSuffix}`;
  console.log(`Slug: ${slug}`);
  return slug;
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
    let rejected = false;
    
    const cleanup = () => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
    
    const handleError = (err: Error) => {
      if (!rejected) {
        rejected = true;
        try {
          file.destroy();
        } catch (e) {
          // Ignore destroy errors
        }
        cleanup();
        reject(err);
      }
    };
    
    // Suppress unhandled errors on file stream
    file.on('error', handleError);
    
    const req = https.get(url, (response) => {
      if (rejected) {
        response.destroy();
        return;
      }
      
      // Handle any errors during the response
      response.on('error', handleError);
      
      if (response.statusCode !== 200) {
        response.destroy();
        handleError(new Error(`Failed to download file from ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        if (!rejected) {
          file.close();
          resolve();
        }
      });
    });
    
    req.on('error', handleError);
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
 * Read the latest downloads tracker from database
 */
async function readLatestDownloadsTracker(): Promise<Record<string, { timestamp: number; originalFile: string; downloadTime: string }> | null> {
  try {
    const { getAllFileDownloads } = await import('../services/fileDownloadService.js');
    const downloads = await getAllFileDownloads();
    
    if (Object.keys(downloads).length === 0) {
      return null;
    }
    
    // Convert to the expected format
    const result: Record<string, { timestamp: number; originalFile: string; downloadTime: string }> = {};
    for (const [fileType, record] of Object.entries(downloads)) {
      result[fileType] = {
        timestamp: Number(record.timestamp),
        originalFile: record.originalFile,
        downloadTime: record.downloadTime.toISOString()
      };
    }
    
    return result;
  } catch (error) {
    console.warn('Error reading downloads tracker from database:', error);
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
 * Determine which file types are stale based on database
 * using the twice-daily schedule at 6am/6pm Central.
 */
async function getStaleFileTypesFromLatestDownloads(): Promise<FileType[]> {
  const tracker = await readLatestDownloadsTracker();
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
    // Check recency against 6am/6pm Central schedule using database
    const stale = await getStaleFileTypesFromLatestDownloads();
    if (stale.length === 0) {
      console.log('Found recent standardized data files via database');
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
async function downloadWithTimeout(): Promise<DownloadResult[]> {
  const timeoutPromise = new Promise<DownloadResult[]>((_, reject) => {
    setTimeout(() => reject(new Error('Download timeout')), 25000); // 25 second timeout
  });
  
  const downloadPromise = performDownload();
  
  return await Promise.race([downloadPromise, timeoutPromise]);
}

/**
 * Get the appropriate data path for the current environment
 * On Vercel/serverless, use /tmp directory (only writable location)
 * Otherwise, use the project's src/data directory
 */
function getDataPath(): string {
  const isVercel = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');
  
  if (isVercel) {
    // Vercel serverless functions can only write to /tmp
    return '/tmp/cybernations_data';
  } else {
    // Local development: use project directory
    const projectRoot = process.cwd();
    return path.join(projectRoot, 'src', 'data');
  }
}

/**
 * Perform the actual download with standardized file naming
 */
interface DownloadResult {
  fileType: FileType;
  success: boolean;
  error?: string;
  filename?: string;
}

async function performDownload(): Promise<DownloadResult[]> {
  const baseUrl = 'https://www.cybernations.net/assets/';
  
  // Get appropriate data path for environment
  const dataPath = getDataPath();
  
  // Ensure data directory exists
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  
  const filesToDownload = [
    { type: FileType.NATION_STATS, outputFile: 'nations.csv' },
    { type: FileType.AID_STATS, outputFile: 'aid_offers.csv' },
    { type: FileType.WAR_STATS, outputFile: 'wars.csv' }
  ];
  
  // Get existing tracker from database
  const existingTracker = await readLatestDownloadsTracker() || {};
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
      
      // Track this download in memory (will be saved to database later)
      latestDownloads[file.type] = {
        timestamp: Date.now(),
        originalFile: result.filename,
        downloadTime: new Date().toISOString()
      };
      
      // Clean up temp zip file
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
      
      return { 
        success: true, 
        fileType: file.type,
        filename: result.filename
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error(`Failed to download/process ${file.type}: ${errorMsg}`);
      return { 
        success: false, 
        fileType: file.type, 
        error: errorMsg 
      };
    }
  });
  
  const results = await Promise.allSettled(downloadPromises);
  
  // Extract results from Promise.allSettled
  const downloadResults: DownloadResult[] = results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        fileType: FileType.NATION_STATS, // fallback, shouldn't happen
        success: false,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });
  
  // Log summary of download results
  const successful = downloadResults.filter(r => r.success).length;
  const failed = downloadResults.length - successful;
  if (failed > 0) {
    console.warn(`Download summary: ${successful} succeeded, ${failed} failed`);
    downloadResults.forEach(result => {
      if (result.success) {
        console.log(`  ✓ ${result.fileType}: ${result.filename}`);
      } else {
        console.log(`  ✗ ${result.fileType}: ${result.error}`);
      }
    });
  } else {
    console.log(`Download summary: All ${successful} files downloaded successfully`);
  }
  
  // Update the database tracker
  const { upsertFileDownload } = await import('../services/fileDownloadService.js');
  for (const [fileType, record] of Object.entries(latestDownloads)) {
    await upsertFileDownload(fileType as FileType, record.originalFile, record.timestamp);
  }
  console.log('Updated latest downloads tracker in database');
  
  return downloadResults;
}

/**
 * Extract CSV content from zip file to standardized filename
 */
export async function extractCsvToStandardFile(zipPath: string, outputPath: string, fileType: FileType): Promise<void> {
  // Use /tmp for extraction on Vercel, otherwise use same directory as zip
  const isVercel = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');
  const tempExtractDir = isVercel 
    ? path.join('/tmp', `cybernations_extract_${Date.now()}`)
    : path.join(path.dirname(zipPath), 'temp_extract');
  
  try {
    // Ensure temp extraction directory exists
    if (!fs.existsSync(tempExtractDir)) {
      fs.mkdirSync(tempExtractDir, { recursive: true });
    }
    
    // Extract zip to temp directory
    console.log(`Extracting ${fileType} zip to ${tempExtractDir}...`);
    const extractionResult = await extractZipFile(zipPath, tempExtractDir);
    
    if (!extractionResult.success) {
      throw new Error(`Failed to extract zip file: ${extractionResult.error || 'Unknown error'}`);
    }
    
    console.log(`Extraction successful, extracted ${extractionResult.extractedFiles.length} file(s)`);
    
    // Verify extraction directory still exists after extraction
    if (!fs.existsSync(tempExtractDir)) {
      throw new Error(`Extraction directory was removed or never created: ${tempExtractDir}`);
    }
    
    // Find the extracted CSV file that matches the expected file type
    // Use a recursive function to find files since readdirSync recursive might not be available
    const findFilesRecursively = (dir: string): string[] => {
      const files: string[] = [];
      try {
        // Double-check directory exists before reading
        if (!fs.existsSync(dir)) {
          console.warn(`Directory does not exist: ${dir}`);
          return files;
        }
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...findFilesRecursively(fullPath));
          } else {
            files.push(path.relative(tempExtractDir, fullPath));
          }
        }
      } catch (error: any) {
        console.warn(`Error reading directory ${dir}:`, error?.message || error);
      }
      return files;
    };
    
    const extractedFiles = findFilesRecursively(tempExtractDir);
    
    if (extractedFiles.length === 0) {
      throw new Error(`No files extracted from ${fileType} zip (extraction reported success but directory is empty)`);
    }
    
    const csvFile = extractedFiles.find((file: string) => 
      file.endsWith('.txt') && file.includes('CyberNations_SE') && file.includes(fileType)
    );
    
    if (!csvFile) {
      console.error(`Available extracted files: ${extractedFiles.join(', ')}`);
      throw new Error(`No CSV file found in ${fileType} zip. Expected file containing 'CyberNations_SE' and '${fileType}' with .txt extension`);
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

export async function ensureRecentFiles(): Promise<DownloadResult[]> {
  // Check if we're in the blackout window before doing anything
  if (isInBlackoutWindow()) {
    // Don't spam logs - only check staleness if we would actually try to download
    return [];
  }

  const isProd = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');

  // Determine staleness using database
  const staleTypes = await getStaleFileTypesFromLatestDownloads();

    if (staleTypes.length === 0) {
      console.log('All standardized files are fresh according to database');
      return [];
    }

  let downloadResults: DownloadResult[] = [];

  if (isProd) {
    console.log('Production environment detected, attempting download with timeout protection for stale files:', staleTypes.join(', '));
    try {
      // Fallback to full download in prod for simplicity/timeouts
      downloadResults = await downloadWithTimeout();
      console.log('Download completed (some files may have failed, but process continued)');
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.warn(`Download failed in production, gracefully falling back to existing data: ${errorMsg}`);
      // Return empty results to indicate no downloads succeeded
      return [];
    }
  } else {
    try {
      console.log('Development environment detected, downloading stale standardized files:', staleTypes.join(', '));
      downloadResults = await performSelectiveDownload(staleTypes);
      console.log('Download completed (some files may have failed, but process continued)');
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.warn(`Selective standardized download failed in development, gracefully falling back to existing data: ${errorMsg}`);
      // Return empty results to indicate no downloads succeeded
      return [];
    }
  }

  // After refreshing standardized files, import CSV data into database
  try {
    console.log('Importing CSV data into database...');
    const { importAllCsvFiles } = await import('../services/csvImportService.js');
    await importAllCsvFiles();
    console.log('CSV data imported into database successfully');
  } catch (error) {
    console.warn('Error importing CSV data into database:', error);
  }

  // Alliance data is now stored in the database via CSV imports
  // No need to sync JSON files - the database is the source of truth

  return downloadResults;
}

/**
 * Manually sync alliance files with current data files
 * @deprecated Alliance data is now stored in the database via CSV imports
 * This function is kept for backwards compatibility but does nothing
 */
export async function syncAllianceFiles(): Promise<void> {
  console.log('Alliance sync is no longer needed - data is stored in database via CSV imports');
  // Alliance data is automatically updated when CSV files are imported
  // No file-based sync is needed anymore
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
 * Try to download a file based on current timestamp
 * Supports custom filename override via environment variables
 * Tries current timestamp first, then falls back to recent timestamps to get newest available file
 */
export async function downloadFileWithFallback(
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

  const flag = flag_map[fileType];
  
  // Try current timestamp first, then fall back to recent timestamps
  // Files are updated at 6am and 6pm Central, so we try offsets that align with those boundaries
  // This ensures we get the newest available file based on current time
  // Also try both time suffixes (1 and 2) in case files are released early/late
  const offsetsToTry = [0, 6, 12, 18, 24]; // Try current, then 6h, 12h, 18h, 24h back
  
  for (const hoursOffset of offsetsToTry) {
    // Get the base timestamp (without the time suffix)
    const baseTimestamp = getDownloadNumberSlug(flag, hoursOffset);
    // Remove the last digit (time suffix) to get the base
    const baseWithoutSuffix = baseTimestamp.slice(0, -1);
    
    // Try both time suffixes (1 and 2) in case file was released early/late
    const suffixesToTry = ['1', '2'];
    
    for (const suffix of suffixesToTry) {
      const timestamp = `${baseWithoutSuffix}${suffix}`;
      const filename = `CyberNations_SE_${fileType}_${timestamp}.zip`;
      const url = `${baseUrl}${filename}`;

      try {
        if (hoursOffset === 0 && suffix === baseTimestamp.slice(-1)) {
          console.log(`Attempting download for current file: ${filename}`);
        } else if (hoursOffset === 0) {
          console.log(`Trying alternate time suffix for current timestamp: ${filename}`);
        } else {
          console.log(`Trying recent file (${hoursOffset}h back, suffix ${suffix}): ${filename}`);
        }
        await downloadFile(url, tempZipPath);
        console.log(`✓ Successfully downloaded ${filename}`);
        return { success: true, filename };
      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error';
        const statusCode = errorMsg.includes('404') ? ' (404 Not Found)' : errorMsg.includes('403') ? ' (403 Forbidden)' : '';
        if (hoursOffset === 0 && suffix === baseTimestamp.slice(-1)) {
          console.log(`Current file not available${statusCode}, trying alternatives...`);
        }
        // Continue to next attempt
      }
    }
  }
  
  // If all attempts failed, throw an error
  throw new Error(`Failed to download ${fileType} file after trying ${offsetsToTry.length} recent timestamps`);
}

/**
 * Download only the specified file types and update the tracker
 */
async function performSelectiveDownload(staleTypes: FileType[]): Promise<DownloadResult[]> {
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

  const { upsertFileDownload } = await import('../services/fileDownloadService.js');
  const results: DownloadResult[] = [];

  for (const type of staleTypes) {
    const tempZipPath = path.join(dataPath, `temp_${type}.zip`);
    const outputPath = path.join(dataPath, mapping[type].outputFile);

    try {
      const result = await downloadFileWithFallback(baseUrl, type, tempZipPath);
      await extractCsvToStandardFile(tempZipPath, outputPath, type);
      // Update database tracker
      await upsertFileDownload(type, result.filename);
      results.push({
        fileType: type,
        success: true,
        filename: result.filename
      });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error(`Failed to download/process ${type}: ${errorMsg}`);
      results.push({
        fileType: type,
        success: false,
        error: errorMsg
      });
    } finally {
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
    }
  }

  console.log('Updated latest downloads tracker in database (selective)');
  return results;
}
