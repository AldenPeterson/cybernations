import 'dotenv/config';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../src/utils/prisma.js';

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

async function importNations() {
  console.log('Importing nations from CSV...');
  
  const dataPath = path.join(__dirname, '..', 'src', 'data', 'nations.csv');
  const nations: any[] = [];
  let currentRank = 1;

  return new Promise<void>((resolve, reject) => {
    createReadStream(dataPath)
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
        console.log(`Parsed ${nations.length} nations`);
        
        // First, create/update alliances
        const allianceMap = new Map<number, string>();
        for (const nation of nations) {
          if (nation.allianceId && nation.alliance) {
            allianceMap.set(nation.allianceId, nation.alliance);
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

        // Then, upsert nations
        console.log('Upserting nations...');
        let processed = 0;
        let skipped = 0;
        for (const nation of nations) {
          // Skip if allianceId is invalid or doesn't exist
          if (!nation.allianceId || nation.allianceId === 0) {
            skipped++;
            continue;
          }
          
          // Ensure alliance exists
          const allianceExists = allianceMap.has(nation.allianceId);
          if (!allianceExists) {
            console.warn(`Alliance ${nation.allianceId} not found for nation ${nation.id}, skipping...`);
            skipped++;
            continue;
          }
          
          // Remove alliance field (it's a relation, not a direct field)
          const { alliance, ...nationData } = nation;
          
          try {
            await prisma.nation.upsert({
              where: { id: nation.id },
              update: {
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
              },
              create: nationData,
            });
            processed++;
            if (processed % 100 === 0) {
              console.log(`Processed ${processed}/${nations.length} nations...`);
            }
          } catch (error: any) {
            console.warn(`Error upserting nation ${nation.id}: ${error.message}`);
            skipped++;
          }
        }
        console.log(`Skipped ${skipped} nations due to invalid data`);
        console.log(`Successfully imported ${nations.length} nations`);
        resolve();
      })
      .on('error', reject);
  });
}

async function importAidOffers() {
  console.log('Importing aid offers from CSV...');
  
  const dataPath = path.join(__dirname, '..', 'src', 'data', 'aid_offers.csv');
  const aidOffers: any[] = [];

  return new Promise<void>((resolve, reject) => {
    createReadStream(dataPath)
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
        console.log(`Parsed ${aidOffers.length} aid offers`);
        console.log('Upserting aid offers...');
        
        let processed = 0;
        let skipped = 0;
        for (const offer of aidOffers) {
          try {
            // Verify nations exist
            const declaringExists = await prisma.nation.findUnique({ where: { id: offer.declaringNationId } });
            const receivingExists = await prisma.nation.findUnique({ where: { id: offer.receivingNationId } });
            
            if (!declaringExists || !receivingExists) {
              skipped++;
              continue;
            }
            
            await prisma.aidOffer.upsert({
              where: { aidId: offer.aidId },
              update: offer,
              create: offer,
            });
            processed++;
            if (processed % 100 === 0) {
              console.log(`Processed ${processed}/${aidOffers.length} aid offers...`);
            }
          } catch (error: any) {
            console.warn(`Error upserting aid offer ${offer.aidId}: ${error.message}`);
            skipped++;
          }
        }
        console.log(`Skipped ${skipped} aid offers due to invalid data`);
        console.log(`Successfully imported ${aidOffers.length} aid offers`);
        resolve();
      })
      .on('error', reject);
  });
}

async function importWars() {
  console.log('Importing wars from CSV...');
  
  const dataPath = path.join(__dirname, '..', 'src', 'data', 'wars.csv');
  const wars: any[] = [];

  return new Promise<void>((resolve, reject) => {
    createReadStream(dataPath)
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
        console.log(`Parsed ${wars.length} wars`);
        console.log('Upserting wars...');
        
        let processed = 0;
        let skipped = 0;
        for (const war of wars) {
          try {
            // Verify nations exist
            const declaringExists = await prisma.nation.findUnique({ where: { id: war.declaringNationId } });
            const receivingExists = await prisma.nation.findUnique({ where: { id: war.receivingNationId } });
            
            if (!declaringExists || !receivingExists) {
              skipped++;
              continue;
            }
            
            await prisma.war.upsert({
              where: { warId: war.warId },
              update: war,
              create: war,
            });
            processed++;
            if (processed % 100 === 0) {
              console.log(`Processed ${processed}/${wars.length} wars...`);
            }
          } catch (error: any) {
            console.warn(`Error upserting war ${war.warId}: ${error.message}`);
            skipped++;
          }
        }
        console.log(`Skipped ${skipped} wars due to invalid data`);
        console.log(`Successfully imported ${wars.length} wars`);
        resolve();
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    await importNations();
    await importAidOffers();
    await importWars();
    console.log('CSV migration completed successfully!');
  } catch (error) {
    console.error('Error during CSV migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

