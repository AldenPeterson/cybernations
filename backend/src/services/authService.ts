import { prisma } from '../utils/prisma.js';
import { UserRole } from '@prisma/client';
import { getCapabilitiesForRoles } from './capabilityService.js';

export interface DiscordProfile {
  id: string; // Discord snowflake
  username: string;
  global_name?: string | null;
}

/**
 * Find existing user by discordId or create a new one. Identity is keyed on
 * discordId; email is not requested from Discord.
 */
export async function findOrCreateUser(profile: DiscordProfile) {
  const { id: discordId, username, global_name } = profile;
  const discordUsername = global_name || username;

  const existing = await prisma.user.findUnique({ where: { discordId } });
  if (existing) {
    if (existing.discordUsername !== discordUsername) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { discordUsername },
      });
    }
    return existing;
  }

  return prisma.user.create({
    data: {
      discordId,
      discordUsername,
      roleAssignments: {
        create: [{ role: UserRole.USER }],
      },
    },
  });
}

/**
 * Get user roles from database
 */
export async function getUserRoles(userId: number): Promise<UserRole[]> {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId },
    select: { role: true },
  });
  return assignments.map((a) => a.role);
}

/**
 * Get list of alliance IDs user manages
 */
export async function getManagedAlliances(userId: number): Promise<number[]> {
  const managers = await prisma.userAllianceManager.findMany({
    where: { userId },
    select: { allianceId: true },
  });

  return managers.map((m) => m.allianceId);
}

/**
 * Check if user manages a specific alliance
 */
export async function isAllianceManager(
  userId: number,
  allianceId: number
): Promise<boolean> {
  const manager = await prisma.userAllianceManager.findUnique({
    where: {
      userId_allianceId: {
        userId,
        allianceId,
      },
    },
  });

  return !!manager;
}

/**
 * Add user as manager of alliance
 */
export async function addAllianceManager(
  userId: number,
  allianceId: number
): Promise<void> {
  await prisma.userAllianceManager.create({
    data: {
      userId,
      allianceId,
    },
  });
}

/**
 * Remove user as manager of alliance
 */
export async function removeAllianceManager(
  userId: number,
  allianceId: number
): Promise<void> {
  await prisma.userAllianceManager.delete({
    where: {
      userId_allianceId: {
        userId,
        allianceId,
      },
    },
  });
}

/**
 * Check if user has a capability. For unscoped capabilities, checks all roles' capabilities from DB.
 * For manage_alliance with allianceId, returns true if user has manage_all_alliance or is alliance manager for that alliance.
 */
export async function hasCapability(
  userId: number,
  capability: string,
  options?: { allianceId?: number }
): Promise<boolean> {
  const roles = await getUserRoles(userId);
  const roleCapabilities = await getCapabilitiesForRoles(roles);

  if (capability === 'manage_alliance' && options?.allianceId != null) {
    const allianceId = options.allianceId;
    if (roleCapabilities.includes('manage_all_alliance')) return true;
    if (roleCapabilities.includes('manage_alliance')) {
      return isAllianceManager(userId, allianceId);
    }
    return false;
  }

  return roleCapabilities.includes(capability);
}

/**
 * Get effective capabilities and managed alliance IDs for /me and UI.
 */
export async function getEffectiveCapabilities(userId: number): Promise<{
  capabilities: string[];
  managedAllianceIds: number[];
}> {
  const [roles, managedAllianceIds] = await Promise.all([
    getUserRoles(userId),
    getManagedAlliances(userId),
  ]);
  const capabilities = await getCapabilitiesForRoles(roles);
  return { capabilities, managedAllianceIds };
}

