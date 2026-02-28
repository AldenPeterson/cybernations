import { prisma } from '../utils/prisma.js';
import { UserRole } from '@prisma/client';

/**
 * Get capability names for a role from the database.
 */
export async function getCapabilitiesForRole(role: UserRole): Promise<string[]> {
  const rows = await prisma.roleCapability.findMany({
    where: { role },
    select: { capability: { select: { name: true } } },
  });
  return rows.map((r) => r.capability.name);
}
