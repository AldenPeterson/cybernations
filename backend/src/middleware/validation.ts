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
 * Validates slots data structure - only validates fields that are present
 */
export const validateSlots = (req: Request, res: Response, next: NextFunction) => {
  const { slots } = req.body;
  
  if (slots) {
    // Only validate fields that are present
    if (slots.sendTech !== undefined && typeof slots.sendTech !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid sendTech value. Must be a number'
      });
    }
    if (slots.sendCash !== undefined && typeof slots.sendCash !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid sendCash value. Must be a number'
      });
    }
    if (slots.getTech !== undefined && typeof slots.getTech !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid getTech value. Must be a number'
      });
    }
    if (slots.getCash !== undefined && typeof slots.getCash !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid getCash value. Must be a number'
      });
    }
    
    // Validate priority fields if they exist
    if (slots.send_priority !== undefined) {
      const sendPriority = typeof slots.send_priority === 'string' ? parseInt(slots.send_priority) : slots.send_priority;
      if (isNaN(sendPriority) || sendPriority < 1 || sendPriority > 3) {
        return res.status(400).json({
          success: false,
          error: 'Invalid send_priority value. Must be 1, 2, or 3'
        });
      }
    }
    
    if (slots.receive_priority !== undefined) {
      const receivePriority = typeof slots.receive_priority === 'string' ? parseInt(slots.receive_priority) : slots.receive_priority;
      if (isNaN(receivePriority) || receivePriority < 1 || receivePriority > 3) {
        return res.status(400).json({
          success: false,
          error: 'Invalid receive_priority value. Must be 1, 2, or 3'
        });
      }
    }
  }
  
  next();
};