import { Request, Response, NextFunction } from 'express';
import { hasCapability } from '../services/authService.js';

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

export interface RequireCapabilityOptions {
  paramKey?: string;
}

/**
 * Middleware to require that the user has the given capability.
 * Must be used after requireAuth so req.session.userId exists.
 * For scoped capabilities (e.g. manage_alliance), set paramKey to the route param name (e.g. 'allianceId').
 */
export const requireCapability = (
  capability: string,
  options?: RequireCapabilityOptions
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }
      const userId = req.session.userId;
      let allowed: boolean;
      if (options?.paramKey != null) {
        const raw = req.params[options.paramKey];
        const allianceId = raw != null ? parseInt(String(raw), 10) : NaN;
        if (isNaN(allianceId)) {
          return res.status(400).json({
            success: false,
            error: `Invalid ${options.paramKey}`,
          });
        }
        allowed = await hasCapability(userId, capability, { allianceId });
      } else {
        allowed = await hasCapability(userId, capability);
      }
      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
      }
      next();
    } catch (error) {
      console.error('Error in requireCapability middleware:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during authorization check',
      });
    }
  };
};
