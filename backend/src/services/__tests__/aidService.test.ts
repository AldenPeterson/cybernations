import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AidService } from '../aidService.js';

// Mock the dependencies
vi.mock('../dataProcessingService.js', () => ({
  loadDataFromFilesWithUpdate: vi.fn(),
  getAidSlotsForAlliance: vi.fn(),
}));

vi.mock('../nationCategorizationService.js', () => ({
  categorizeNations: vi.fn(),
  getNationsThatShouldGetCash: vi.fn(),
  getNationsThatShouldSendTechnology: vi.fn(),
  getNationsThatShouldGetTechnology: vi.fn(),
  getNationsThatShouldSendCash: vi.fn(),
}));

vi.mock('../allianceService.js', () => ({
  AllianceService: {
    getAllianceDataWithJsonPriority: vi.fn(),
  },
}));

describe('AidService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAidRecommendations', () => {
    it('should filter out peace mode nations from aid recommendations', async () => {
      const mockNations = [
        {
          id: 1,
          rulerName: 'Active Ruler',
          nationName: 'Active Nation',
          alliance: 'Test Alliance',
          allianceId: 123,
          warStatus: 'Active',
          slots: { sendCash: 2, sendTech: 0, getCash: 0, getTech: 4 },
          has_dra: false,
        },
        {
          id: 2,
          rulerName: 'Peace Ruler',
          nationName: 'Peace Nation',
          alliance: 'Test Alliance',
          allianceId: 123,
          warStatus: 'Peace Mode',
          slots: { sendCash: 2, sendTech: 0, getCash: 0, getTech: 4 },
          has_dra: false,
        },
        {
          id: 3,
          rulerName: 'Another Active Ruler',
          nationName: 'Another Active Nation',
          alliance: 'Test Alliance',
          allianceId: 123,
          warStatus: 'War',
          slots: { sendCash: 0, sendTech: 0, getCash: 6, getTech: 0 },
          has_dra: false,
        },
      ];

      const mockAidOffers = [];

      // Mock the alliance service to return our test data
      const { AllianceService } = await import('../allianceService.js');
      vi.mocked(AllianceService.getAllianceDataWithJsonPriority).mockResolvedValue({
        nations: mockNations,
        aidOffers: mockAidOffers,
        useJsonData: true,
      });

      // Mock the categorization functions to return filtered nations
      const { 
        getNationsThatShouldGetCash,
        getNationsThatShouldSendTechnology,
        getNationsThatShouldGetTechnology,
        getNationsThatShouldSendCash
      } = await import('../nationCategorizationService.js');

      // Only active nations should be returned by these functions
      vi.mocked(getNationsThatShouldSendCash).mockReturnValue([mockNations[0]]);
      vi.mocked(getNationsThatShouldGetCash).mockReturnValue([mockNations[2]]);
      vi.mocked(getNationsThatShouldSendTechnology).mockReturnValue([]);
      vi.mocked(getNationsThatShouldGetTechnology).mockReturnValue([]);

      const result = await AidService.getAidRecommendations(123);

      // Verify that peace mode nation (id: 2) is not included in slot counts
      expect(result.slotCounts.totalSendCash).toBe(2); // Only from active nation (id: 1)
      expect(result.slotCounts.totalGetCash).toBe(6); // Only from active nation (id: 3)
      expect(result.slotCounts.totalSendTech).toBe(0);
      expect(result.slotCounts.totalGetTech).toBe(4); // From active nation (id: 1)

      // Verify that the categorization functions were called with only active nations
      expect(getNationsThatShouldSendCash).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, warStatus: 'Active' }),
          expect.objectContaining({ id: 3, warStatus: 'War' }),
        ])
      );
      expect(getNationsThatShouldGetCash).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, warStatus: 'Active' }),
          expect.objectContaining({ id: 3, warStatus: 'War' }),
        ])
      );

      // Verify that peace mode nation is not included in the filtered list
      expect(getNationsThatShouldSendCash).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 2, warStatus: 'Peace Mode' }),
        ])
      );
    });

    it('should handle case when all nations are in peace mode', async () => {
      const mockNations = [
        {
          id: 1,
          rulerName: 'Peace Ruler 1',
          nationName: 'Peace Nation 1',
          alliance: 'Test Alliance',
          allianceId: 123,
          warStatus: 'Peace Mode',
          slots: { sendCash: 2, sendTech: 0, getCash: 0, getTech: 4 },
          has_dra: false,
        },
        {
          id: 2,
          rulerName: 'Peace Ruler 2',
          nationName: 'Peace Nation 2',
          alliance: 'Test Alliance',
          allianceId: 123,
          warStatus: 'Peace Mode',
          slots: { sendCash: 0, sendTech: 0, getCash: 6, getTech: 0 },
          has_dra: false,
        },
      ];

      const mockAidOffers = [];

      const { AllianceService } = await import('../allianceService.js');
      vi.mocked(AllianceService.getAllianceDataWithJsonPriority).mockResolvedValue({
        nations: mockNations,
        aidOffers: mockAidOffers,
        useJsonData: true,
      });

      const { 
        getNationsThatShouldGetCash,
        getNationsThatShouldSendTechnology,
        getNationsThatShouldGetTechnology,
        getNationsThatShouldSendCash
      } = await import('../nationCategorizationService.js');

      // All categorization functions should return empty arrays since all nations are in peace mode
      vi.mocked(getNationsThatShouldSendCash).mockReturnValue([]);
      vi.mocked(getNationsThatShouldGetCash).mockReturnValue([]);
      vi.mocked(getNationsThatShouldSendTechnology).mockReturnValue([]);
      vi.mocked(getNationsThatShouldGetTechnology).mockReturnValue([]);

      const result = await AidService.getAidRecommendations(123);

      // All slot counts should be 0 since no active nations
      expect(result.slotCounts.totalSendCash).toBe(0);
      expect(result.slotCounts.totalGetCash).toBe(0);
      expect(result.slotCounts.totalSendTech).toBe(0);
      expect(result.slotCounts.totalGetTech).toBe(0);
      expect(result.slotCounts.totalUnassigned).toBe(0);

      // No recommendations should be generated
      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe('getCategorizedNations', () => {
    it('should filter out peace mode nations from categorized nations', async () => {
      const mockNations = [
        {
          id: 1,
          rulerName: 'Active Ruler',
          nationName: 'Active Nation',
          alliance: 'Test Alliance',
          allianceId: 123,
          warStatus: 'Active',
          slots: { sendCash: 2, sendTech: 0, getCash: 0, getTech: 4 },
          has_dra: false,
        },
        {
          id: 2,
          rulerName: 'Peace Ruler',
          nationName: 'Peace Nation',
          alliance: 'Test Alliance',
          allianceId: 123,
          warStatus: 'Peace Mode',
          slots: { sendCash: 2, sendTech: 0, getCash: 0, getTech: 4 },
          has_dra: false,
        },
      ];

      const { AllianceService } = await import('../allianceService.js');
      vi.mocked(AllianceService.getAllianceDataWithJsonPriority).mockResolvedValue({
        nations: mockNations,
        aidOffers: [],
        useJsonData: true,
      });

      const result = await AidService.getCategorizedNations(123);

      // Should only return the active nation
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        rulerName: 'Active Ruler',
        nationName: 'Active Nation',
        technology: undefined,
        infrastructure: undefined,
        slots: { sendCash: 2, sendTech: 0, getCash: 0, getTech: 4 },
      });

      // Peace mode nation should not be included
      expect(result.find(n => n.id === 2)).toBeUndefined();
    });
  });
});
