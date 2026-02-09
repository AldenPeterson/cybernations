import 'dotenv/config';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../utils/prisma.js';
import { invalidateDataCache } from './dataProcessingService.js';

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

        // Step 1: Mark all existing nations as inactive BEFORE processing new data
        // This marks nations as not present in the current file. Nations that appear in the
        // current file will be reactivated below. A nation is "inactive" if it's not in the file,
        // regardless of the nation's activity status field.
        console.log('Marking existing nations as inactive...');
        await prisma.nation.updateMany({
          data: { isActive: false } as any
        });

        // Then, upsert nations using batch operations
        console.log('Preparing nations for batch upsert...');
        
        const now = new Date();
        
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
        
        // Fetch existing nation IDs and allianceIds in one batch query for comparison
        const existingNationsData = await prisma.nation.findMany({
          where: { id: { in: Array.from(nationIds) } },
          select: { id: true, allianceId: true }
        });
        
        const existingNationIds = new Set(existingNationsData.map((n: { id: number }) => n.id));
        const existingAllianceMap = new Map(
          existingNationsData.map((n: { id: number; allianceId: number }) => [n.id, n.allianceId])
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
              const batch = newNations.slice(i, i + batchSize).map(nation => ({
                ...nation,
                firstSeenAt: now,
                lastSeenAt: now,
                isActive: true,
              }));
              await prisma.nation.createMany({
                data: batch,
                skipDuplicates: true
              });
            }
            imported = newNations.length;
            console.log(`Batch created ${imported} new nations`);
            
            // Process events for new nations (> 1000 NS)
            // Batch verify which nations were actually created (createMany with skipDuplicates may skip some)
            if (newNations.length > 0) {
              const newNationIds = newNations.map(n => n.id);
              const actuallyCreatedNations = await prisma.nation.findMany({
                where: { id: { in: newNationIds } },
                select: { id: true },
              });
              const actuallyCreatedIds = new Set(actuallyCreatedNations.map(n => n.id));
              
              // Process events in parallel batches
              const { detectNewNationEvent } = await import('./eventService.js');
              const eventPromises = newNations
                .filter(n => actuallyCreatedIds.has(n.id))
                .map(nation => detectNewNationEvent(nation.id, nation.strength));
              
              // Process in batches to avoid overwhelming the connection pool
              const eventBatchSize = 50;
              for (let i = 0; i < eventPromises.length; i += eventBatchSize) {
                await Promise.all(eventPromises.slice(i, i + eventBatchSize));
              }
            }
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
              const batchPromises = batch.map(async nation => {
                const oldAllianceId = existingAllianceMap.get(nation.id);
                const newAllianceId = nation.allianceId;
                
                const updateResult = await prisma.nation.update({
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
                    lastSeenAt: now,
                    isActive: true,
                  }
                }).catch((error: any) => {
                  console.warn(`Error updating nation ${nation.id}: ${error.message}`);
                  return { updateResult: null, allianceChanged: null }; // Continue processing other updates
                });
                
                // Track alliance changes for later batch processing (don't process immediately to avoid blocking)
                if (updateResult && oldAllianceId !== undefined && oldAllianceId !== newAllianceId && nation.strength >= 1000) {
                  return { updateResult, allianceChanged: { nationId: nation.id, oldAllianceId, newAllianceId } };
                }
                return { updateResult, allianceChanged: null };
              });
              
              updatePromises.push(...batchPromises);
            }
            
            // Wait for all updates to complete
            const results = await Promise.all(updatePromises);
            updated = results.filter(r => r !== null && r.updateResult !== null).length;
            skipped = existingNations.length - updated;
            console.log(`Batch updated ${updated} existing nations`);
            
            // Process alliance change events in batch after all updates complete
            const allianceChanges = results
              .filter((r): r is { updateResult: any; allianceChanged: { nationId: number; oldAllianceId: number; newAllianceId: number } } => 
                r !== null && r.allianceChanged !== null
              )
              .map(r => r.allianceChanged);
            
            if (allianceChanges.length > 0) {
              const { detectAllianceChangeEvent } = await import('./eventService.js');
              // Process in parallel batches
              const batchSize = 50;
              for (let i = 0; i < allianceChanges.length; i += batchSize) {
                const batch = allianceChanges.slice(i, i + batchSize);
                await Promise.all(
                  batch.map(change => detectAllianceChangeEvent(change.nationId, change.oldAllianceId, change.newAllianceId))
                );
              }
            }
          } catch (error: any) {
            console.warn(`Error batch updating nations: ${error.message}`);
            skipped += existingNations.length;
          }
        }
        
        // Process inactive events AFTER reactivating nations in the file
        // At this point, only nations NOT in the current file remain inactive
        console.log('Processing inactive nation events...');
        const { processInactiveNations } = await import('./eventService.js');
        await processInactiveNations();
        
        if (skipped > 0) {
          console.log(`Skipped ${skipped} nations due to errors`);
        }

        console.log(`Successfully imported ${imported} new nations and updated ${updated} existing nations`);
        invalidateDataCache(); // Invalidate cache after data update
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
          const declaringAllianceId = row.declaringAllianceId ? parseInt(row.declaringAllianceId) : null;
          const receivingAllianceId = row.receivingAllianceId ? parseInt(row.receivingAllianceId) : null;
          
          // Skip if any ID is invalid
          if (isNaN(aidId) || isNaN(declaringId) || isNaN(receivingId)) {
            return;
          }
          
          aidOffers.push({
            aidId,
            declaringNationId: declaringId,
            receivingNationId: receivingId,
            declaringAllianceId: declaringAllianceId && !isNaN(declaringAllianceId) ? declaringAllianceId : undefined,
            receivingAllianceId: receivingAllianceId && !isNaN(receivingAllianceId) ? receivingAllianceId : undefined,
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
          data: { isActive: false } as any
        });
        
        // Step 2: Batch verify nations exist and get their alliance IDs
        const nationIds = new Set<number>();
        for (const offer of aidOffers) {
          nationIds.add(offer.declaringNationId);
          nationIds.add(offer.receivingNationId);
        }
        
        const nations = await prisma.nation.findMany({
          where: { id: { in: Array.from(nationIds) } },
          select: { id: true, allianceId: true }
        });
        
        const existingNationIds = new Set(nations.map((n: { id: number }) => n.id));
        const nationAllianceMap = new Map(
          nations.map((n: { id: number; allianceId: number }) => [n.id, n.allianceId])
        );
        
        // Backfill alliance IDs from nations if missing from CSV
        for (const offer of aidOffers) {
          if (!offer.declaringAllianceId && nationAllianceMap.has(offer.declaringNationId)) {
            offer.declaringAllianceId = nationAllianceMap.get(offer.declaringNationId)!;
          }
          if (!offer.receivingAllianceId && nationAllianceMap.has(offer.receivingNationId)) {
            offer.receivingAllianceId = nationAllianceMap.get(offer.receivingNationId)!;
          }
        }
        
        // Filter valid aid offers (both nations must exist)
        const validOffers = aidOffers.filter(offer =>
          existingNationIds.has(offer.declaringNationId) &&
          existingNationIds.has(offer.receivingNationId)
        );
        
        console.log(`Processing ${validOffers.length} valid aid offers (skipped ${aidOffers.length - validOffers.length} with invalid nations)...`);
        
        // Step 3: Fetch existing aid offer IDs to determine new vs existing
        const aidOfferIds = validOffers.map(o => o.aidId);
        const existingAidOfferIds = new Set(
          (await prisma.aidOffer.findMany({
            where: { aidId: { in: aidOfferIds } },
            select: { aidId: true }
          })).map((a: { aidId: number }) => a.aidId)
        );
        
        // Split into new and existing
        const newOffers = validOffers.filter(o => !existingAidOfferIds.has(o.aidId));
        const existingOffers = validOffers.filter(o => existingAidOfferIds.has(o.aidId));
        
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
        
        // Step 5: Batch update existing aid offers - only update if data changed
        if (existingOffers.length > 0) {
          try {
            // Fetch existing aid offers with their current values for comparison
            const existingAidOfferIds = existingOffers.map(o => o.aidId);
            const existingAidOfferData = await prisma.aidOffer.findMany({
              where: { aidId: { in: existingAidOfferIds } }
            });
            
            // Create a map for quick lookup
            const existingDataMap = new Map(
              existingAidOfferData.map(a => [a.aidId, {
                aidId: a.aidId,
                declaringNationId: a.declaringNationId,
                receivingNationId: a.receivingNationId,
                declaringAllianceId: (a as any).declaringAllianceId,
                receivingAllianceId: (a as any).receivingAllianceId,
                status: a.status,
                money: a.money,
                technology: a.technology,
                soldiers: a.soldiers,
                date: a.date,
                reason: a.reason,
                version: (a as any).version,
                isActive: (a as any).isActive
              }])
            );
            
            // Filter to only offers that have actually changed
            const changedOffers = existingOffers.filter(newOffer => {
              const existing = existingDataMap.get(newOffer.aidId);
              if (!existing) return true; // Shouldn't happen, but include it
              
              // Compare all relevant fields (ignore isActive if it's already true)
              return (
                existing.declaringNationId !== newOffer.declaringNationId ||
                existing.receivingNationId !== newOffer.receivingNationId ||
                existing.declaringAllianceId !== newOffer.declaringAllianceId ||
                existing.receivingAllianceId !== newOffer.receivingAllianceId ||
                existing.status !== newOffer.status ||
                Math.abs(existing.money - newOffer.money) > 0.01 || // Float comparison with tolerance
                Math.abs(existing.technology - newOffer.technology) > 0.01 ||
                existing.soldiers !== newOffer.soldiers ||
                existing.date !== newOffer.date ||
                existing.reason !== newOffer.reason ||
                !existing.isActive // Reactivate if it was inactive
              );
            });
            
            const unchangedCount = existingOffers.length - changedOffers.length;
            console.log(`Found ${changedOffers.length} changed aid offers out of ${existingOffers.length} existing offers (${unchangedCount} unchanged)`);
            
            // Only update changed offers
            if (changedOffers.length > 0) {
              const batchSize = 100;
              const updatePromises: Promise<any>[] = [];
              
              for (let i = 0; i < changedOffers.length; i += batchSize) {
                const batch = changedOffers.slice(i, i + batchSize);
                
                // Process each update in parallel (each update is atomic)
                const batchPromises = batch.map(offer => {
                  const existing = existingDataMap.get(offer.aidId)!;
                  return prisma.aidOffer.update({
                    where: { aidId: offer.aidId },
                    data: {
                      ...offer,
                      lastSeenAt: now,
                      isActive: true,
                      version: existing.version + 1
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
              skipped = changedOffers.length - updated;
              console.log(`Batch updated ${updated} changed aid offers (skipped ${unchangedCount} unchanged)`);
            } else {
              console.log(`No changes detected in ${existingOffers.length} existing aid offers - skipping updates`);
              updated = 0;
            }
          } catch (error: any) {
            console.warn(`Error batch updating aid offers: ${error.message}`);
            skipped += existingOffers.length;
          }
        }
        
        if (skipped > 0) {
          console.log(`Skipped ${skipped} aid offers due to errors`);
        }

        console.log(`Successfully imported ${imported} new aid offers and updated ${updated} existing aid offers`);
        invalidateDataCache(); // Invalidate cache after data update
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
  let isFirstRow = true;

  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(csv({
        separator: '|'
      }))
      .on('data', (row) => {
        // Skip the header row
        if (isFirstRow) {
          isFirstRow = false;
          return;
        }
        
        // Use the actual CSV header names (with spaces) - this matches the CSV file format
        const warId = parseInt(row['War ID'] || '0');
        const declaringId = parseInt(row['Declaring ID'] || '0');
        const receivingId = parseInt(row['Receiving ID'] || '0');
        
        if (warId && declaringId && receivingId) {
          // Skip if any ID is invalid
          if (isNaN(warId) || isNaN(declaringId) || isNaN(receivingId)) {
            return;
          }
          
          // Get the raw values using actual CSV header names
          const destructionRaw = row['Destruction'] || null;
          const attackPercentRaw = row['Attack Percent'] || null;
          const defendPercentRaw = row['Defend Percent'] || null;
          
          // Parse destruction - remove commas and convert to string (it's stored as string in DB)
          const destruction = destructionRaw !== null && destructionRaw !== undefined && destructionRaw !== '' 
            ? String(destructionRaw).trim() 
            : null;
          
          // Parse percentages - handle empty strings, null, or undefined
          const attackPercent = attackPercentRaw !== null && attackPercentRaw !== undefined && attackPercentRaw !== '' 
            ? (isNaN(parseFloat(String(attackPercentRaw))) ? null : parseFloat(String(attackPercentRaw))) 
            : null;
          const defendPercent = defendPercentRaw !== null && defendPercentRaw !== undefined && defendPercentRaw !== '' 
            ? (isNaN(parseFloat(String(defendPercentRaw))) ? null : parseFloat(String(defendPercentRaw))) 
            : null;
          
          wars.push({
            warId,
            declaringNationId: declaringId,
            receivingNationId: receivingId,
            status: row['War Status'] || '',
            date: row['Begin Date'] || '',
            endDate: row['End Date'] || '',
            reason: row['Reason'] || null,
            destruction: destruction,
            attackPercent: attackPercent,
            defendPercent: defendPercent,
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
          data: { isActive: false } as any
        });
        
        // Step 2: Batch verify nations exist and get their alliance IDs
        const nationIds = new Set<number>();
        for (const war of wars) {
          nationIds.add(war.declaringNationId);
          nationIds.add(war.receivingNationId);
        }
        
        const nations = await prisma.nation.findMany({
          where: { id: { in: Array.from(nationIds) } },
          select: { id: true, allianceId: true }
        });
        
        const existingNationIds = new Set(nations.map((n: { id: number }) => n.id));
        const nationAllianceMap = new Map(
          nations.map((n: { id: number; allianceId: number }) => [n.id, n.allianceId])
        );
        
        // Enrich alliance IDs from nations data (alliance IDs are not in CSV)
        for (const war of wars) {
          if (nationAllianceMap.has(war.declaringNationId)) {
            war.declaringAllianceId = nationAllianceMap.get(war.declaringNationId)!;
          }
          if (nationAllianceMap.has(war.receivingNationId)) {
            war.receivingAllianceId = nationAllianceMap.get(war.receivingNationId)!;
          }
        }
        
        // Filter valid wars (both nations must exist)
        const validWars = wars.filter(war =>
          existingNationIds.has(war.declaringNationId) &&
          existingNationIds.has(war.receivingNationId)
        );
        
        console.log(`Processing ${validWars.length} valid wars (skipped ${wars.length - validWars.length} with invalid nations)...`);
        
        // Step 3: Fetch existing war IDs to determine new vs existing
        const warIds = validWars.map(w => w.warId);
        const existingWarIds = new Set(
          (await prisma.war.findMany({
            where: { warId: { in: warIds } },
            select: { warId: true }
          })).map((w: { warId: number }) => w.warId)
        );
        
        // Split into new and existing
        const newWars = validWars.filter(w => !existingWarIds.has(w.warId));
        const existingWars = validWars.filter(w => existingWarIds.has(w.warId));
        
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
        
        // Step 5: Batch update existing wars - only update if data changed
        if (existingWars.length > 0) {
          try {
            // Fetch existing wars with their current values for comparison
            const existingWarIds = existingWars.map(w => w.warId);
            const existingWarData = await prisma.war.findMany({
              where: { warId: { in: existingWarIds } }
            });
            
            // Create a map for quick lookup
            const existingDataMap = new Map(
              existingWarData.map(w => [w.warId, {
                warId: w.warId,
                declaringNationId: w.declaringNationId,
                receivingNationId: w.receivingNationId,
                declaringAllianceId: (w as any).declaringAllianceId,
                receivingAllianceId: (w as any).receivingAllianceId,
                status: w.status,
                date: w.date,
                endDate: w.endDate,
                reason: w.reason,
                destruction: w.destruction,
                attackPercent: w.attackPercent,
                defendPercent: w.defendPercent,
                version: (w as any).version,
                isActive: (w as any).isActive
              }])
            );
            
            // Filter to only wars that have actually changed
            const changedWars = existingWars.filter(newWar => {
              const existing = existingDataMap.get(newWar.warId);
              if (!existing) return true; // Shouldn't happen, but include it
              
              // Compare all relevant fields
              const destructionChanged = existing.destruction !== newWar.destruction;
              const attackPercentChanged = (
                (existing.attackPercent !== null && newWar.attackPercent !== null && 
                 Math.abs(existing.attackPercent - newWar.attackPercent) > 0.01) ||
                (existing.attackPercent === null) !== (newWar.attackPercent === null)
              );
              const defendPercentChanged = (
                (existing.defendPercent !== null && newWar.defendPercent !== null && 
                 Math.abs(existing.defendPercent - newWar.defendPercent) > 0.01) ||
                (existing.defendPercent === null) !== (newWar.defendPercent === null)
              );
              
              // Only mark as changed if actual data changed (not just isActive flag)
              // Note: isActive is handled separately - we always reactivate wars found in CSV
              const hasDataChange = (
                existing.declaringNationId !== newWar.declaringNationId ||
                existing.receivingNationId !== newWar.receivingNationId ||
                existing.declaringAllianceId !== newWar.declaringAllianceId ||
                existing.receivingAllianceId !== newWar.receivingAllianceId ||
                existing.status !== newWar.status ||
                existing.date !== newWar.date ||
                existing.endDate !== newWar.endDate ||
                existing.reason !== newWar.reason ||
                destructionChanged ||
                attackPercentChanged ||
                defendPercentChanged
              );
              
              // Always update if data changed OR if war was inactive (needs reactivation)
              return hasDataChange || !existing.isActive;
            });
            
            const unchangedCount = existingWars.length - changedWars.length;
            console.log(`Found ${changedWars.length} changed wars out of ${existingWars.length} existing wars (${unchangedCount} unchanged)`);
            
            // Only update changed wars
            if (changedWars.length > 0) {
              const batchSize = 100;
              const updatePromises: Promise<any>[] = [];
              
              for (let i = 0; i < changedWars.length; i += batchSize) {
                const batch = changedWars.slice(i, i + batchSize);
                
                // Process each update in parallel (each update is atomic)
                const batchPromises = batch.map(war => {
                  const existing = existingDataMap.get(war.warId)!;
                  
                  // Explicitly set all fields, including null values, to ensure Prisma updates them
                  return prisma.war.update({
                    where: { warId: war.warId },
                    data: {
                      declaringNationId: war.declaringNationId,
                      receivingNationId: war.receivingNationId,
                      declaringAllianceId: war.declaringAllianceId,
                      receivingAllianceId: war.receivingAllianceId,
                      status: war.status,
                      date: war.date,
                      endDate: war.endDate,
                      reason: war.reason,
                      destruction: war.destruction, // Explicitly set, even if null
                      attackPercent: war.attackPercent, // Explicitly set, even if null
                      defendPercent: war.defendPercent, // Explicitly set, even if null
                      lastSeenAt: now,
                      isActive: true,
                      version: existing.version + 1
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
              skipped = changedWars.length - updated;
              console.log(`Batch updated ${updated} changed wars (skipped ${unchangedCount} unchanged)`);
            } else {
              console.log(`No changes detected in ${existingWars.length} existing wars - skipping updates`);
              updated = 0;
            }
          } catch (error: any) {
            console.warn(`Error batch updating wars: ${error.message}`);
            skipped += existingWars.length;
          }
        }
        
        if (skipped > 0) {
          console.log(`Skipped ${skipped} wars due to errors`);
        }

        console.log(`Successfully imported ${imported} new wars and updated ${updated} existing wars`);
        invalidateDataCache(); // Invalidate cache after data update
        resolve({ imported, updated });
      })
      .on('error', reject);
  });
}

/**
 * Get the data path for CSV files
 * On Vercel, uses /tmp directory; otherwise uses project's src/data directory
 */
function getCsvDataPath(): string {
  const isVercel = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');
  
  if (isVercel) {
    // Vercel serverless functions can only write to /tmp
    return '/tmp/cybernations_data';
  } else {
    // Local development: use project directory
    return path.join(__dirname, '..', 'data');
  }
}

/**
 * Import all CSV files from the data directory
 */
export async function importAllCsvFiles(): Promise<void> {
  const overallStartTime = Date.now();
  const dataPath = getCsvDataPath();
  
  const nationsFile = path.join(dataPath, 'nations.csv');
  const aidOffersFile = path.join(dataPath, 'aid_offers.csv');
  const warsFile = path.join(dataPath, 'wars.csv');

  const fs = await import('fs');
  
  try {
    if (fs.existsSync(nationsFile)) {
      const startTime = Date.now();
      console.log('[CSV Import] Starting nations import...');
      await importNationsFromCsv(nationsFile);
      const time = Date.now() - startTime;
      console.log(`[CSV Import] Nations import completed in ${time}ms (${(time / 1000).toFixed(2)}s)`);
    }
    if (fs.existsSync(aidOffersFile)) {
      const startTime = Date.now();
      console.log('[CSV Import] Starting aid offers import...');
      await importAidOffersFromCsv(aidOffersFile);
      const time = Date.now() - startTime;
      console.log(`[CSV Import] Aid offers import completed in ${time}ms (${(time / 1000).toFixed(2)}s)`);
    }
    if (fs.existsSync(warsFile)) {
      const startTime = Date.now();
      console.log('[CSV Import] Starting wars import...');
      await importWarsFromCsv(warsFile);
      const time = Date.now() - startTime;
      console.log(`[CSV Import] Wars import completed in ${time}ms (${(time / 1000).toFixed(2)}s)`);
    }
    const overallTime = Date.now() - overallStartTime;
    console.log(`[CSV Import] All CSV imports completed successfully in ${overallTime}ms (${(overallTime / 1000).toFixed(2)}s)`);
  } catch (error) {
    console.error('Error during CSV import:', error);
    throw error;
  }
}

