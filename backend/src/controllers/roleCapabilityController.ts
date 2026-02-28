import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { UserRole } from '@prisma/client';

const VALID_ROLES = Object.values(UserRole);

function parseRole(roleParam: string): UserRole | null {
  if (VALID_ROLES.includes(roleParam as UserRole)) {
    return roleParam as UserRole;
  }
  return null;
}

export class RoleCapabilityController {
  /**
   * List all capabilities (id and name). Requires manage_users.
   */
  static async listCapabilities(req: Request, res: Response) {
    try {
      const capabilities = await prisma.capability.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true },
      });
      res.json({ success: true, capabilities });
    } catch (error) {
      console.error('Error listing capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get capability IDs for a role. Requires manage_users.
   */
  static async getRoleCapabilities(req: Request, res: Response) {
    try {
      const role = parseRole(req.params.role);
      if (!role) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role',
        });
      }
      const rows = await prisma.roleCapability.findMany({
        where: { role },
        select: { capabilityId: true, capability: { select: { name: true } } },
      });
      const capabilityIds = rows.map((r) => r.capabilityId);
      const capabilityNames = rows.map((r) => r.capability.name);
      res.json({
        success: true,
        role,
        capabilityIds,
        capabilityNames,
      });
    } catch (error) {
      console.error('Error getting role capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Set capabilities for a role. Body: { capabilityIds: number[] }. Requires manage_users.
   */
  static async setRoleCapabilities(req: Request, res: Response) {
    try {
      const role = parseRole(req.params.role);
      if (!role) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role',
        });
      }
      const { capabilityIds } = req.body;
      if (!Array.isArray(capabilityIds)) {
        return res.status(400).json({
          success: false,
          error: 'capabilityIds must be an array',
        });
      }
      const ids = capabilityIds.filter((id: unknown) => typeof id === 'number' && Number.isInteger(id));
      const existing = await prisma.capability.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const validIds = existing.map((c) => c.id);
      await prisma.roleCapability.deleteMany({ where: { role } });
      if (validIds.length > 0) {
        await prisma.roleCapability.createMany({
          data: validIds.map((capabilityId) => ({ role, capabilityId })),
          skipDuplicates: true,
        });
      }
      const capabilityNames = await prisma.roleCapability.findMany({
        where: { role },
        select: { capability: { select: { name: true } } },
      }).then((rows) => rows.map((r) => r.capability.name));
      res.json({
        success: true,
        role,
        capabilityIds: validIds,
        capabilityNames,
      });
    } catch (error) {
      console.error('Error setting role capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
