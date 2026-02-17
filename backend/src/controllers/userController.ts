import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { UserRole } from '@prisma/client';

export class UserController {
  /**
   * Get all users
   * Only accessible by ADMIN users
   */
  static async getAllUsers(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          rulerName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          managedAlliances: {
            select: {
              allianceId: true,
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
          createdAt: 'desc',
        },
      });

      // Transform the data to include managedAllianceIds
      const usersWithAllianceIds = users.map((user) => ({
        id: user.id,
        email: user.email,
        rulerName: user.rulerName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        managedAllianceIds: user.managedAlliances.map((ma) => ma.allianceId),
      }));

      res.json({
        success: true,
        users: usersWithAllianceIds,
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
      });
    }
  }

  /**
   * Update a user
   * Only accessible by ADMIN users
   */
  static async updateUser(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
      }

      const { email, rulerName, role, managedAllianceIds } = req.body;

      // Validate role if provided
      if (role && !Object.values(UserRole).includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role',
        });
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Prepare update data
      const updateData: any = {};
      if (email !== undefined) updateData.email = email;
      if (rulerName !== undefined) updateData.rulerName = rulerName || null; // Allow clearing rulerName
      if (role !== undefined) updateData.role = role;

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          rulerName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Update managed alliances if provided
      if (managedAllianceIds !== undefined) {
        // Delete existing managed alliances
        await prisma.userAllianceManager.deleteMany({
          where: { userId },
        });

        // Create new managed alliances
        if (Array.isArray(managedAllianceIds) && managedAllianceIds.length > 0) {
          await prisma.userAllianceManager.createMany({
            data: managedAllianceIds.map((allianceId: number) => ({
              userId,
              allianceId,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Fetch updated user with managed alliances
      const userWithAlliances = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          rulerName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          managedAlliances: {
            select: {
              allianceId: true,
            },
          },
        },
      });

      res.json({
        success: true,
        user: {
          id: userWithAlliances!.id,
          email: userWithAlliances!.email,
          rulerName: userWithAlliances!.rulerName,
          role: userWithAlliances!.role,
          createdAt: userWithAlliances!.createdAt,
          updatedAt: userWithAlliances!.updatedAt,
          managedAllianceIds: userWithAlliances!.managedAlliances.map(
            (ma) => ma.allianceId
          ),
        },
      });
    } catch (error: any) {
      console.error('Error updating user:', error);
      
      // Handle unique constraint violations
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'field';
        return res.status(400).json({
          success: false,
          error: `${field} already exists`,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update user',
      });
    }
  }
}

