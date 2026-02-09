// Simple in-memory cache with TTL for war statistics
// For production, consider Redis for multi-instance deployments

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class WarStatisticsCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[Cache HIT] ${key} (age: ${Math.round((now - entry.timestamp) / 1000)}s)`);
    return entry.data as T;
  }

  /**
   * Set cache data with optional custom TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
    console.log(`[Cache SET] ${key} (TTL: ${(ttl || this.defaultTTL) / 1000}s)`);
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key: string): void {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`[Cache INVALIDATE] ${key}`);
    }
  }

  /**
   * Invalidate all war statistics caches
   */
  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[Cache INVALIDATE ALL] Cleared ${size} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired entries (run periodically)
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache CLEANUP] Removed ${cleaned} expired entries`);
    }
  }
}

// Singleton instance
export const warStatsCache = new WarStatisticsCache();

// Run cleanup every 10 minutes
setInterval(() => {
  warStatsCache.cleanup();
}, 10 * 60 * 1000);

// Cache key builders
export const CacheKeys = {
  allianceTotals: (filter?: string) => 
    filter ? `alliance_totals:${filter.toLowerCase()}` : 'alliance_totals',
  
  nationBreakdown: (filter?: string) => 
    filter ? `nation_breakdown:${filter.toLowerCase()}` : 'nation_breakdown',
  
  warRecords: (filter?: string) => 
    filter ? `war_records:${filter.toLowerCase()}` : 'war_records',
  
  opponentBreakdown: () => 'opponent_breakdown',
};

