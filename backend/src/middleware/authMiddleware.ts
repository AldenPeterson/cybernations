import { Request, Response, NextFunction } from 'express';
import {
  getUserRole,
  isAllianceManager,
  getManagedAlliances,
} from '../services/authService.js';
import { UserRole } from '@prisma/client';

// Extend Express Request type to include session
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    oauthState?: string;
  }
}

/**
 * Ensure user is authenticated
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }
  next();
}

/**
 * Ensure user has one of the specified roles
 */
export function requireRole(roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const userRole = await getUserRole(req.session.userId!);
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
      }
      next();
    } catch (error) {
      console.error('Error checking user role:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };
}

/**
 * Ensure user is manager of specific alliance
 * Admins can manage all alliances
 */
export function requireAllianceManager(allianceId: number | string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const userId = req.session.userId!;
      const allianceIdNum = typeof allianceId === 'string' ? parseInt(allianceId, 10) : allianceId;

      if (isNaN(allianceIdNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID',
        });
      }

      // Check if user is admin (admins can manage all alliances)
      const userRole = await getUserRole(userId);
      if (userRole === UserRole.ADMIN) {
        return next();
      }

      // Check if user manages this alliance
      const isManager = await isAllianceManager(userId, allianceIdNum);
      if (!isManager) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to manage this alliance',
        });
      }

      next();
    } catch (error) {
      console.error('Error checking alliance manager status:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };
}

/**
 * Helper to get alliance ID from request params or body
 */
export function getAllianceIdFromRequest(req: Request): number | null {
  // Try params first (e.g., /api/alliances/:allianceId/...)
  if (req.params.allianceId) {
    const id = parseInt(req.params.allianceId, 10);
    if (!isNaN(id)) return id;
  }

  // Try body
  if (req.body.allianceId) {
    const id = parseInt(req.body.allianceId, 10);
    if (!isNaN(id)) return id;
  }

  // Try query
  if (req.query.allianceId) {
    const id = parseInt(req.query.allianceId as string, 10);
    if (!isNaN(id)) return id;
  }

  return null;
}

/**
 * Middleware that extracts allianceId from request and checks manager status
 */
export function requireAllianceManagerFromRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const allianceId = getAllianceIdFromRequest(req);
  if (!allianceId) {
    return res.status(400).json({
      success: false,
      error: 'Alliance ID is required',
    });
  }

  return requireAllianceManager(allianceId)(req, res, next);
}

