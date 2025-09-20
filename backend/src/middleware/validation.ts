import { Request, Response, NextFunction } from 'express';

/**
 * Validates that allianceId parameter is a valid number
 */
export const validateAllianceId = (req: Request, res: Response, next: NextFunction) => {
  const allianceId = parseInt(req.params.allianceId);
  
  if (isNaN(allianceId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid alliance ID'
    });
  }
  
  next();
};

/**
 * Validates that nationId parameter is a valid number
 */
export const validateNationId = (req: Request, res: Response, next: NextFunction) => {
  const nationId = parseInt(req.params.nationId);
  
  if (isNaN(nationId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid nation ID'
    });
  }
  
  next();
};

/**
 * Validates slots data structure
 */
export const validateSlots = (req: Request, res: Response, next: NextFunction) => {
  const { slots } = req.body;
  
  if (slots && (
    typeof slots.sendTech !== 'number' ||
    typeof slots.sendCash !== 'number' ||
    typeof slots.getTech !== 'number' ||
    typeof slots.getCash !== 'number'
  )) {
    return res.status(400).json({
      success: false,
      error: 'Invalid slots data structure'
    });
  }
  
  next();
};