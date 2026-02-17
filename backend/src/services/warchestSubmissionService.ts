import { prisma } from '../utils/prisma.js';

export interface ParsedWarchestData {
  nationName: string;
  totalMoney: number;
}

/**
 * Parse spy operation text to extract nation name and total money
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

    return {
      nationName,
      totalMoney,
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
  capturedAt: Date = new Date()
): Promise<{ id: number; nationId: number | null }> {
  // Try to find the nation
  const nationId = await findNationByName(nationName);

  const submission = await prisma.warchestSubmission.create({
    data: {
      nationName,
      totalMoney,
      capturedAt,
      nationId,
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

