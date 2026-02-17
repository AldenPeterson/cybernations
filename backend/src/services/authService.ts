import { prisma } from '../utils/prisma.js';
import { UserRole } from '@prisma/client';

export interface GoogleProfile {
  sub: string; // Google ID
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Find existing user or create new one from Google profile
 */
export async function findOrCreateUser(profile: GoogleProfile) {
  const { sub: googleId, email } = profile;

  // Try to find existing user
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { googleId },
    });
  } catch (error: any) {
    console.error('Error finding user by googleId:', error.message);
    throw error;
  }

  // If user doesn't exist, create new one
  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          googleId,
          email,
          // rulerName is not set - will be manually configured
          role: UserRole.USER,
        },
      });
    } catch (error) {
      console.error('Error creating user:', error);
      // If creation fails due to unique constraint (email or rulerName), try to find by email
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        user = await prisma.user.findUnique({
          where: { email },
        });
        if (user) {
          // Update googleId if it was missing
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId },
            });
          }
        } else {
          throw error; // Re-throw if we can't find or create
        }
      } else {
        throw error; // Re-throw other errors
      }
    }
  } else {
    // Update email if it changed (rulerName is manually set, don't update from Google)
    if (user.email !== email) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email },
      });
    }
  }

  return user;
}

/**
 * Get user role from database
 */
export async function getUserRole(userId: number): Promise<UserRole> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user.role;
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

