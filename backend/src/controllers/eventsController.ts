import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

// Cache for events queries
interface EventsCache {
  data: {
    events: any[];
    total: number;
    limit: number;
    offset: number;
  };
  timestamp: number;
}

// Cache keyed by query parameters (stringified)
const eventsCache = new Map<string, EventsCache>();
const EVENTS_CACHE_TTL_MS = 300000; // 5 minutes cache TTL

/**
 * Generate a cache key from query parameters
 */
function getCacheKey(params: any): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return sortedParams;
}

/**
 * Clear expired cache entries
 */
function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, cache] of eventsCache.entries()) {
    if (now - cache.timestamp >= EVENTS_CACHE_TTL_MS) {
      eventsCache.delete(key);
    }
  }
}

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
      const minStrength = req.query.minStrength ? parseInt(req.query.minStrength as string) : undefined;

      // Build cache key from query parameters
      const cacheParams: any = {
        type: type || 'all',
        eventType: eventType || 'all',
        limit,
        offset,
        nationId: nationId || 'all',
        allianceId: allianceId || 'all',
        minStrength: minStrength || 'all',
      };
      const cacheKey = getCacheKey(cacheParams);

      // Check cache first
      const now = Date.now();
      const cached = eventsCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < EVENTS_CACHE_TTL_MS) {
        console.log('Returning cached events');
        return res.json({
          success: true,
          ...cached.data,
        });
      }

      // Clear expired cache entries periodically
      if (eventsCache.size > 100) {
        clearExpiredCache();
      }

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
      
      // For alliance filtering, we need special handling for alliance_change events
      // which should match if either the old or new alliance matches
      let finalWhere = where;
      if (allianceId && !isNaN(allianceId)) {
        // For alliance filtering:
        // 1. Events with allianceId matching (for alliance events)
        // 2. Nation events where the nation's allianceId matches
        // 3. Alliance change events - we'll fetch all and filter in memory
        finalWhere = {
          ...where,
          OR: [
            // Regular events: match by allianceId field
            { allianceId: allianceId },
            // Nation events: match by nation's allianceId
            {
              AND: [
                { type: 'nation' },
                { nation: { allianceId: allianceId } },
              ],
            },
            // Include all alliance_change events - we'll filter in memory
            { eventType: 'alliance_change' },
          ],
        };
      }

      // Fetch events - fetch more if alliance filtering to account for in-memory filtering
      const fetchLimit = (allianceId && !isNaN(allianceId)) ? limit * 3 : limit;
      let events = await prisma.event.findMany({
        where: finalWhere,
        include: {
          nation: {
            select: {
              id: true,
              rulerName: true,
              nationName: true,
              allianceId: true,
              strength: true,
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
        take: fetchLimit,
        skip: offset,
      });

      // Filter alliance_change events in memory if alliance filter is active
      if (allianceId && !isNaN(allianceId)) {
        events = events.filter(event => {
          if (event.eventType === 'alliance_change' && event.metadata) {
            const metadata = event.metadata as any;
            const oldAllianceId = metadata?.oldAllianceId;
            const newAllianceId = metadata?.newAllianceId;
            return oldAllianceId === allianceId || newAllianceId === allianceId;
          }
          return true; // Keep other events that passed Prisma filter
        });
      }

      // Filter by minimum strength if specified
      if (minStrength !== undefined && !isNaN(minStrength)) {
        events = events.filter(event => {
          // For nation events, check the nation's strength
          if (event.nation && event.nation.strength !== null) {
            return event.nation.strength >= minStrength;
          }
          // For alliance_change events, check strength from metadata
          if (event.eventType === 'alliance_change' && event.metadata) {
            const metadata = event.metadata as any;
            const strength = metadata?.strength;
            return strength !== undefined && strength >= minStrength;
          }
          // For other events without nation data, include them (shouldn't happen for nation events)
          return true;
        });
      }

      // Apply final limit after filtering
      const paginatedEvents = events.slice(0, limit);

      // Count total - for alliance filtering or strength filtering, we need to count all matching events
      let totalCount = 0;
      if (allianceId && !isNaN(allianceId) || (minStrength !== undefined && !isNaN(minStrength))) {
        // Fetch all matching events for accurate count (with reasonable limit)
        const countWhere: any = { ...where };
        if (allianceId && !isNaN(allianceId)) {
          countWhere.OR = [
            { allianceId: allianceId },
            {
              AND: [
                { type: 'nation' },
                { nation: { allianceId: allianceId } },
              ],
            },
            { eventType: 'alliance_change' },
          ];
        }
        
        const allEvents = await prisma.event.findMany({
          where: countWhere,
          select: { 
            id: true, 
            eventType: true, 
            metadata: true, 
            nation: { 
              select: { 
                strength: true 
              } 
            } 
          },
          take: 10000, // Reasonable limit for counting
        });
        
        // Filter in memory
        let filtered = allEvents;
        
        // Filter alliance_change events in memory
        if (allianceId && !isNaN(allianceId)) {
          filtered = filtered.filter(event => {
            if (event.eventType === 'alliance_change' && event.metadata) {
              const metadata = event.metadata as any;
              const oldAllianceId = metadata?.oldAllianceId;
              const newAllianceId = metadata?.newAllianceId;
              return oldAllianceId === allianceId || newAllianceId === allianceId;
            }
            return true;
          });
        }
        
        // Filter by minimum strength
        if (minStrength !== undefined && !isNaN(minStrength)) {
          filtered = filtered.filter(event => {
            // For nation events, check the nation's strength
            if (event.nation && event.nation.strength !== null) {
              return event.nation.strength >= minStrength;
            }
            // For alliance_change events, check strength from metadata
            if (event.eventType === 'alliance_change' && event.metadata) {
              const metadata = event.metadata as any;
              const strength = metadata?.strength;
              return strength !== undefined && strength >= minStrength;
            }
            // For other events without nation data, include them
            return true;
          });
        }
        
        totalCount = filtered.length;
      } else {
        totalCount = await prisma.event.count({ where });
      }

      const responseData = {
        events: paginatedEvents,
        total: totalCount,
        limit,
        offset,
      };

      // Update cache
      eventsCache.set(cacheKey, {
        data: responseData,
        timestamp: now,
      });

      res.json({
        success: true,
        ...responseData,
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

