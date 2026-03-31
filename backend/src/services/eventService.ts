import { prisma } from '../utils/prisma.js';

const MIN_NS_THRESHOLD = 1000;

/**
 * Event types for nation events
 */
export const NATION_EVENT_TYPES = {
  NEW_NATION: 'new_nation',
  NATION_INACTIVE: 'nation_inactive',
  ALLIANCE_CHANGE: 'alliance_change',
  WAR_MODE_CHANGE: 'war_mode_change',
  DEFCON_CHANGE: 'defcon_change',
  POSSIBLE_DONATION: 'possible_donation',
} as const;

/**
 * PayPal donation bundles (highest USD listed first for `findHighestDonationTierAtLeast`).
 * A tick is a suspected donation when each delta is at least the tier’s minimum (handles stacked aid on tech, etc.).
 */
export const DONATION_TIERS = [
  { usd: 30, deltaInfrastructure: 2000, deltaLand: 2000, deltaTechnology: 200 },
  { usd: 25, deltaInfrastructure: 1500, deltaLand: 1500, deltaTechnology: 150 },
  { usd: 20, deltaInfrastructure: 1250, deltaLand: 1250, deltaTechnology: 125 },
  { usd: 15, deltaInfrastructure: 1000, deltaLand: 1000, deltaTechnology: 100 },
  { usd: 10, deltaInfrastructure: 750, deltaLand: 750, deltaTechnology: 75 },
  { usd: 5, deltaInfrastructure: 500, deltaLand: 500, deltaTechnology: 50 },
] as const;

export type DonationTier = (typeof DONATION_TIERS)[number];

export function parseNationStatField(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Highest-USD tier such that infra/land/tech deltas are all >= that tier’s package amounts.
 * `DONATION_TIERS` is ordered by descending USD.
 */
export function findHighestDonationTierAtLeast(
  dInfra: number,
  dLand: number,
  dTech: number
): DonationTier | null {
  if (dInfra <= 0 || dLand <= 0 || dTech <= 0) {
    return null;
  }
  for (const tier of DONATION_TIERS) {
    if (
      dInfra >= tier.deltaInfrastructure &&
      dLand >= tier.deltaLand &&
      dTech >= tier.deltaTechnology
    ) {
      return tier;
    }
  }
  return null;
}

export type PossibleDonationEventInput = {
  nationId: number;
  beforeInfrastructure: number;
  afterInfrastructure: number;
  beforeLand: number;
  afterLand: number;
  beforeTechnology: number;
  afterTechnology: number;
  deltaInfrastructure: number;
  deltaLand: number;
  deltaTechnology: number;
  tier: DonationTier;
};

/**
 * Top-level event type for stats events
 */
export const STATS_EVENT_TYPE = 'stats';

/**
 * Event types for stats events
 */
export const STATS_EVENT_TYPES = {
  CASUALTY_RANKING_ENTERED: 'casualty_ranking_entered',
  CASUALTY_RANKING_EXITED: 'casualty_ranking_exited',
  CASUALTY_RANKING_CHANGED: 'casualty_ranking_changed',
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
 * Detect and create events when a nation's war mode status changes (inWarMode)
 * Called when nation data is updated and inWarMode differs from previous value
 */
export async function detectWarModeChangeEvent(
  nationId: number,
  oldInWarMode: boolean,
  newInWarMode: boolean
): Promise<void> {
  if (oldInWarMode === newInWarMode) {
    return;
  }

  try {
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: { alliance: true },
    });

    if (!nation) {
      return;
    }

    const status = newInWarMode ? 'entered war mode' : 'left war mode';
    await prisma.event.create({
      data: {
        type: 'nation',
        eventType: NATION_EVENT_TYPES.WAR_MODE_CHANGE,
        nationId,
        allianceId: nation.allianceId,
        description: `${nation.rulerName} (${nation.nationName}) from ${nation.alliance.name} ${status}`,
        metadata: {
          strength: nation.strength,
          rulerName: nation.rulerName,
          nationName: nation.nationName,
          allianceName: nation.alliance.name,
          oldInWarMode,
          newInWarMode,
        },
      },
    });
  } catch (error: any) {
    console.error(`Error creating war mode change event for nation ${nationId}:`, error.message);
  }
}

/**
 * Detect and create events when a nation's DEFCON level changes
 * Called when nation data is updated and defcon differs from previous value
 */
export async function detectDefconChangeEvent(
  nationId: number,
  oldDefcon: number | null,
  newDefcon: number | null
): Promise<void> {
  if (oldDefcon === newDefcon) {
    return;
  }

  try {
    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: { alliance: true },
    });

    if (!nation) {
      return;
    }

    const oldStr = oldDefcon != null ? `DEFCON ${oldDefcon}` : 'unknown';
    const newStr = newDefcon != null ? `DEFCON ${newDefcon}` : 'unknown';
    await prisma.event.create({
      data: {
        type: 'nation',
        eventType: NATION_EVENT_TYPES.DEFCON_CHANGE,
        nationId,
        allianceId: nation.allianceId,
        description: `${nation.rulerName} (${nation.nationName}) from ${nation.alliance.name} changed from ${oldStr} to ${newStr}`,
        metadata: {
          strength: nation.strength,
          rulerName: nation.rulerName,
          nationName: nation.nationName,
          allianceName: nation.alliance.name,
          oldDefcon,
          newDefcon,
        },
      },
    });
  } catch (error: any) {
    console.error(`Error creating DEFCON change event for nation ${nationId}:`, error.message);
  }
}

/**
 * Heuristic: one-tick deltas meet or exceed a known donation package on all three stats (highest qualifying USD tier).
 */
export async function detectPossibleDonationEvent(input: PossibleDonationEventInput): Promise<void> {
  const {
    nationId,
    beforeInfrastructure,
    afterInfrastructure,
    beforeLand,
    afterLand,
    beforeTechnology,
    afterTechnology,
    deltaInfrastructure,
    deltaLand,
    deltaTechnology,
    tier,
  } = input;

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.event.findMany({
      where: {
        nationId,
        eventType: NATION_EVENT_TYPES.POSSIBLE_DONATION,
        createdAt: { gte: oneHourAgo },
      },
      select: { metadata: true },
    });
    const isDup = recent.some((e) => {
      const m = e.metadata as Record<string, unknown> | null;
      if (!m) return false;
      return m.suspectedDonationUsd === tier.usd;
    });
    if (isDup) {
      return;
    }

    const nation = await prisma.nation.findUnique({
      where: { id: nationId },
      include: { alliance: true },
    });

    if (!nation) {
      return;
    }

    const label = `$${tier.usd.toFixed(2)} tier`;
    await prisma.event.create({
      data: {
        type: 'nation',
        eventType: NATION_EVENT_TYPES.POSSIBLE_DONATION,
        nationId,
        allianceId: nation.allianceId,
        description: `${nation.rulerName} (${nation.nationName}) from ${nation.alliance.name}: possible donation (${label}, ≥ tier mins) — infra/land/tech +${deltaInfrastructure}/+${deltaLand}/+${deltaTechnology}`,
        metadata: {
          strength: nation.strength,
          rulerName: nation.rulerName,
          nationName: nation.nationName,
          allianceName: nation.alliance.name,
          suspectedDonationUsd: tier.usd,
          tierMinimumInfrastructure: tier.deltaInfrastructure,
          tierMinimumLand: tier.deltaLand,
          tierMinimumTechnology: tier.deltaTechnology,
          deltaInfrastructure,
          deltaLand,
          deltaTechnology,
          beforeInfrastructure,
          afterInfrastructure,
          beforeLand,
          afterLand,
          beforeTechnology,
          afterTechnology,
        },
      },
    });
  } catch (error: any) {
    console.error(`Error creating possible donation event for nation ${nationId}:`, error.message);
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

