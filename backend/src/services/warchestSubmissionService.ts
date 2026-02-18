import { prisma } from '../utils/prisma.js';

export interface ParsedWarchestData {
  nationName: string;
  totalMoney: number;
  armyXP?: number;
  navyXP?: number;
  airForceXP?: number;
  intelligenceXP?: number;
  hasAssignedGenerals: boolean;
  assignedGenerals?: string;
}

/**
 * Parse spy operation text to extract nation name, total money, XP levels, and assigned generals
 */
export function parseSpyOperationText(text: string): ParsedWarchestData | null {
  try {
    // Extract nation name - look for pattern like "against the nation of X"
    const nationMatch = text.match(/against the nation of ([^.\n]+)/i);
    if (!nationMatch) {
      return null;
    }
    const nationName = nationMatch[1].trim();

    // Extract total money - look for pattern like "Total Money: $X"
    const moneyMatch = text.match(/Total Money:\s*\$?([\d,]+)/i);
    if (!moneyMatch) {
      return null;
    }
    // Remove commas and parse as float
    const totalMoney = parseFloat(moneyMatch[1].replace(/,/g, ''));
    if (isNaN(totalMoney)) {
      return null;
    }

    // Extract XP levels - look for pattern like "Military XP Ratings: Army XP: 6, Navy XP: 3, Air Force XP: 124, Intelligence XP: 5"
    let armyXP: number | undefined;
    let navyXP: number | undefined;
    let airForceXP: number | undefined;
    let intelligenceXP: number | undefined;

    // Try to match the full Military XP Ratings line first
    const xpMatch = text.match(/Military XP Ratings:.*?Army XP:\s*(\d+).*?Navy XP:\s*(\d+).*?Air Force XP:\s*(\d+).*?Intelligence XP:\s*(\d+)/is);
    if (xpMatch) {
      armyXP = parseInt(xpMatch[1], 10);
      navyXP = parseInt(xpMatch[2], 10);
      airForceXP = parseInt(xpMatch[3], 10);
      intelligenceXP = parseInt(xpMatch[4], 10);
    } else {
      // Try individual matches if the combined pattern doesn't work
      const armyXPMatch = text.match(/Army XP:\s*(\d+)/i);
      const navyXPMatch = text.match(/Navy XP:\s*(\d+)/i);
      const airForceXPMatch = text.match(/Air Force XP:\s*(\d+)/i);
      const intelligenceXPMatch = text.match(/Intelligence XP:\s*(\d+)/i);
      
      if (armyXPMatch && !isNaN(parseInt(armyXPMatch[1], 10))) armyXP = parseInt(armyXPMatch[1], 10);
      if (navyXPMatch && !isNaN(parseInt(navyXPMatch[1], 10))) navyXP = parseInt(navyXPMatch[1], 10);
      if (airForceXPMatch && !isNaN(parseInt(airForceXPMatch[1], 10))) airForceXP = parseInt(airForceXPMatch[1], 10);
      if (intelligenceXPMatch && !isNaN(parseInt(intelligenceXPMatch[1], 10))) intelligenceXP = parseInt(intelligenceXPMatch[1], 10);
    }

    // Extract assigned generals - look for pattern like "Assigned Generals: Air Force XP Level 101, Army XP Level 25"
    let hasAssignedGenerals = false;
    let assignedGenerals: string | undefined;

    const assignedGeneralsMatch = text.match(/Assigned Generals:\s*([^\n]+)/i);
    if (assignedGeneralsMatch) {
      const generalsText = assignedGeneralsMatch[1].trim();
      if (generalsText && generalsText.toLowerCase() !== 'none') {
        hasAssignedGenerals = true;
        assignedGenerals = generalsText;
      }
    }

    return {
      nationName,
      totalMoney,
      armyXP,
      navyXP,
      airForceXP,
      intelligenceXP,
      hasAssignedGenerals,
      assignedGenerals,
    };
  } catch (error) {
    console.error('Error parsing spy operation text:', error);
    return null;
  }
}

/**
 * Find nation by name (case-insensitive)
 */
export async function findNationByName(nationName: string): Promise<number | null> {
  try {
    const nation = await prisma.nation.findFirst({
      where: {
        nationName: {
          equals: nationName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    return nation?.id ?? null;
  } catch (error) {
    console.error('Error finding nation by name:', error);
    return null;
  }
}

/**
 * Create a warchest submission
 */
export async function createWarchestSubmission(
  nationName: string,
  totalMoney: number,
  capturedAt: Date = new Date(),
  armyXP?: number,
  navyXP?: number,
  airForceXP?: number,
  intelligenceXP?: number,
  hasAssignedGenerals: boolean = false,
  assignedGenerals?: string
): Promise<{ id: number; nationId: number | null }> {
  // Try to find the nation
  const nationId = await findNationByName(nationName);

  const submission = await prisma.warchestSubmission.create({
    data: {
      nationName,
      totalMoney,
      capturedAt,
      nationId,
      armyXP,
      navyXP,
      airForceXP,
      intelligenceXP,
      hasAssignedGenerals,
      assignedGenerals,
    },
  });

  return {
    id: submission.id,
    nationId: submission.nationId,
  };
}

/**
 * Get all warchest submissions with optional filters
 */
export async function getWarchestSubmissions(options?: {
  nationId?: number;
  nationName?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (options?.nationId) {
    where.nationId = options.nationId;
  }

  if (options?.nationName) {
    where.nationName = {
      contains: options.nationName,
      mode: 'insensitive',
    };
  }

  const [submissions, total] = await Promise.all([
    prisma.warchestSubmission.findMany({
      where,
      include: {
        nation: {
          select: {
            id: true,
            nationName: true,
            rulerName: true,
            alliance: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        capturedAt: 'desc',
      },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    }),
    prisma.warchestSubmission.count({ where }),
  ]);

  return {
    submissions,
    total,
  };
}

