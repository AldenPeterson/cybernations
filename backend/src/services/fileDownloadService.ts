import { prisma } from '../utils/prisma.js';
import { FileType } from '../utils/dataDownloader.js';

export interface FileDownloadRecord {
  fileType: string;
  originalFile: string;
  timestamp: bigint;
  downloadTime: Date;
}

/**
 * Get file download record for a specific file type
 */
export async function getFileDownload(fileType: FileType): Promise<FileDownloadRecord | null> {
  const record = await prisma.fileDownload.findUnique({
    where: { fileType }
  });

  if (!record) {
    return null;
  }

  return {
    fileType: record.fileType,
    originalFile: record.originalFile,
    timestamp: record.timestamp,
    downloadTime: record.downloadTime
  };
}

/**
 * Get all file download records
 */
export async function getAllFileDownloads(): Promise<Record<string, FileDownloadRecord>> {
  const records = await prisma.fileDownload.findMany();
  
  const result: Record<string, FileDownloadRecord> = {};
  for (const record of records) {
    result[record.fileType] = {
      fileType: record.fileType,
      originalFile: record.originalFile,
      timestamp: record.timestamp,
      downloadTime: record.downloadTime
    };
  }
  
  return result;
}

/**
 * Upsert file download record
 */
export async function upsertFileDownload(
  fileType: FileType,
  originalFile: string,
  timestamp: number = Date.now()
): Promise<FileDownloadRecord> {
  const record = await prisma.fileDownload.upsert({
    where: { fileType },
    update: {
      originalFile,
      timestamp: BigInt(timestamp),
      downloadTime: new Date()
    },
    create: {
      fileType,
      originalFile,
      timestamp: BigInt(timestamp),
      downloadTime: new Date()
    }
  });

  return {
    fileType: record.fileType,
    originalFile: record.originalFile,
    timestamp: record.timestamp,
    downloadTime: record.downloadTime
  };
}

