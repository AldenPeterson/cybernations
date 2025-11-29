import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../src/utils/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AllianceData {
  alliance_id: number;
  alliance_name: string;
  nations: {
    [nationId: number]: {
      ruler_name: string;
      nation_name: string;
      discord_handle: string;
      has_dra: boolean;
      notes?: string;
      slots: {
        sendTech: number;
        sendCash: number;
        getTech: number;
        getCash: number;
        external: number;
        send_priority?: number;
        receive_priority?: number;
      };
      current_stats?: {
        technology: string;
        infrastructure: string;
        strength: string;
      };
    };
  };
}

interface DynamicWar {
  warId: number;
  declaringId: number;
  declaringRuler: string;
  declaringNation: string;
  declaringAlliance: string;
  declaringAllianceId: number;
  receivingId: number;
  receivingRuler: string;
  receivingNation: string;
  receivingAlliance: string;
  receivingAllianceId: number;
  status: string;
  date: string;
  endDate: string;
  reason?: string;
  destruction?: string;
  attackPercent?: number;
  defendPercent?: number;
  addedAt: string;
  source: 'chrome_extension' | 'manual' | 'api';
}

interface NuclearHitRecord {
  attackingNation: string;
  defendingNation: string;
  result?: string;
  sentAt: string;
}

interface NationDiscordData {
  discord_handle: string;
  last_updated: string;
}

interface NationDiscordHandles {
  [nationId: string]: NationDiscordData;
}

interface CrossAllianceAidConfig {
  cross_alliance_aid_coordination: {
    [sourceAllianceId: string]: string; // target alliance ID
  };
}

async function importAlliances() {
  console.log('Importing alliance configurations...');
  
  const alliancesDir = path.join(__dirname, '..', 'src', 'config', 'alliances');
  
  if (!fs.existsSync(alliancesDir)) {
    console.log('Alliances directory not found, skipping...');
    return;
  }

  const files = fs.readdirSync(alliancesDir).filter(file => file.endsWith('.json'));
  console.log(`Found ${files.length} alliance files`);

  for (const file of files) {
    try {
      const filePath = path.join(alliancesDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AllianceData;
      
      // Create/update alliance
      await prisma.alliance.upsert({
        where: { id: data.alliance_id },
        update: { name: data.alliance_name },
        create: { id: data.alliance_id, name: data.alliance_name },
      });

      // Update nation configs
      for (const [nationIdStr, nationData] of Object.entries(data.nations)) {
        const nationId = parseInt(nationIdStr);
        
        // Ensure nation exists (should be from CSV import)
        const nation = await prisma.nation.findUnique({
          where: { id: nationId },
        });

        if (!nation) {
          console.warn(`Nation ${nationId} not found in database, skipping config...`);
          continue;
        }

        // Upsert nation config
        await prisma.nationConfig.upsert({
          where: { nationId },
          update: {
            allianceId: data.alliance_id,
            hasDra: nationData.has_dra,
            discordHandle: nationData.discord_handle || null,
            notes: nationData.notes || null,
            sendTechSlots: nationData.slots.sendTech || 0,
            sendCashSlots: nationData.slots.sendCash || 0,
            getTechSlots: nationData.slots.getTech || 0,
            getCashSlots: nationData.slots.getCash || 0,
            externalSlots: nationData.slots.external || 0,
            sendPriority: nationData.slots.send_priority ?? 3,
            receivePriority: nationData.slots.receive_priority ?? 3,
            currentTech: nationData.current_stats?.technology || null,
            currentInfra: nationData.current_stats?.infrastructure || null,
            currentStrength: nationData.current_stats?.strength || null,
          },
          create: {
            nationId,
            allianceId: data.alliance_id,
            hasDra: nationData.has_dra,
            discordHandle: nationData.discord_handle || null,
            notes: nationData.notes || null,
            sendTechSlots: nationData.slots.sendTech || 0,
            sendCashSlots: nationData.slots.sendCash || 0,
            getTechSlots: nationData.slots.getTech || 0,
            getCashSlots: nationData.slots.getCash || 0,
            externalSlots: nationData.slots.external || 0,
            sendPriority: nationData.slots.send_priority ?? 3,
            receivePriority: nationData.slots.receive_priority ?? 3,
            currentTech: nationData.current_stats?.technology || null,
            currentInfra: nationData.current_stats?.infrastructure || null,
            currentStrength: nationData.current_stats?.strength || null,
          },
        });
      }

      console.log(`Imported alliance ${data.alliance_id}: ${data.alliance_name}`);
    } catch (error) {
      console.error(`Error importing alliance file ${file}:`, error);
    }
  }
}

async function importDynamicWars() {
  console.log('Importing dynamic wars...');
  
  const dataPath = path.join(__dirname, '..', 'src', 'data', 'dynamic_wars.json');
  
  if (!fs.existsSync(dataPath)) {
    console.log('Dynamic wars file not found, skipping...');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as DynamicWar[];
    console.log(`Found ${data.length} dynamic wars`);

    for (const war of data) {
      // Ensure nations exist
      const declaringNation = await prisma.nation.findUnique({
        where: { id: war.declaringId },
      });
      const receivingNation = await prisma.nation.findUnique({
        where: { id: war.receivingId },
      });

      if (!declaringNation || !receivingNation) {
        console.warn(`Skipping dynamic war ${war.warId}: nations not found`);
        continue;
      }

      await prisma.dynamicWar.upsert({
        where: { warId: war.warId },
        update: {
          declaringNationId: war.declaringId,
          receivingNationId: war.receivingId,
          status: war.status,
          date: war.date,
          endDate: war.endDate,
          reason: war.reason || null,
          destruction: war.destruction || null,
          attackPercent: war.attackPercent || null,
          defendPercent: war.defendPercent || null,
          addedAt: new Date(war.addedAt),
          source: war.source,
        },
        create: {
          warId: war.warId,
          declaringNationId: war.declaringId,
          receivingNationId: war.receivingId,
          status: war.status,
          date: war.date,
          endDate: war.endDate,
          reason: war.reason || null,
          destruction: war.destruction || null,
          attackPercent: war.attackPercent || null,
          defendPercent: war.defendPercent || null,
          addedAt: new Date(war.addedAt),
          source: war.source,
        },
      });
    }

    console.log(`Successfully imported ${data.length} dynamic wars`);
  } catch (error) {
    console.error('Error importing dynamic wars:', error);
  }
}

async function importNuclearHits() {
  console.log('Importing nuclear hits...');
  
  const dataPath = path.join(__dirname, '..', 'src', 'data', 'nuclear_hits.json');
  
  if (!fs.existsSync(dataPath)) {
    console.log('Nuclear hits file not found, skipping...');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as Record<string, NuclearHitRecord>;
    const entries = Object.entries(data);
    console.log(`Found ${entries.length} nuclear hits`);

    for (const [key, record] of entries) {
      await prisma.nuclearHit.upsert({
        where: { key },
        update: {
          attackingNation: record.attackingNation,
          defendingNation: record.defendingNation,
          result: record.result || null,
          sentAt: record.sentAt,
        },
        create: {
          key,
          attackingNation: record.attackingNation,
          defendingNation: record.defendingNation,
          result: record.result || null,
          sentAt: record.sentAt,
        },
      });
    }

    console.log(`Successfully imported ${entries.length} nuclear hits`);
  } catch (error) {
    console.error('Error importing nuclear hits:', error);
  }
}

async function importDiscordHandles() {
  console.log('Importing discord handles...');
  
  const dataPath = path.join(__dirname, '..', 'src', 'data', 'nation_discord_handles.json');
  
  if (!fs.existsSync(dataPath)) {
    console.log('Discord handles file not found, skipping...');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as NationDiscordHandles;
    const entries = Object.entries(data);
    console.log(`Found ${entries.length} discord handles`);

    for (const [nationIdStr, handleData] of entries) {
      const nationId = parseInt(nationIdStr);
      
      // Update or create nation config with discord handle
      const nationConfig = await prisma.nationConfig.findUnique({
        where: { nationId },
      });

      if (nationConfig) {
        await prisma.nationConfig.update({
          where: { nationId },
          data: { discordHandle: handleData.discord_handle },
        });
      } else {
        // Get nation to find allianceId
        const nation = await prisma.nation.findUnique({
          where: { id: nationId },
        });

        if (nation) {
          await prisma.nationConfig.create({
            data: {
              nationId,
              allianceId: nation.allianceId,
              discordHandle: handleData.discord_handle,
            },
          });
        } else {
          console.warn(`Nation ${nationId} not found, skipping discord handle...`);
        }
      }
    }

    console.log(`Successfully imported ${entries.length} discord handles`);
  } catch (error) {
    console.error('Error importing discord handles:', error);
  }
}

async function importCrossAllianceAid() {
  console.log('Importing cross-alliance aid config...');
  
  const dataPath = path.join(__dirname, '..', 'src', 'config', 'crossAllianceAid.json');
  
  if (!fs.existsSync(dataPath)) {
    console.log('Cross-alliance aid config not found, skipping...');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as CrossAllianceAidConfig;
    const entries = Object.entries(data.cross_alliance_aid_coordination || {});
    console.log(`Found ${entries.length} cross-alliance aid mappings`);

    for (const [sourceAllianceIdStr, targetAllianceIdStr] of entries) {
      const sourceAllianceId = parseInt(sourceAllianceIdStr);
      const targetAllianceId = parseInt(targetAllianceIdStr);

      // Ensure alliances exist
      const sourceAlliance = await prisma.alliance.findUnique({
        where: { id: sourceAllianceId },
      });
      const targetAlliance = await prisma.alliance.findUnique({
        where: { id: targetAllianceId },
      });

      if (!sourceAlliance || !targetAlliance) {
        console.warn(`Skipping cross-alliance aid: alliances not found`);
        continue;
      }

      await prisma.crossAllianceAid.upsert({
        where: {
          sourceAllianceId_targetAllianceId: {
            sourceAllianceId,
            targetAllianceId,
          },
        },
        update: {},
        create: {
          sourceAllianceId,
          targetAllianceId,
        },
      });
    }

    console.log(`Successfully imported ${entries.length} cross-alliance aid mappings`);
  } catch (error) {
    console.error('Error importing cross-alliance aid:', error);
  }
}

async function main() {
  try {
    await importAlliances();
    await importDynamicWars();
    await importNuclearHits();
    await importDiscordHandles();
    await importCrossAllianceAid();
    console.log('JSON migration completed successfully!');
  } catch (error) {
    console.error('Error during JSON migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

