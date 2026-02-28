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

/**
 * Get capability names for multiple roles (union, deduplicated).
 */
export async function getCapabilitiesForRoles(roles: UserRole[]): Promise<string[]> {
  if (roles.length === 0) return [];
  const rows = await prisma.roleCapability.findMany({
    where: { role: { in: roles } },
    select: { capability: { select: { name: true } } },
  });
  const names = new Set(rows.map((r) => r.capability.name));
  return Array.from(names);
}
