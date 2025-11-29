import * as yauzl from 'yauzl';
import * as fs from 'fs';
import * as path from 'path';

export interface ExtractionResult {
  success: boolean;
  extractedFiles: string[];
  error?: string;
}

export async function extractZipFile(zipPath: string, extractTo: string): Promise<ExtractionResult> {
  // On Vercel, ensure we're using /tmp directory
  const isVercel = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');
  if (isVercel && !extractTo.startsWith('/tmp')) {
    console.warn('Warning: extractTo should be in /tmp on Vercel, but got:', extractTo);
  }

  return new Promise((resolve) => {
    const extractedFiles: string[] = [];
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        resolve({
          success: false,
          extractedFiles: [],
          error: `Failed to open zip file: ${err.message}`
        });
        return;
      }

      if (!zipfile) {
        resolve({
          success: false,
          extractedFiles: [],
          error: 'Zip file is null or undefined'
        });
        return;
      }

      // Ensure extraction directory exists
      try {
        if (!fs.existsSync(extractTo)) {
          fs.mkdirSync(extractTo, { recursive: true });
        }
      } catch (error) {
        resolve({
          success: false,
          extractedFiles: [],
          error: `Failed to create extraction directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        return;
      }

      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          const dirPath = path.join(extractTo, entry.fileName);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
          zipfile.readEntry();
        } else {
          // File entry
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              resolve({
                success: false,
                extractedFiles: [],
                error: `Failed to read entry ${entry.fileName}: ${err.message}`
              });
              return;
            }

            if (!readStream) {
              resolve({
                success: false,
                extractedFiles: [],
                error: `Read stream is null for entry ${entry.fileName}`
              });
              return;
            }

            const filePath = path.join(extractTo, entry.fileName);
            const writeStream = fs.createWriteStream(filePath);
            
            readStream.pipe(writeStream);
            
            writeStream.on('close', () => {
              extractedFiles.push(entry.fileName);
              zipfile.readEntry();
            });
            
            writeStream.on('error', (err) => {
              resolve({
                success: false,
                extractedFiles: [],
                error: `Failed to write file ${entry.fileName}: ${err.message}`
              });
            });
          });
        }
      });

      zipfile.on('end', () => {
        resolve({
          success: true,
          extractedFiles
        });
      });

      zipfile.on('error', (err) => {
        resolve({
          success: false,
          extractedFiles: [],
          error: `Zip file error: ${err.message}`
        });
      });
    });
  });
}

export async function extractAllZipFiles(rawDataPath: string): Promise<{
  success: boolean;
  results: Array<{
    zipFile: string;
    extractionResult: ExtractionResult;
  }>;
  error?: string;
}> {
  // Skip file operations in serverless environments like Vercel
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return {
      success: false,
      results: [],
      error: 'File operations not supported in serverless environment'
    };
  }

  try {
    // Ensure the raw data directory exists
    if (!fs.existsSync(rawDataPath)) {
      return {
        success: false,
        results: [],
        error: `Raw data directory does not exist: ${rawDataPath}`
      };
    }
    
    const files = fs.readdirSync(rawDataPath);
    const zipFiles = files.filter(file => file.toLowerCase().endsWith('.zip'));
    
    if (zipFiles.length === 0) {
      return {
        success: false,
        results: [],
        error: 'No zip files found in raw_data directory'
      };
    }

    const results = [];
    
    for (const zipFile of zipFiles) {
      const zipPath = path.join(rawDataPath, zipFile);
      const extractTo = path.join(rawDataPath, 'extracted', path.basename(zipFile, '.zip'));
      
      console.log(`Extracting ${zipFile} to ${extractTo}`);
      const extractionResult = await extractZipFile(zipPath, extractTo);
      
      results.push({
        zipFile,
        extractionResult
      });
    }

    return {
      success: true,
      results
    };
  } catch (err) {
    return {
      success: false,
      results: [],
      error: `Failed to process raw_data directory: ${err instanceof Error ? err.message : 'Unknown error'}`
    };
  }
}
