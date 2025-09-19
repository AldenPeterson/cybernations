import { Router } from 'express';
import * as path from 'path';
import { extractAllZipFiles } from '../utils/zipExtractor.js';
import { 
  loadDataFromFiles, 
  groupNationsByAlliance, 
  getAidSlotsForAlliance,
  Alliance,
  NationAidSlots 
} from '../utils/dataParser.js';

export const apiRoutes = Router();

// Example API routes
apiRoutes.get('/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ]);
});

apiRoutes.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    id: parseInt(id),
    name: 'John Doe',
    email: 'john@example.com'
  });
});

apiRoutes.post('/users', (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  res.status(201).json({
    id: Math.floor(Math.random() * 1000),
    name,
    email,
    createdAt: new Date().toISOString()
  });
});

// Example protected route
apiRoutes.get('/protected', (req, res) => {
  // In a real app, you'd check authentication here
  res.json({ message: 'This is a protected route', user: 'authenticated' });
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
apiRoutes.get('/alliances', (req, res) => {
  try {
    const { nations } = loadDataFromFiles();
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

apiRoutes.get('/alliances/:allianceId/aid-slots', (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const { nations, aidOffers } = loadDataFromFiles();
    const aidSlots = getAidSlotsForAlliance(allianceId, nations, aidOffers);
    
    res.json({
      success: true,
      allianceId,
      aidSlots: aidSlots.map(nationAidSlots => ({
        nation: {
          id: nationAidSlots.nation.id,
          rulerName: nationAidSlots.nation.rulerName,
          nationName: nationAidSlots.nation.nationName,
          strength: nationAidSlots.nation.strength,
          activity: nationAidSlots.nation.activity
        },
        aidSlots: nationAidSlots.aidSlots.map(slot => ({
          slotNumber: slot.slotNumber,
          isOutgoing: slot.isOutgoing,
          aidOffer: slot.aidOffer ? {
            aidId: slot.aidOffer.aidId,
            targetNation: slot.isOutgoing ? slot.aidOffer.receivingNation : slot.aidOffer.declaringNation,
            targetRuler: slot.isOutgoing ? slot.aidOffer.receivingRuler : slot.aidOffer.declaringRuler,
            targetId: slot.isOutgoing ? slot.aidOffer.receivingId : slot.aidOffer.declaringId,
            declaringId: slot.aidOffer.declaringId,
            receivingId: slot.aidOffer.receivingId,
            money: slot.aidOffer.money,
            technology: slot.aidOffer.technology,
            soldiers: slot.aidOffer.soldiers,
            reason: slot.aidOffer.reason,
            date: slot.aidOffer.date
          } : null
        }))
      }))
    });
  } catch (error) {
    console.error('Error fetching aid slots:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

apiRoutes.get('/alliances/:allianceId/stats', (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const { nations, aidOffers } = loadDataFromFiles();
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

apiRoutes.get('/alliances/:allianceId/alliance-aid-stats', (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const { nations, aidOffers } = loadDataFromFiles();
    const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    
    if (allianceNations.length === 0) {
      return res.json({
        success: true,
        allianceId,
        allianceAidStats: []
      });
    }

    // Get all aid offers involving this alliance (exclude only expired offers)
    const allianceAidOffers = aidOffers.filter(offer => 
      (offer.declaringAllianceId === allianceId || offer.receivingAllianceId === allianceId) && 
      offer.status !== 'Expired'
    );

    // Group by alliance pairs
    const allianceStatsMap = new Map<string, {
      allianceId: number;
      allianceName: string;
      outgoingAid: number;
      incomingAid: number;
      outgoingMoney: number;
      incomingMoney: number;
      outgoingTech: number;
      incomingTech: number;
      outgoingSoldiers: number;
      incomingSoldiers: number;
    }>();

    allianceAidOffers.forEach(offer => {
      const otherAllianceId = offer.declaringAllianceId === allianceId 
        ? offer.receivingAllianceId 
        : offer.declaringAllianceId;
      const otherAllianceName = offer.declaringAllianceId === allianceId 
        ? offer.receivingAlliance 
        : offer.declaringAlliance;
      
      const key = `${otherAllianceId}-${otherAllianceName}`;
      
      if (!allianceStatsMap.has(key)) {
        allianceStatsMap.set(key, {
          allianceId: otherAllianceId,
          allianceName: otherAllianceName,
          outgoingAid: 0,
          incomingAid: 0,
          outgoingMoney: 0,
          incomingMoney: 0,
          outgoingTech: 0,
          incomingTech: 0,
          outgoingSoldiers: 0,
          incomingSoldiers: 0
        });
      }

      const stats = allianceStatsMap.get(key)!;
      
      if (offer.declaringAllianceId === allianceId) {
        // This alliance is sending aid
        stats.outgoingAid++;
        stats.outgoingMoney += offer.money;
        stats.outgoingTech += offer.technology;
        stats.outgoingSoldiers += offer.soldiers;
      } else {
        // This alliance is receiving aid
        stats.incomingAid++;
        stats.incomingMoney += offer.money;
        stats.incomingTech += offer.technology;
        stats.incomingSoldiers += offer.soldiers;
      }
    });

    const allianceAidStats = Array.from(allianceStatsMap.values())
      .sort((a, b) => (b.outgoingAid + b.incomingAid) - (a.outgoingAid + a.incomingAid));

    res.json({
      success: true,
      allianceId,
      allianceAidStats
    });
  } catch (error) {
    console.error('Error fetching alliance aid stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

apiRoutes.get('/alliances/:allianceId/recommendations', (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const { nations, aidOffers } = loadDataFromFiles();
    const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    
    if (allianceNations.length === 0) {
      return res.json({
        success: true,
        allianceId,
        recommendations: []
      });
    }

    // Categorize nations
    const categorizedNations = allianceNations.map(nation => {
      let category = 'bank';
      const tech = parseFloat(nation.technology.replace(/,/g, '')) || 0;
      const infra = parseFloat(nation.infrastructure.replace(/,/g, '')) || 0;
      
      if (tech < 500 && infra > 3000) {
        category = 'farm';
      } else if (infra < 3000) {
        category = 'cash_recipient';
      }
      
      // Debug logging
      console.log(`Nation: ${nation.nationName}, Tech: ${nation.technology} (${tech}), Infra: ${nation.infrastructure} (${infra}), Category: ${category}`);
      
      return {
        ...nation,
        category
      };
    });

    // Get existing aid offers (exclude expired)
    const existingOffers = aidOffers.filter(offer => 
      offer.status !== 'Expired' && 
      (offer.declaringAllianceId === allianceId || offer.receivingAllianceId === allianceId)
    );

    // Get expired aid offers for prioritization
    const expiredOffers = aidOffers.filter(offer => 
      offer.status === 'Expired' && 
      (offer.declaringAllianceId === allianceId || offer.receivingAllianceId === allianceId)
    );

    // Create a set of existing aid pairs to avoid duplicates
    const existingPairs = new Set();
    existingOffers.forEach(offer => {
      const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
      existingPairs.add(pair);
    });

    // Create a set of expired aid pairs for prioritization
    const expiredPairs = new Set();
    expiredOffers.forEach(offer => {
      const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
      expiredPairs.add(pair);
    });

    // Count active aid offers per nation (both incoming and outgoing)
    const nationAidCounts = new Map<number, number>();
    existingOffers.forEach(offer => {
      // Count outgoing aid
      if (offer.declaringAllianceId === allianceId) {
        const count = nationAidCounts.get(offer.declaringId) || 0;
        nationAidCounts.set(offer.declaringId, count + 1);
      }
      // Count incoming aid
      if (offer.receivingAllianceId === allianceId) {
        const count = nationAidCounts.get(offer.receivingId) || 0;
        nationAidCounts.set(offer.receivingId, count + 1);
      }
    });

    const recommendations: any[] = [];
    const recommendationCounts = new Map<number, number>();

    // Priority 0: Re-establish expired offers that match current categorization
    const cashRecipients = categorizedNations.filter(n => n.category === 'cash_recipient');
    const banks = categorizedNations.filter(n => n.category === 'bank');
    const farms = categorizedNations.filter(n => n.category === 'farm');

    // Find expired cash offers (banks sending to cash recipients)
    expiredOffers.forEach(offer => {
      if (offer.declaringAllianceId === allianceId) {
        const sender = categorizedNations.find(n => n.id === offer.declaringId);
        const recipient = categorizedNations.find(n => n.id === offer.receivingId);
        
        if (sender && recipient && 
            sender.category === 'bank' && recipient.category === 'cash_recipient' &&
            offer.money > 0) {
          
          const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
          const senderAidCount = nationAidCounts.get(offer.declaringId) || 0;
          const recipientAidCount = nationAidCounts.get(offer.receivingId) || 0;
          const senderRecommendationCount = recommendationCounts.get(offer.declaringId) || 0;
          const recipientRecommendationCount = recommendationCounts.get(offer.receivingId) || 0;
          
          if (!existingPairs.has(pair) && 
              senderAidCount + senderRecommendationCount < 6 && 
              recipientAidCount + recipientRecommendationCount < 6) {
            
            recommendations.push({
              sender: {
                id: sender.id,
                nationName: sender.nationName,
                rulerName: sender.rulerName,
                category: sender.category,
                strength: sender.strength
              },
              recipient: {
                id: recipient.id,
                nationName: recipient.nationName,
                rulerName: recipient.rulerName,
                category: recipient.category,
                strength: recipient.strength
              },
              aidType: 'cash',
              priority: 0,
              reason: 'Re-establish expired cash aid (bank to cash recipient)'
            });
            
            // Update recommendation counts
            recommendationCounts.set(sender.id, senderRecommendationCount + 1);
            recommendationCounts.set(recipient.id, recipientRecommendationCount + 1);
          }
        }
      }
    });

    // Find expired tech offers (farms sending to banks)
    expiredOffers.forEach(offer => {
      if (offer.declaringAllianceId === allianceId) {
        const sender = categorizedNations.find(n => n.id === offer.declaringId);
        const recipient = categorizedNations.find(n => n.id === offer.receivingId);
        
        if (sender && recipient && 
            sender.category === 'farm' && recipient.category === 'bank' &&
            offer.technology > 0) {
          
          const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
          const senderAidCount = nationAidCounts.get(offer.declaringId) || 0;
          const recipientAidCount = nationAidCounts.get(offer.receivingId) || 0;
          const senderRecommendationCount = recommendationCounts.get(offer.declaringId) || 0;
          const recipientRecommendationCount = recommendationCounts.get(offer.receivingId) || 0;
          
          if (!existingPairs.has(pair) && 
              senderAidCount + senderRecommendationCount < 6 && 
              recipientAidCount + recipientRecommendationCount < 6) {
            
            recommendations.push({
              sender: {
                id: sender.id,
                nationName: sender.nationName,
                rulerName: sender.rulerName,
                category: sender.category,
                strength: sender.strength
              },
              recipient: {
                id: recipient.id,
                nationName: recipient.nationName,
                rulerName: recipient.rulerName,
                category: recipient.category,
                strength: recipient.strength
              },
              aidType: 'tech',
              priority: 0,
              reason: 'Re-establish expired tech aid (farm to bank)'
            });
            
            // Update recommendation counts
            recommendationCounts.set(sender.id, senderRecommendationCount + 1);
            recommendationCounts.set(recipient.id, recipientRecommendationCount + 1);
          }
        }
      }
    });

    // Priority 1: New cash aid (cash recipients from banks)
    cashRecipients.forEach(recipient => {
      banks.forEach(sender => {
        if (sender.id !== recipient.id) {
          const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
          const senderAidCount = nationAidCounts.get(sender.id) || 0;
          const recipientAidCount = nationAidCounts.get(recipient.id) || 0;
          const senderRecommendationCount = recommendationCounts.get(sender.id) || 0;
          const recipientRecommendationCount = recommendationCounts.get(recipient.id) || 0;
          
          if (!existingPairs.has(pair) && 
              senderAidCount + senderRecommendationCount < 6 && 
              recipientAidCount + recipientRecommendationCount < 6) {
            
            recommendations.push({
              sender: {
                id: sender.id,
                nationName: sender.nationName,
                rulerName: sender.rulerName,
                category: sender.category,
                strength: sender.strength
              },
              recipient: {
                id: recipient.id,
                nationName: recipient.nationName,
                rulerName: recipient.rulerName,
                category: recipient.category,
                strength: recipient.strength
              },
              aidType: 'cash',
              priority: 1,
              reason: 'Cash recipient needs cash from bank'
            });
            
            // Update recommendation counts
            recommendationCounts.set(sender.id, senderRecommendationCount + 1);
            recommendationCounts.set(recipient.id, recipientRecommendationCount + 1);
          }
        }
      });
    });

    // Priority 2: New tech aid (banks from farms)
    banks.forEach(recipient => {
      farms.forEach(sender => {
        if (sender.id !== recipient.id) {
          const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
          const senderAidCount = nationAidCounts.get(sender.id) || 0;
          const recipientAidCount = nationAidCounts.get(recipient.id) || 0;
          const senderRecommendationCount = recommendationCounts.get(sender.id) || 0;
          const recipientRecommendationCount = recommendationCounts.get(recipient.id) || 0;
          
          if (!existingPairs.has(pair) && 
              senderAidCount + senderRecommendationCount < 6 && 
              recipientAidCount + recipientRecommendationCount < 6) {
            
            recommendations.push({
              sender: {
                id: sender.id,
                nationName: sender.nationName,
                rulerName: sender.rulerName,
                category: sender.category,
                strength: sender.strength
              },
              recipient: {
                id: recipient.id,
                nationName: recipient.nationName,
                rulerName: recipient.rulerName,
                category: recipient.category,
                strength: recipient.strength
              },
              aidType: 'tech',
              priority: 2,
              reason: 'Bank needs tech from farm'
            });
            
            // Update recommendation counts
            recommendationCounts.set(sender.id, senderRecommendationCount + 1);
            recommendationCounts.set(recipient.id, recipientRecommendationCount + 1);
          }
        }
      });
    });

    // Sort by priority (cash recipients first), then by strength difference
    recommendations.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Within same priority, sort by strength difference (higher difference first)
      const aDiff = Math.abs(a.sender.strength - a.recipient.strength);
      const bDiff = Math.abs(b.sender.strength - b.recipient.strength);
      return bDiff - aDiff;
    });

    res.json({
      success: true,
      allianceId,
      recommendations: recommendations.slice(0, 50), // Limit to top 50 recommendations
      nationCategories: {
        farms: farms.length,
        cashRecipients: cashRecipients.length,
        banks: banks.length
      }
    });
  } catch (error) {
    console.error('Error fetching aid recommendations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get small aid offers for all alliances
apiRoutes.get('/small-aid-offers', (req, res) => {
  try {
    const { nations, aidOffers } = loadDataFromFiles();
    
    // Filter for small aid offers (less than 6M money and less than 100 tech)
    const smallAidOffers = aidOffers.filter(offer => 
      offer.money < 6000000 && 
      offer.technology < 100 && 
      offer.status !== 'Expired'
    );

    // Add alliance information to each offer
    const offersWithAllianceInfo = smallAidOffers.map(offer => {
      const declaringNation = nations.find(n => n.id === offer.declaringId);
      const receivingNation = nations.find(n => n.id === offer.receivingId);
      
      return {
        aidId: offer.aidId,
        declaringNation: {
          id: offer.declaringId,
          name: offer.declaringNation,
          ruler: offer.declaringRuler,
          alliance: offer.declaringAlliance,
          allianceId: offer.declaringAllianceId
        },
        receivingNation: {
          id: offer.receivingId,
          name: offer.receivingNation,
          ruler: offer.receivingRuler,
          alliance: offer.receivingAlliance,
          allianceId: offer.receivingAllianceId
        },
        money: offer.money,
        technology: offer.technology,
        soldiers: offer.soldiers,
        reason: offer.reason,
        date: offer.date
      };
    });

    // Sort by date (most recent first)
    offersWithAllianceInfo.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      success: true,
      smallAidOffers: offersWithAllianceInfo,
      totalCount: offersWithAllianceInfo.length
    });
  } catch (error) {
    console.error('Error fetching small aid offers:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
