import { Router } from 'express';
import * as path from 'path';
import { extractAllZipFiles } from '../utils/zipExtractor.js';
import { 
  loadDataFromFiles, 
  loadDataFromFilesWithUpdate,
  groupNationsByAlliance, 
  Alliance
} from '../utils/dataParser.js';
import { aidRoutes } from './aidRoutes.js';
import { syncAllianceFilesWithNewData } from '../utils/allianceSync.js';

export const apiRoutes = Router();

// Use aid routes
apiRoutes.use('/', aidRoutes);

// Example API routes
apiRoutes.get('/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ]);
});


// Stats decode endpoint - extract zip files from raw_data folder
apiRoutes.post('/stats/decode', async (req, res) => {
  try {
    const rawDataPath = path.join(process.cwd(), 'src', 'raw_data');
    
    console.log(`Starting zip extraction from: ${rawDataPath}`);
    
    const result = await extractAllZipFiles(rawDataPath);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        results: result.results
      });
    }

    // Count successful extractions
    const successfulExtractions = result.results.filter(r => r.extractionResult.success).length;
    const totalFiles = result.results.length;

    res.json({
      success: true,
      message: `Successfully extracted ${successfulExtractions}/${totalFiles} zip files`,
      totalZipFiles: totalFiles,
      successfulExtractions,
      results: result.results.map(r => ({
        zipFile: r.zipFile,
        success: r.extractionResult.success,
        extractedFiles: r.extractionResult.extractedFiles,
        error: r.extractionResult.error
      }))
    });
  } catch (error) {
    console.error('Error in /api/stats/decode:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Dashboard API endpoints
apiRoutes.get('/alliances', async (req, res) => {
  try {
    const { nations } = await loadDataFromFilesWithUpdate();
    const alliances = groupNationsByAlliance(nations);
    
    res.json({
      success: true,
      alliances: alliances.map(alliance => ({
        id: alliance.id,
        name: alliance.name,
        nationCount: alliance.nations.length
      }))
    });
  } catch (error) {
    console.error('Error fetching alliances:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


apiRoutes.get('/alliances/:allianceId/stats', async (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const { nations, aidOffers } = await loadDataFromFilesWithUpdate();
    const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    const allianceAidOffers = aidOffers.filter(offer => 
      (offer.declaringAllianceId === allianceId || offer.receivingAllianceId === allianceId) && 
      offer.status !== 'Expired'
    );

    const outgoingOffers = allianceAidOffers.filter(offer => offer.declaringAllianceId === allianceId);
    const incomingOffers = allianceAidOffers.filter(offer => offer.receivingAllianceId === allianceId);

    res.json({
      success: true,
      allianceId,
      stats: {
        totalNations: allianceNations.length,
        totalOutgoingAid: outgoingOffers.length,
        totalIncomingAid: incomingOffers.length,
        totalMoneyOut: outgoingOffers.reduce((sum, offer) => sum + offer.money, 0),
        totalMoneyIn: incomingOffers.reduce((sum, offer) => sum + offer.money, 0),
        totalTechOut: outgoingOffers.reduce((sum, offer) => sum + offer.technology, 0),
        totalTechIn: incomingOffers.reduce((sum, offer) => sum + offer.technology, 0),
        totalSoldiersOut: outgoingOffers.reduce((sum, offer) => sum + offer.soldiers, 0),
        totalSoldiersIn: incomingOffers.reduce((sum, offer) => sum + offer.soldiers, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching alliance stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manual sync endpoint for alliance files
apiRoutes.post('/sync/alliances', async (req, res) => {
  try {
    console.log('Manual alliance sync requested');
    
    // Get the latest nation data
    const { nations } = await loadDataFromFilesWithUpdate();
    
    if (nations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No nation data available for sync'
      });
    }
    
    // Sync alliance files
    await syncAllianceFilesWithNewData(nations);
    
    res.json({
      success: true,
      message: 'Alliance files synchronized successfully',
      nationsProcessed: nations.length
    });
  } catch (error) {
    console.error('Error syncing alliance files:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});



