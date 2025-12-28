import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

export class EventsController {
  /**
   * Get all events with optional filtering
   * GET /api/events?type=nation&eventType=new_nation&limit=100&offset=0
   */
  static async getEvents(req: Request, res: Response) {
    try {
      const type = req.query.type as string | undefined;
      const eventType = req.query.eventType as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const nationId = req.query.nationId ? parseInt(req.query.nationId as string) : undefined;
      const allianceId = req.query.allianceId ? parseInt(req.query.allianceId as string) : undefined;

      const where: any = {};
      
      if (type) {
        where.type = type;
      }
      
      if (eventType) {
        where.eventType = eventType;
      }
      
      if (nationId && !isNaN(nationId)) {
        where.nationId = nationId;
      }
      
      if (allianceId && !isNaN(allianceId)) {
        where.allianceId = allianceId;
      }

      const [events, total] = await Promise.all([
        prisma.event.findMany({
          where,
          include: {
            nation: {
              select: {
                id: true,
                rulerName: true,
                nationName: true,
                allianceId: true,
                alliance: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            alliance: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        prisma.event.count({ where }),
      ]);

      res.json({
        success: true,
        events,
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error fetching events:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch events',
      });
    }
  }
}

