import { Request, Response, NextFunction } from 'express';
import { getUserRole, isAllianceManager } from '../services/authService.js';
import { UserRole } from '@prisma/client';

/**
 * Middleware to require that the user is authenticated.
 * Checks if req.session.userId exists.
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
};

/**
 * Middleware to require that the user has one of the specified roles.
 * Must be used after requireAuth middleware to ensure req.session.userId exists.
 * 
 * @param allowedRoles - Array of UserRole values that are allowed to access the route
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // This should never happen if requireAuth is used first, but check anyway
      if (!req.session.userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = req.session.userId;
      const userRole = await getUserRole(userId);

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      console.error('Error in requireRole middleware:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during authorization check'
      });
    }
  };
};

/**
 * Middleware to require that the user is authenticated and is either:
 * - An ADMIN, or
 * - An alliance manager for the alliance specified in req.params.allianceId
 * 
 * This middleware should be used after validateAllianceId middleware
 * to ensure allianceId is already validated.
 */
export const requireAllianceManagerFromRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userId = req.session.userId;
    const allianceId = parseInt(req.params.allianceId);

    // Validate allianceId (should already be validated by validateAllianceId middleware, but double-check)
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    // Check if user is an admin
    const userRole = await getUserRole(userId);
    if (userRole === UserRole.ADMIN) {
      return next();
    }

    // Check if user is an alliance manager for this alliance
    const canManage = await isAllianceManager(userId, allianceId);
    if (!canManage) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage this alliance'
      });
    }

    // User has permission, continue
    next();
  } catch (error) {
    console.error('Error in requireAllianceManagerFromRequest middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during authorization check'
    });
  }
};
