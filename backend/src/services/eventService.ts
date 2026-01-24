import { prisma } from '../utils/prisma.js';

const MIN_NS_THRESHOLD = 1000;

/**
 * Event types for nation events
 */
export const NATION_EVENT_TYPES = {
  NEW_NATION: 'new_nation',
  NATION_INACTIVE: 'nation_inactive',
  ALLIANCE_CHANGE: 'alliance_change',
} as const;

/**
 * Detect and create events for new nations
 * Called when a nation is first created
 * Tracks all nations regardless of strength
 */
export async function detectNewNationEvent(nationId: number, strength: number): Promise<void> {
  try {
    // Check if this is truly the first time we're seeing this nation
    // by checking if there's already an event for this nation
    const existingEvent = await prisma.event.findFirst({
      where: {
        nationId,
        eventType: NATION_EVENT_TYPES.NEW_NATION,
      },
    });

    if (existingEvent) {
      return; // Event already exists
    }

    // Get nation details for the description
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: { alliance: true },
    });

    if (!nation) {
      return;
    }

    // Create the event
    await prisma.event.create({
      data: {
        type: 'nation',
        eventType: NATION_EVENT_TYPES.NEW_NATION,
        nationId,
        allianceId: nation.allianceId,
        description: `${nation.rulerName} (${nation.nationName}) from ${nation.alliance.name} appeared with ${strength.toLocaleString()} NS`,
        metadata: {
          strength,
          rulerName: nation.rulerName,
          nationName: nation.nationName,
          allianceName: nation.alliance.name,
        },
      },
    });
  } catch (error: any) {
    console.error(`Error creating new nation event for nation ${nationId}:`, error.message);
    // Don't throw - event creation failure shouldn't break the import
  }
}

/**
 * Detect and create events for nations that go inactive
 * A nation is considered "inactive" when it no longer appears in the nation data file,
 * not based on the nation's activity status field.
 * Called when a nation is marked as inactive (isActive = false)
 * Tracks all nations regardless of strength
 */
export async function detectNationInactiveEvent(nationId: number): Promise<void> {
  try {
    // Get the nation
    // Note: "inactive" here means the nation is not in the current data file (isActive = false),
    // not based on the nation's activity status field
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: { alliance: true },
    });

    if (!nation) {
      return;
    }

    // Only create an event if the nation was previously active (recently seen)
    // If lastSeenAt is old, the nation was already inactive, so don't create a duplicate event
    // Use 48 hours as the threshold - if last seen more than 48 hours ago, consider it already inactive
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    if (nation.lastSeenAt < twoDaysAgo) {
      return; // Nation was already inactive (not seen recently)
    }

    // Check if there's already an event for this nation going inactive
    // that was created after the nation's lastSeenAt timestamp
    // This means we already processed this transition from active to inactive
    const existingEvent = await prisma.event.findFirst({
      where: {
        nationId,
        eventType: NATION_EVENT_TYPES.NATION_INACTIVE,
        createdAt: {
          gte: nation.lastSeenAt, // Event created after the nation was last seen
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingEvent) {
      return; // Already processed this nation going inactive
    }

    // Also check if there's a recent event (within 1 hour) to avoid spam if nation flickers
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvent = await prisma.event.findFirst({
      where: {
        nationId,
        eventType: NATION_EVENT_TYPES.NATION_INACTIVE,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    if (recentEvent) {
      return; // Recently created event exists (avoid spam)
    }

    // Create the event
    await prisma.event.create({
      data: {
        type: 'nation',
        eventType: NATION_EVENT_TYPES.NATION_INACTIVE,
        nationId,
        allianceId: nation.allianceId,
        description: `${nation.rulerName} (${nation.nationName}) from ${nation.alliance.name} is no longer active (was ${nation.strength.toLocaleString()} NS)`,
        metadata: {
          strength: nation.strength,
          rulerName: nation.rulerName,
          nationName: nation.nationName,
          allianceName: nation.alliance.name,
          lastSeenAt: nation.lastSeenAt.toISOString(),
        },
      },
    });
  } catch (error: any) {
    console.error(`Error creating nation inactive event for nation ${nationId}:`, error.message);
    // Don't throw - event creation failure shouldn't break the import
  }
}

/**
 * Detect and create events for nations that change alliance
 * Called when a nation's allianceId changes
 * Tracks all nations regardless of strength
 */
export async function detectAllianceChangeEvent(
  nationId: number,
  oldAllianceId: number,
  newAllianceId: number
): Promise<void> {
  // Skip if alliance hasn't actually changed
  if (oldAllianceId === newAllianceId) {
    return;
  }

  try {
    // Get the nation
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: { alliance: true },
    });

    if (!nation) {
      return;
    }

    // Get old and new alliance information
    const [oldAlliance, newAlliance] = await Promise.all([
      oldAllianceId ? prisma.alliance.findUnique({ where: { id: oldAllianceId } }) : null,
      newAllianceId ? prisma.alliance.findUnique({ where: { id: newAllianceId } }) : null,
    ]);

    const oldAllianceName = oldAlliance?.name || 'No Alliance';
    const newAllianceName = newAlliance?.name || 'No Alliance';

    // Create the event
    await prisma.event.create({
      data: {
        type: 'nation',
        eventType: NATION_EVENT_TYPES.ALLIANCE_CHANGE,
        nationId,
        allianceId: newAllianceId, // Set to new alliance
        description: `${nation.rulerName} (${nation.nationName}) changed from ${oldAllianceName} to ${newAllianceName}`,
        metadata: {
          strength: nation.strength,
          rulerName: nation.rulerName,
          nationName: nation.nationName,
          oldAllianceId,
          oldAllianceName,
          newAllianceId,
          newAllianceName,
        },
      },
    });
  } catch (error: any) {
    console.error(`Error creating alliance change event for nation ${nationId}:`, error.message);
    // Don't throw - event creation failure shouldn't break the import
  }
}

/**
 * Process events for nations that became inactive during import
 * A nation is considered "inactive" when it no longer appears in the nation data file.
 * This is called after marking all nations as inactive (isActive = false), before reactivating
 * those that appear in the current data file.
 * Tracks all nations regardless of strength
 */
export async function processInactiveNations(): Promise<void> {
  try {
    // Find all nations that are inactive (not in current data file)
    // Note: isActive = false means the nation is not present in the current data file
    const inactiveNations = await prisma.nation.findMany({
      where: {
        isActive: false,
      },
      include: {
        alliance: true,
      },
    });

    // Process inactive events in parallel batches to improve performance
    const batchSize = 50;
    for (let i = 0; i < inactiveNations.length; i += batchSize) {
      const batch = inactiveNations.slice(i, i + batchSize);
      await Promise.all(batch.map(nation => detectNationInactiveEvent(nation.id)));
    }
  } catch (error: any) {
    console.error('Error processing inactive nations for events:', error.message);
    // Don't throw - event processing failure shouldn't break the import
  }
}

