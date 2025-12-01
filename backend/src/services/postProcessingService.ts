import { prisma } from '../utils/prisma.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to the post-processing SQL script
 */
function getPostProcessingSqlPath(): string {
  // Try multiple possible locations
  // 1. Relative to current file (development)
  const relativePath = path.resolve(__dirname, '..', '..', 'prisma', 'post-processing.sql');
  if (fs.existsSync(relativePath)) {
    return relativePath;
  }
  
  // 2. Relative to process.cwd() (production/build)
  const cwdPath = path.join(process.cwd(), 'prisma', 'post-processing.sql');
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  
  // 3. Try backend/prisma (if running from root)
  const rootPath = path.join(process.cwd(), 'backend', 'prisma', 'post-processing.sql');
  if (fs.existsSync(rootPath)) {
    return rootPath;
  }
  
  // Return the most likely path (relative to current file)
  return relativePath;
}

/**
 * Read the SQL query from the Prisma script file
 * @returns The SQL query string or null if file doesn't exist or is empty
 */
export function getPostProcessingSqlQuery(): string | null {
  const sqlPath = getPostProcessingSqlPath();
  
  try {
    if (!fs.existsSync(sqlPath)) {
      console.log(`[Post-Processing] SQL script file not found at ${sqlPath}`);
      return null;
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8').trim();
    
    // Remove SQL comments and empty lines
    const lines = sqlContent.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('--'));
    
    if (lines.length === 0) {
      console.log('[Post-Processing] SQL script file is empty or contains only comments');
      return null;
    }
    
    const sqlQuery = lines.join('\n').trim();
    return sqlQuery;
  } catch (error: any) {
    console.error(`[Post-Processing] Error reading SQL script file:`, error?.message || String(error));
    return null;
  }
}

/**
 * Execute a raw SQL query after successful data processing
 * @param sqlQuery - The SQL query to execute
 * @returns Promise that resolves when the query completes
 * @throws Error if the query execution fails
 */
export async function executePostProcessingQuery(sqlQuery: string): Promise<void> {
  console.log('[Post-Processing] Executing post-processing SQL query...');
  const startTime = Date.now();
  
  try {
    // Execute raw SQL query using Prisma
    await prisma.$executeRawUnsafe(sqlQuery);
    
    const executionTime = Date.now() - startTime;
    console.log(`[Post-Processing] SQL query executed successfully in ${executionTime}ms (${(executionTime / 1000).toFixed(2)}s)`);
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`[Post-Processing] Error executing SQL query after ${executionTime}ms:`, error);
    // Re-throw to allow caller to handle the error
    throw error;
  }
}

/**
 * Execute post-processing SQL query if configured
 * This should be called after all data files for a day have been successfully processed
 * Reads the SQL query from prisma/post-processing.sql
 */
export async function executePostProcessingIfConfigured(): Promise<boolean> {
  const sqlQuery = getPostProcessingSqlQuery();
  
  if (!sqlQuery) {
    console.log('[Post-Processing] No post-processing SQL query found in prisma/post-processing.sql');
    return false;
  }
  
  try {
    await executePostProcessingQuery(sqlQuery);
    return true;
  } catch (error: any) {
    console.error('[Post-Processing] Failed to execute post-processing query:', error?.message || String(error));
    return false;
  }
}

