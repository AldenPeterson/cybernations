import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileType, getFileInfo } from '../dataDownloader.js';

describe('dataDownloader', () => {
  beforeEach(() => {
    // Mock the current date to a fixed value for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-19T20:00:00Z')); // 8 PM UTC = 2 PM CST, should be daytime
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getFileInfo', () => {
    it('should generate correct filename for NATION_STATS', () => {
      const result = getFileInfo(FileType.NATION_STATS);
      
      expect(result.name).toBe('CyberNations_SE_Nation_Stats_9192025510001.zip');
      expect(result.timestamp).toBe(9192025510001);
      expect(result.isRecent).toBe(true);
    });

    it('should generate correct filename for AID_STATS', () => {
      const result = getFileInfo(FileType.AID_STATS);
      
      expect(result.name).toBe('CyberNations_SE_Aid_Stats_9192025520001.zip');
      expect(result.timestamp).toBe(9192025520001);
      expect(result.isRecent).toBe(true);
    });

    it('should generate correct filename for WAR_STATS', () => {
      const result = getFileInfo(FileType.WAR_STATS);
      
      expect(result.name).toBe('CyberNations_SE_War_Stats_9192025525001.zip');
      
      expect(result.timestamp).toBe(9192025525001);
      expect(result.isRecent).toBe(true);
    });

    it('should generate correct filename for nighttime (6pm-6am)', () => {
      // Set time to 2 AM UTC = 8 PM CST (nighttime)
      vi.setSystemTime(new Date('2025-09-20T02:00:00Z'));
      
      const result = getFileInfo(FileType.NATION_STATS);
      
      expect(result.name).toBe('CyberNations_SE_Nation_Stats_9192025510002.zip');
      expect(result.timestamp).toBe(9192025510002);
    });

    it('should use previous day between 12am-6am Central time', () => {
      // Set time to 4 AM UTC = 10 PM CST on Sep 20 (between 12am-6am Central on Sep 21)
      // Should use Sep 20 date, not Sep 21
      vi.setSystemTime(new Date('2025-09-21T04:00:00Z'));
      
      const result = getFileInfo(FileType.NATION_STATS);
      
      // Should use Sep 20 date (9202025) with nighttime suffix (2)
      expect(result.name).toBe('CyberNations_SE_Nation_Stats_9202025510002.zip');
      expect(result.timestamp).toBe(9202025510002);
    });

    it('should use current day between 6am-12am Central time', () => {
      // Set time to 12 PM UTC = 6 AM CST on Sep 21 (between 6am-12am Central)
      // Should use Sep 21 date
      vi.setSystemTime(new Date('2025-09-21T12:00:00Z'));
      
      const result = getFileInfo(FileType.NATION_STATS);
      
      // Should use Sep 21 date (9212025) with daytime suffix (1)
      expect(result.name).toBe('CyberNations_SE_Nation_Stats_9212025510001.zip');
      expect(result.timestamp).toBe(9212025510001);
    });

    it('should use current day in evening hours (6pm-12am)', () => {
      // Set time to 2 AM UTC = 8 PM CST on Sep 21 (between 6pm-12am Central)
      // Should use Sep 21 date
      vi.setSystemTime(new Date('2025-09-22T02:00:00Z'));
      
      const result = getFileInfo(FileType.NATION_STATS);
      
      // Should use Sep 21 date (9212025) with nighttime suffix (2)
      expect(result.name).toBe('CyberNations_SE_Nation_Stats_9212025510002.zip');
      expect(result.timestamp).toBe(9212025510002);
    });

    it('should generate correct filename for different dates', () => {
      // Set time to December 25th, 2 PM UTC = 8 AM CST (daytime)
      vi.setSystemTime(new Date('2025-12-25T20:00:00Z'));
      
      const result = getFileInfo(FileType.AID_STATS);
      
      expect(result.name).toBe('CyberNations_SE_Aid_Stats_12252025520001.zip');
      expect(result.timestamp).toBe(12252025520001);
    });

    it('should use correct flags for each file type', () => {
      const nationResult = getFileInfo(FileType.NATION_STATS);
      const aidResult = getFileInfo(FileType.AID_STATS);
      const warResult = getFileInfo(FileType.WAR_STATS);
      
      // Check that the flags are embedded correctly in the timestamps
      expect(nationResult.timestamp.toString()).toContain('51000');
      expect(aidResult.timestamp.toString()).toContain('52000');
      expect(warResult.timestamp.toString()).toContain('5250');
    });

    it('should generate consistent filenames for the same time', () => {
      const result1 = getFileInfo(FileType.NATION_STATS);
      const result2 = getFileInfo(FileType.NATION_STATS);
      
      expect(result1.name).toBe(result2.name);
      expect(result1.timestamp).toBe(result2.timestamp);
    });
  });
});
