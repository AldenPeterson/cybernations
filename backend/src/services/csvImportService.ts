import 'dotenv/config';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../utils/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Import nations from CSV file and upsert into database
 */
export async function importNationsFromCsv(filePath: string): Promise<{ imported: number; updated: number }> {
  const nations: any[] = [];
  let currentRank = 1;

  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(csv({
        separator: '|',
        headers: ['id', 'rulerName', 'nationName', 'alliance', 'allianceId', 'allianceDate', 'allianceStatus', 'governmentType', 'religion', 'team', 'created', 'technology', 'infrastructure', 'baseLand', 'warStatus', 'resource1', 'resource2', 'votes', 'strength', 'defcon', 'baseSoldiers', 'tanks', 'cruise', 'nukes', 'activity', 'connectedResource1', 'connectedResource2', 'connectedResource3', 'connectedResource4', 'connectedResource5', 'connectedResource6', 'connectedResource7', 'connectedResource8', 'connectedResource9', 'connectedResource10', 'attackingCasualties', 'defensiveCasualties']
      }))
      .on('data', (row) => {
        if (row.id && row.rulerName) {
          const id = parseInt(row.id);
          const allianceId = parseInt(row.allianceId) || 0;
          const strength = parseFloat(row.strength?.replace(/,/g, '') || '0');
          const attackingCasualties = row.attackingCasualties ? parseInt(row.attackingCasualties) : null;
          const defensiveCasualties = row.defensiveCasualties ? parseInt(row.defensiveCasualties) : null;
          
          // Skip if ID is invalid
          if (isNaN(id)) {
            return;
          }
          
          nations.push({
            id,
            rulerName: decodeHtmlEntities(row.rulerName),
            nationName: decodeHtmlEntities(row.nationName),
            alliance: decodeHtmlEntities(row.alliance || ''),
            allianceId,
            team: row.team || '',
            rank: currentRank++,
            strength: isNaN(strength) ? 0 : strength,
            activity: row.activity || '',
            technology: row.technology || '0',
            infrastructure: row.infrastructure || '0',
            land: row.baseLand || '0',
            nuclearWeapons: parseInt(row.nukes) || 0,
            governmentType: row.governmentType || '',
            inWarMode: row.warStatus === 'War Mode',
            attackingCasualties: (attackingCasualties && !isNaN(attackingCasualties)) ? attackingCasualties : null,
            defensiveCasualties: (defensiveCasualties && !isNaN(defensiveCasualties)) ? defensiveCasualties : null,
          });
        }
      })
      .on('end', async () => {
        console.log(`Parsed ${nations.length} nations from CSV`);
        
        // First, create/update alliances
        const allianceMap = new Map<number, string>();
        
        // Always ensure allianceId = 0 exists for nations without alliance
        allianceMap.set(0, 'No Alliance');
        
        for (const nation of nations) {
          if (nation.allianceId !== undefined && nation.allianceId !== null && nation.allianceId > 0) {
            if (nation.alliance && nation.alliance.trim() !== '') {
              allianceMap.set(nation.allianceId, nation.alliance);
            }
          }
        }

        console.log(`Creating/updating ${allianceMap.size} alliances...`);
        for (const [allianceId, allianceName] of allianceMap.entries()) {
          await prisma.alliance.upsert({
            where: { id: allianceId },
            update: { name: allianceName },
            create: { id: allianceId, name: allianceName },
          });
        }

        // Then, upsert nations using batch operations
        console.log('Preparing nations for batch upsert...');
        
        // Prepare nations data and filter invalid ones
        const validNations: any[] = [];
        const nationIds = new Set<number>();
        
        for (const nation of nations) {
          // Set allianceId to 0 if it's missing or invalid (represents no alliance)
          const finalAllianceId = (nation.allianceId && nation.allianceId > 0) ? nation.allianceId : 0;
          
          // Ensure alliance exists (should exist since we created it above)
          const allianceExists = allianceMap.has(finalAllianceId);
          if (!allianceExists && finalAllianceId !== 0) {
            console.warn(`Skipping nation ${nation.id}: alliance ${finalAllianceId} not found`);
            continue;
          }
          
          // Remove alliance field (it's a relation, not a direct field)
          const { alliance, ...nationData } = nation;
          
          // Update allianceId to final value (0 for no alliance)
          nationData.allianceId = finalAllianceId;
          
          validNations.push(nationData);
          nationIds.add(nation.id);
        }
        
        console.log(`Processing ${validNations.length} valid nations...`);
        
        // Fetch existing nation IDs in one batch query
        const existingNationIds = new Set(
          (await prisma.nation.findMany({
            where: { id: { in: Array.from(nationIds) } },
            select: { id: true }
          })).map(n => n.id)
        );
        
        // Split into new and existing nations
        const newNations = validNations.filter(n => !existingNationIds.has(n.id));
        const existingNations = validNations.filter(n => existingNationIds.has(n.id));
        
        console.log(`Found ${newNations.length} new nations and ${existingNations.length} existing nations`);
        
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        
        // Batch create new nations
        if (newNations.length > 0) {
          try {
            // Use createMany for batch insert (much faster)
            const batchSize = 1000; // Process in batches to avoid query size limits
            for (let i = 0; i < newNations.length; i += batchSize) {
              const batch = newNations.slice(i, i + batchSize);
              await prisma.nation.createMany({
                data: batch,
                skipDuplicates: true
              });
            }
            imported = newNations.length;
            console.log(`Batch created ${imported} new nations`);
          } catch (error: any) {
            console.warn(`Error batch creating nations: ${error.message}`);
            skipped += newNations.length;
          }
        }
        
        // Batch update existing nations using parallel updates
        // Using individual updates instead of transactions to avoid timeout issues
        // Each update is atomic, so this is safe
        if (existingNations.length > 0) {
          try {
            // Process updates in parallel batches for better performance
            const batchSize = 100; // Process in batches to avoid overwhelming the connection pool
            const updatePromises: Promise<any>[] = [];
            
            for (let i = 0; i < existingNations.length; i += batchSize) {
              const batch = existingNations.slice(i, i + batchSize);
              
              // Process each update in parallel (each update is atomic)
              const batchPromises = batch.map(nation =>
                prisma.nation.update({
                  where: { id: nation.id },
                  data: {
                    rulerName: nation.rulerName,
                    nationName: nation.nationName,
                    allianceId: nation.allianceId,
                    team: nation.team,
                    strength: nation.strength,
                    activity: nation.activity,
                    technology: nation.technology,
                    infrastructure: nation.infrastructure,
                    land: nation.land,
                    nuclearWeapons: nation.nuclearWeapons,
                    governmentType: nation.governmentType,
                    inWarMode: nation.inWarMode,
                    attackingCasualties: nation.attackingCasualties,
                    defensiveCasualties: nation.defensiveCasualties,
                    rank: nation.rank,
                  }
                }).catch((error: any) => {
                  console.warn(`Error updating nation ${nation.id}: ${error.message}`);
                  return null; // Continue processing other updates
                })
              );
              
              updatePromises.push(...batchPromises);
            }
            
            // Wait for all updates to complete
            const results = await Promise.all(updatePromises);
            updated = results.filter(r => r !== null).length;
            skipped = existingNations.length - updated;
            console.log(`Batch updated ${updated} existing nations`);
          } catch (error: any) {
            console.warn(`Error batch updating nations: ${error.message}`);
            skipped += existingNations.length;
          }
        }
        
        if (skipped > 0) {
          console.log(`Skipped ${skipped} nations due to errors`);
        }

        console.log(`Successfully imported ${imported} new nations and updated ${updated} existing nations`);
        resolve({ imported, updated });
      })
      .on('error', reject);
  });
}

/**
 * Import aid offers from CSV file and upsert into database
 */
export async function importAidOffersFromCsv(filePath: string): Promise<{ imported: number; updated: number }> {
  const aidOffers: any[] = [];

  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(csv({
        separator: '|',
        headers: ['declaringId', 'declaringRuler', 'declaringNation', 'declaringAlliance', 'declaringAllianceId', 'declaringTeam', 'receivingId', 'receivingRuler', 'receivingNation', 'receivingAlliance', 'receivingAllianceId', 'receivingTeam', 'status', 'money', 'technology', 'soldiers', 'date', 'reason', 'aidId']
      }))
      .on('data', (row) => {
        if (row.aidId && row.declaringId && row.receivingId) {
          const aidId = parseInt(row.aidId);
          const declaringId = parseInt(row.declaringId);
          const receivingId = parseInt(row.receivingId);
          
          // Skip if any ID is invalid
          if (isNaN(aidId) || isNaN(declaringId) || isNaN(receivingId)) {
            return;
          }
          
          aidOffers.push({
            aidId,
            declaringNationId: declaringId,
            receivingNationId: receivingId,
            status: row.status || '',
            money: parseFloat(row.money?.replace(/,/g, '') || '0') || 0,
            technology: parseFloat(row.technology?.replace(/,/g, '') || '0') || 0,
            soldiers: parseInt(row.soldiers) || 0,
            date: row.date || '',
            reason: row.reason || '',
          });
        }
      })
      .on('end', async () => {
        console.log(`Parsed ${aidOffers.length} aid offers from CSV`);
        console.log('Preparing aid offers for batch upsert...');
        
        const now = new Date();
        
        // Step 1: Mark all existing aid offers as inactive BEFORE processing new data
        console.log('Marking existing aid offers as inactive...');
        await prisma.aidOffer.updateMany({
          data: { isActive: false }
        });
        
        // Step 2: Batch verify nations exist
        const nationIds = new Set<number>();
        for (const offer of aidOffers) {
          nationIds.add(offer.declaringNationId);
          nationIds.add(offer.receivingNationId);
        }
        
        const existingNationIds = new Set(
          (await prisma.nation.findMany({
            where: { id: { in: Array.from(nationIds) } },
            select: { id: true }
          })).map(n => n.id)
        );
        
        // Filter valid aid offers (both nations must exist)
        const validOffers = aidOffers.filter(offer =>
          existingNationIds.has(offer.declaringNationId) &&
          existingNationIds.has(offer.receivingNationId)
        );
        
        console.log(`Processing ${validOffers.length} valid aid offers (skipped ${aidOffers.length - validOffers.length} with invalid nations)...`);
        
        // Step 3: Fetch existing aid offer IDs and versions in one batch query
        const aidOfferIds = validOffers.map(o => o.aidId);
        const existingAidOffers = await prisma.aidOffer.findMany({
          where: { aidId: { in: aidOfferIds } },
          select: { aidId: true, version: true }
        });
        const existingAidOfferMap = new Map(
          existingAidOffers.map(a => [a.aidId, a.version])
        );
        
        // Split into new and existing
        const newOffers = validOffers.filter(o => !existingAidOfferMap.has(o.aidId));
        const existingOffers = validOffers.filter(o => existingAidOfferMap.has(o.aidId));
        
        console.log(`Found ${newOffers.length} new aid offers and ${existingOffers.length} existing aid offers`);
        
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        
        // Step 4: Batch create new aid offers
        if (newOffers.length > 0) {
          try {
            const batchSize = 1000;
            for (let i = 0; i < newOffers.length; i += batchSize) {
              const batch = newOffers.slice(i, i + batchSize).map(offer => ({
                ...offer,
                firstSeenAt: now,
                lastSeenAt: now,
                isActive: true,
                version: 1
              }));
              await prisma.aidOffer.createMany({
                data: batch,
                skipDuplicates: true
              });
            }
            imported = newOffers.length;
            console.log(`Batch created ${imported} new aid offers`);
          } catch (error: any) {
            console.warn(`Error batch creating aid offers: ${error.message}`);
            skipped += newOffers.length;
          }
        }
        
        // Step 5: Batch update existing aid offers using parallel updates
        if (existingOffers.length > 0) {
          try {
            const batchSize = 100;
            const updatePromises: Promise<any>[] = [];
            
            for (let i = 0; i < existingOffers.length; i += batchSize) {
              const batch = existingOffers.slice(i, i + batchSize);
              
              // Process each update in parallel (each update is atomic)
              const batchPromises = batch.map(offer => {
                const currentVersion = existingAidOfferMap.get(offer.aidId) || 1;
                return prisma.aidOffer.update({
                  where: { aidId: offer.aidId },
                  data: {
                    ...offer,
                    lastSeenAt: now,
                    isActive: true,
                    version: currentVersion + 1
                  }
                }).catch((error: any) => {
                  console.warn(`Error updating aid offer ${offer.aidId}: ${error.message}`);
                  return null;
                });
              });
              
              updatePromises.push(...batchPromises);
            }
            
            const results = await Promise.all(updatePromises);
            updated = results.filter(r => r !== null).length;
            skipped = existingOffers.length - updated;
            console.log(`Batch updated ${updated} existing aid offers`);
          } catch (error: any) {
            console.warn(`Error batch updating aid offers: ${error.message}`);
            skipped += existingOffers.length;
          }
        }
        
        if (skipped > 0) {
          console.log(`Skipped ${skipped} aid offers due to errors`);
        }

        console.log(`Successfully imported ${imported} new aid offers and updated ${updated} existing aid offers`);
        resolve({ imported, updated });
      })
      .on('error', reject);
  });
}

/**
 * Import wars from CSV file and upsert into database
 */
export async function importWarsFromCsv(filePath: string): Promise<{ imported: number; updated: number }> {
  const wars: any[] = [];

  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(csv({
        separator: '|',
        headers: ['declaringId', 'declaringRuler', 'declaringNation', 'declaringAlliance', 'declaringAllianceId', 'declaringTeam', 'receivingId', 'receivingRuler', 'receivingNation', 'receivingAlliance', 'receivingAllianceId', 'receivingTeam', 'warStatus', 'beginDate', 'endDate', 'reason', 'warId', 'destruction', 'attackPercent', 'defendPercent']
      }))
      .on('data', (row) => {
        if (row.warId && row.declaringId && row.receivingId) {
          const warId = parseInt(row.warId);
          const declaringId = parseInt(row.declaringId);
          const receivingId = parseInt(row.receivingId);
          
          // Skip if any ID is invalid
          if (isNaN(warId) || isNaN(declaringId) || isNaN(receivingId)) {
            return;
          }
          
          wars.push({
            warId,
            declaringNationId: declaringId,
            receivingNationId: receivingId,
            status: row.warStatus || '',
            date: row.beginDate || '',
            endDate: row.endDate || '',
            reason: row.reason || null,
            destruction: row.destruction || null,
            attackPercent: row.attackPercent ? (isNaN(parseFloat(row.attackPercent)) ? null : parseFloat(row.attackPercent)) : null,
            defendPercent: row.defendPercent ? (isNaN(parseFloat(row.defendPercent)) ? null : parseFloat(row.defendPercent)) : null,
          });
        }
      })
      .on('end', async () => {
        console.log(`Parsed ${wars.length} wars from CSV`);
        console.log('Preparing wars for batch upsert...');
        
        const now = new Date();
        
        // Step 1: Mark all existing wars as inactive BEFORE processing new data
        console.log('Marking existing wars as inactive...');
        await prisma.war.updateMany({
          data: { isActive: false }
        });
        
        // Step 2: Batch verify nations exist
        const nationIds = new Set<number>();
        for (const war of wars) {
          nationIds.add(war.declaringNationId);
          nationIds.add(war.receivingNationId);
        }
        
        const existingNationIds = new Set(
          (await prisma.nation.findMany({
            where: { id: { in: Array.from(nationIds) } },
            select: { id: true }
          })).map(n => n.id)
        );
        
        // Filter valid wars (both nations must exist)
        const validWars = wars.filter(war =>
          existingNationIds.has(war.declaringNationId) &&
          existingNationIds.has(war.receivingNationId)
        );
        
        console.log(`Processing ${validWars.length} valid wars (skipped ${wars.length - validWars.length} with invalid nations)...`);
        
        // Step 3: Fetch existing war IDs and versions in one batch query
        const warIds = validWars.map(w => w.warId);
        const existingWarsData = await prisma.war.findMany({
          where: { warId: { in: warIds } },
          select: { warId: true, version: true }
        });
        const existingWarMap = new Map(
          existingWarsData.map(w => [w.warId, w.version])
        );
        
        // Split into new and existing
        const newWars = validWars.filter(w => !existingWarMap.has(w.warId));
        const existingWars = validWars.filter(w => existingWarMap.has(w.warId));
        
        console.log(`Found ${newWars.length} new wars and ${existingWars.length} existing wars`);
        
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        
        // Step 4: Batch create new wars
        if (newWars.length > 0) {
          try {
            const batchSize = 1000;
            for (let i = 0; i < newWars.length; i += batchSize) {
              const batch = newWars.slice(i, i + batchSize).map(war => ({
                ...war,
                firstSeenAt: now,
                lastSeenAt: now,
                isActive: true,
                version: 1
              }));
              await prisma.war.createMany({
                data: batch,
                skipDuplicates: true
              });
            }
            imported = newWars.length;
            console.log(`Batch created ${imported} new wars`);
          } catch (error: any) {
            console.warn(`Error batch creating wars: ${error.message}`);
            skipped += newWars.length;
          }
        }
        
        // Step 5: Batch update existing wars using parallel updates
        if (existingWars.length > 0) {
          try {
            const batchSize = 100;
            const updatePromises: Promise<any>[] = [];
            
            for (let i = 0; i < existingWars.length; i += batchSize) {
              const batch = existingWars.slice(i, i + batchSize);
              
              // Process each update in parallel (each update is atomic)
              const batchPromises = batch.map(war => {
                const currentVersion = existingWarMap.get(war.warId) || 1;
                return prisma.war.update({
                  where: { warId: war.warId },
                  data: {
                    ...war,
                    lastSeenAt: now,
                    isActive: true,
                    version: currentVersion + 1
                  }
                }).catch((error: any) => {
                  console.warn(`Error updating war ${war.warId}: ${error.message}`);
                  return null;
                });
              });
              
              updatePromises.push(...batchPromises);
            }
            
            const results = await Promise.all(updatePromises);
            updated = results.filter(r => r !== null).length;
            skipped = existingWars.length - updated;
            console.log(`Batch updated ${updated} existing wars`);
          } catch (error: any) {
            console.warn(`Error batch updating wars: ${error.message}`);
            skipped += existingWars.length;
          }
        }
        
        if (skipped > 0) {
          console.log(`Skipped ${skipped} wars due to errors`);
        }

        console.log(`Successfully imported ${imported} new wars and updated ${updated} existing wars`);
        resolve({ imported, updated });
      })
      .on('error', reject);
  });
}

/**
 * Import all CSV files from the data directory
 */
export async function importAllCsvFiles(): Promise<void> {
  const dataPath = path.join(__dirname, '..', 'data');
  
  const nationsFile = path.join(dataPath, 'nations.csv');
  const aidOffersFile = path.join(dataPath, 'aid_offers.csv');
  const warsFile = path.join(dataPath, 'wars.csv');

  const fs = await import('fs');
  
  try {
    if (fs.existsSync(nationsFile)) {
      await importNationsFromCsv(nationsFile);
    }
    if (fs.existsSync(aidOffersFile)) {
      await importAidOffersFromCsv(aidOffersFile);
    }
    if (fs.existsSync(warsFile)) {
      await importWarsFromCsv(warsFile);
    }
    console.log('CSV import completed successfully!');
  } catch (error) {
    console.error('Error during CSV import:', error);
    throw error;
  }
}

