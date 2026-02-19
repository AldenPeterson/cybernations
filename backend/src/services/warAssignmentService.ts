import { isWarExpired } from '../utils/dateUtils.js';
import { StaggerEligibilityService } from './staggerEligibilityService.js';

interface CreateAssignmentInput {
  allianceId: number;
  attackerNationId: number;
  defenderNationId: number;
  assignmentDate: string; // YYYY-MM-DD
  note?: string;
  createdByUserId: number;
}

export interface WarAssignmentDto {
  id: number;
  assignmentDate: string; // YYYY-MM-DD
  note?: string | null;
  isOutOfRange: boolean;
  attackerNation: {
    id: number;
    name: string;
    rulerName: string;
    alliance: string;
    allianceId: number;
  };
  defenderNation: {
    id: number;
    name: string;
    rulerName: string;
    alliance: string;
    allianceId: number;
  };
  assignedBy: {
    id: number;
    email: string;
    rulerName: string | null;
  };
}

const toYmd = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isDateOutOfRange = (date: Date): boolean => {
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const targetUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  // Out of range once the assignment date is before today
  return targetUtc < todayUtc;
};

/**
 * Check if attacker is still in range based on stagger eligibility logic
 * Uses the shared StaggerEligibilityService method to ensure consistency
 */
const isAttackerOutOfRange = (attacker: any, defender: any): boolean => {
  // Use the shared eligibility check (without sell-down since we're checking current state)
  const isEligible = StaggerEligibilityService.isAttackerEligibleForDefender(
    attacker,
    defender,
    false, // Don't consider sell-down for assignment validation
    0,     // No military NS adjustment
    undefined // No need for all nations list
  );
  
  // Attacker is out of range if not eligible
  return !isEligible;
};

const mapAssignmentToDto = (assignment: any): WarAssignmentDto => {
  const assignmentDate: Date = assignment.assignmentDate;
  const attacker = assignment.attackerNation;
  const defender = assignment.defenderNation;
  const user = assignment.createdByUser;

  // Check both date and range eligibility
  const dateOutOfRange = isDateOutOfRange(assignmentDate);
  const attackerOutOfRange = isAttackerOutOfRange(attacker, defender);
  const isOutOfRange = dateOutOfRange || attackerOutOfRange;

  return {
    id: assignment.id,
    assignmentDate: toYmd(assignmentDate),
    note: assignment.note,
    isOutOfRange,
    attackerNation: {
      id: attacker.id,
      name: attacker.nationName,
      rulerName: attacker.rulerName,
      alliance: attacker.alliance.name,
      allianceId: attacker.allianceId,
    },
    defenderNation: {
      id: defender.id,
      name: defender.nationName,
      rulerName: defender.rulerName,
      alliance: defender.alliance.name,
      allianceId: defender.allianceId,
    },
    assignedBy: {
      id: user.id,
      email: user.email,
      rulerName: user.rulerName,
    },
  };
};

async function hasActiveWarBetween(
  nationAId: number,
  nationBId: number
): Promise<boolean> {
  const { prisma } = await import('../utils/prisma.js');
  const wars = await prisma.war.findMany({
    where: {
      isActive: true,
      status: {
        notIn: ['Ended', 'Peace'],
      },
      OR: [
        {
          declaringNationId: nationAId,
          receivingNationId: nationBId,
        },
        {
          declaringNationId: nationBId,
          receivingNationId: nationAId,
        },
      ],
    },
    select: {
      warId: true,
      endDate: true,
    },
  });

  return wars.some((war) => {
    try {
      return !isWarExpired(war.endDate);
    } catch {
      return false;
    }
  });
}

export class WarAssignmentService {
  static async createAssignment(input: CreateAssignmentInput): Promise<WarAssignmentDto> {
    const { prisma } = await import('../utils/prisma.js');
    const {
      allianceId,
      attackerNationId,
      defenderNationId,
      assignmentDate,
      note,
      createdByUserId,
    } = input;

    if (attackerNationId === defenderNationId) {
      throw new Error('Attacker and defender must be different nations');
    }

    // Validate defender nation belongs to the specified alliance (or has targeting override)
    const defender = await prisma.nation.findUnique({
      where: { id: defenderNationId },
      include: { alliance: true },
    });
    if (!defender || !defender.isActive) {
      throw new Error('Defender nation not found or inactive');
    }
    const effectiveAllianceId = defender.targetingAllianceId || defender.allianceId;
    if (effectiveAllianceId !== allianceId) {
      throw new Error('Defender nation does not belong to this alliance');
    }

    // Validate attacker nation exists
    const attacker = await prisma.nation.findUnique({
      where: { id: attackerNationId },
      include: { alliance: true },
    });
    if (!attacker || !attacker.isActive) {
      throw new Error('Attacker nation not found or inactive');
    }

    // Parse assignment date (expecting YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(assignmentDate)) {
      throw new Error('Invalid assignment date format, expected YYYY-MM-DD');
    }
    const date = new Date(`${assignmentDate}T00:00:00Z`);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid assignment date');
    }

    // Ensure there is no active war between the nations
    if (await hasActiveWarBetween(attackerNationId, defenderNationId)) {
      throw new Error('There is already an active war between these nations');
    }

    const created = await prisma.warAssignment.create({
      data: {
        attackerNationId,
        defenderNationId,
        assignmentDate: date,
        note: note ?? null,
        createdByUserId,
      },
      include: {
        attackerNation: {
          include: { alliance: true },
        },
        defenderNation: {
          include: { alliance: true },
        },
        createdByUser: true,
      },
    });

    return mapAssignmentToDto(created);
  }

  static async listActiveAssignmentsForAlliance(
    allianceId: number
  ): Promise<WarAssignmentDto[]> {
    const { prisma } = await import('../utils/prisma.js');
    // Load all non-archived assignments where defender belongs to this alliance
    // OR has targeting alliance override set to this alliance
    const assignments = await prisma.warAssignment.findMany({
      where: {
        archivedAt: null,
        defenderNation: {
          OR: [
            { allianceId },
            { targetingAllianceId: allianceId }
          ],
          isActive: true,
        },
      },
      include: {
        attackerNation: {
          include: { alliance: true },
        },
        defenderNation: {
          include: { alliance: true },
        },
        createdByUser: true,
      },
    });

    const toArchiveIds: number[] = [];
    const activeAssignments: any[] = [];

    // Partition into those that now have an active war (to archive) vs still active
    for (const assignment of assignments) {
      const attackerId = assignment.attackerNationId;
      const defenderId = assignment.defenderNationId;

      if (await hasActiveWarBetween(attackerId, defenderId)) {
        toArchiveIds.push(assignment.id);
      } else {
        activeAssignments.push(assignment);
      }
    }

    if (toArchiveIds.length > 0) {
      await prisma.warAssignment.updateMany({
        where: { id: { in: toArchiveIds } },
        data: { archivedAt: new Date() },
      });
    }

    return activeAssignments.map(mapAssignmentToDto);
  }

  static async deleteAssignment(assignmentId: number, allianceId: number): Promise<void> {
    const { prisma } = await import('../utils/prisma.js');
    
    // Verify the assignment exists and belongs to the alliance
    const assignment = await prisma.warAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        defenderNation: {
          include: { alliance: true },
        },
      },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const effectiveAllianceId = assignment.defenderNation.targetingAllianceId || assignment.defenderNation.allianceId;
    if (effectiveAllianceId !== allianceId) {
      throw new Error('Assignment does not belong to this alliance');
    }

    // Delete the assignment
    await prisma.warAssignment.delete({
      where: { id: assignmentId },
    });
  }
}


