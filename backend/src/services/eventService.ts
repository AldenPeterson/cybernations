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
 * Detect and create events for new nations (> 1000 NS)
 * Called when a nation is first created
 */
export async function detectNewNationEvent(nationId: number, strength: number): Promise<void> {
  if (strength < MIN_NS_THRESHOLD) {
    return; // Only track nations > 1000 NS
  }

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
 * Detect and create events for nations that go inactive (> 1000 NS)
 * Called when a nation is marked as inactive
 */
export async function detectNationInactiveEvent(nationId: number): Promise<void> {
  try {
    // Get the nation to check if it meets the NS threshold
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: { alliance: true },
    });

    if (!nation || nation.strength < MIN_NS_THRESHOLD) {
      return; // Only track nations > 1000 NS
    }

    // Check if there's already an event for this nation going inactive
    // (we want to create one event per inactivity, not duplicate events)
    const existingEvent = await prisma.event.findFirst({
      where: {
        nationId,
        eventType: NATION_EVENT_TYPES.NATION_INACTIVE,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Only create a new event if:
    // 1. No event exists, OR
    // 2. The last event was created more than 1 hour ago (to avoid spam if nation flickers)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (existingEvent && existingEvent.createdAt > oneHourAgo) {
      return; // Recently created event exists
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
 * Detect and create events for nations that change alliance (> 1000 NS)
 * Called when a nation's allianceId changes
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
    // Get the nation to check if it meets the NS threshold
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: { alliance: true },
    });

    if (!nation || nation.strength < MIN_NS_THRESHOLD) {
      return; // Only track nations > 1000 NS
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
 * This is called after marking all nations as inactive, before reactivating active ones
 */
export async function processInactiveNations(): Promise<void> {
  try {
    // Find all nations that are inactive and have strength > 1000 NS
    const inactiveNations = await prisma.nation.findMany({
      where: {
        isActive: false,
        strength: {
          gte: MIN_NS_THRESHOLD,
        },
      },
      include: {
        alliance: true,
      },
    });

    // Process each inactive nation
    for (const nation of inactiveNations) {
      await detectNationInactiveEvent(nation.id);
    }
  } catch (error: any) {
    console.error('Error processing inactive nations for events:', error.message);
    // Don't throw - event processing failure shouldn't break the import
  }
}

