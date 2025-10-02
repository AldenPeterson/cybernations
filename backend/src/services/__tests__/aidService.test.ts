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
          technology: '1000',
          infrastructure: '2000',
          strength: '3000',
          activity: 'Active',
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
          technology: '500',
          infrastructure: '1500',
          strength: '2000',
          activity: 'Active',
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
          technology: '800',
          infrastructure: '1200',
          strength: '2500',
          activity: 'Active',
          slots: { sendCash: 0, sendTech: 0, getCash: 6, getTech: 0 },
          has_dra: false,
        },
      ];

      const mockAidOffers: any[] = [];

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

      // Verify slot counts - peace mode nations can receive but not send
      expect(result.slotCounts?.totalSendCash).toBe(2); // Only from active nation (id: 1), peace mode (id: 2) excluded
      expect(result.slotCounts?.totalGetCash).toBe(6); // From active nation (id: 3) - recipients can receive in peace mode
      expect(result.slotCounts?.totalSendTech).toBe(0);
      expect(result.slotCounts?.totalGetTech).toBe(4); // From active nation (id: 1) - recipients can receive in peace mode

      // Verify that the categorization functions were called with all nations (including peace mode)
      expect(getNationsThatShouldSendCash).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, warStatus: 'Active' }),
          expect.objectContaining({ id: 2, warStatus: 'Peace Mode' }),
          expect.objectContaining({ id: 3, warStatus: 'War' }),
        ])
      );
      expect(getNationsThatShouldGetCash).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, warStatus: 'Active' }),
          expect.objectContaining({ id: 2, warStatus: 'Peace Mode' }),
          expect.objectContaining({ id: 3, warStatus: 'War' }),
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
          technology: '500',
          infrastructure: '1500',
          strength: '2000',
          activity: 'Active',
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
          technology: '800',
          infrastructure: '1200',
          strength: '2500',
          activity: 'Active',
          slots: { sendCash: 0, sendTech: 0, getCash: 6, getTech: 0 },
          has_dra: false,
        },
      ];

      const mockAidOffers: any[] = [];

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

      // Send slot counts should be 0 since all nations are in peace mode (can't send)
      // But get slot counts should include all nations since recipients can receive in peace mode
      expect(result.slotCounts?.totalSendCash).toBe(0);
      expect(result.slotCounts?.totalGetCash).toBe(6); // Peace mode nations can receive
      expect(result.slotCounts?.totalSendTech).toBe(0);
      expect(result.slotCounts?.totalGetTech).toBe(4); // Peace mode nations can receive
      expect(result.slotCounts?.totalUnassigned).toBe(0);

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
