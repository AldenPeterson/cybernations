import { prisma } from './prisma.js';

export interface NationDiscordData {
  discord_handle: string;
  last_updated: string;
}

export interface NationDiscordHandles {
  [nationId: string]: NationDiscordData;
}

/**
 * Load all nation discord handles from database
 */
export async function loadNationDiscordHandles(): Promise<NationDiscordHandles> {
  try {
    const configs = await prisma.nationConfig.findMany({
      where: {
        discordHandle: {
          not: null,
        },
      },
      include: {
        nation: true,
      },
    });

    const handles: NationDiscordHandles = {};
    for (const config of configs) {
      if (config.discordHandle) {
        handles[config.nationId.toString()] = {
          discord_handle: config.discordHandle,
          last_updated: config.updatedAt.toISOString(),
        };
      }
    }

    return handles;
  } catch (error) {
    console.error('Error loading nation discord handles from database:', error);
    return {};
  }
}

/**
 * Save nation discord handles to database
 */
export async function saveNationDiscordHandles(handles: NationDiscordHandles): Promise<boolean> {
  try {
    for (const [nationIdStr, handleData] of Object.entries(handles)) {
      const nationId = parseInt(nationIdStr);
      
      // Get or create nation config
      const existingConfig = await prisma.nationConfig.findUnique({
        where: { nationId },
      });

      if (existingConfig) {
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
              discordHandle: handleData.discord_handle,
            },
          });
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error saving nation discord handles to database:', error);
    return false;
  }
}

/**
 * Get discord handle for a specific nation
 */
export async function getDiscordHandle(nationId: number): Promise<string | null> {
  try {
    const config = await prisma.nationConfig.findUnique({
      where: { nationId },
      select: { discordHandle: true },
    });
    return config?.discordHandle || null;
  } catch (error) {
    console.error(`Error getting discord handle for nation ${nationId}:`, error);
    return null;
  }
}

/**
 * Update discord handle for a specific nation
 */
export async function updateDiscordHandle(nationId: number, discordHandle: string): Promise<boolean> {
  try {
    const existingConfig = await prisma.nationConfig.findUnique({
      where: { nationId },
    });

    if (existingConfig) {
      await prisma.nationConfig.update({
        where: { nationId },
        data: { discordHandle },
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
            discordHandle,
          },
        });
      } else {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`Error updating discord handle for nation ${nationId}:`, error);
    return false;
  }
}

/**
 * Delete discord handle for a specific nation
 */
export async function deleteDiscordHandle(nationId: number): Promise<boolean> {
  try {
    await prisma.nationConfig.update({
      where: { nationId },
      data: { discordHandle: null },
    });
    return true;
  } catch (error) {
    console.error(`Error deleting discord handle for nation ${nationId}:`, error);
    return false;
  }
}

/**
 * Get all nations with discord handles
 */
export async function getAllNationsWithDiscordHandles(): Promise<{ nationId: number; discordHandle: string; lastUpdated: string }[]> {
  try {
    const configs = await prisma.nationConfig.findMany({
      where: {
        discordHandle: {
          not: null,
        },
      },
      select: {
        nationId: true,
        discordHandle: true,
        updatedAt: true,
      },
    });

    return configs.map(config => ({
      nationId: config.nationId,
      discordHandle: config.discordHandle!,
      lastUpdated: config.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('Error getting all nations with discord handles:', error);
    return [];
  }
}

/**
 * Merge discord handles into nation data
 * This is a utility function to join discord handle data with nation data
 */
export async function mergeDiscordHandles<T extends { nation_id?: number; id?: number }>(
  nations: T[],
  handleField: string = 'discord_handle'
): Promise<T[]> {
  const handles = await loadNationDiscordHandles();
  
  return nations.map(nation => {
    const nationId = nation.nation_id || nation.id;
    if (nationId) {
      const handleData = handles[nationId.toString()];
      return {
        ...nation,
        [handleField]: handleData ? handleData.discord_handle : ''
      };
    }
    return nation;
  });
}
