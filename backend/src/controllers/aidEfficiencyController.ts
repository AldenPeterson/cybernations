import { Request, Response } from 'express';

export class AidEfficiencyController {
  /**
   * Get aid efficiency data for all alliances
   * Returns historical snapshots of aid utilization percentages
   */
  static async getAidEfficiency(req: Request, res: Response) {
    try {
      const { prisma } = await import('../utils/prisma.js');
      
      // Get all aid efficiency snapshots, ordered by date and alliance
      const snapshots = await prisma.allianceAidUtilizationSnapshot.findMany({
        orderBy: [
          { snapshotDate: 'asc' },
          { allianceId: 'asc' }
        ]
      });

      // Group by alliance to create time series data
      const allianceDataMap = new Map<number, {
        allianceId: number;
        allianceName: string;
        dataPoints: Array<{
          date: string;
          efficiency: number;
          totalAidOffers: number;
          totalNations: number;
        }>;
      }>();

      snapshots.forEach(snapshot => {
        if (!allianceDataMap.has(Number(snapshot.allianceId))) {
          allianceDataMap.set(Number(snapshot.allianceId), {
            allianceId: Number(snapshot.allianceId),
            allianceName: snapshot.allianceName,
            dataPoints: []
          });
        }

        const allianceData = allianceDataMap.get(Number(snapshot.allianceId))!;
        allianceData.dataPoints.push({
          date: snapshot.snapshotDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
          efficiency: Number(snapshot.aidUtilizationPercent),
          totalAidOffers: snapshot.totalAidOffers,
          totalNations: snapshot.totalNations
        });
      });

      // Helper function to calculate rolling average
      // Uses the last X datapoints (where X is the number of days)
      // If there are fewer than X datapoints, uses all available datapoints
      const calculateRollingAverage = (
        dataPoints: Array<{ date: string; efficiency: number }>,
        days: number
      ): number | null => {
        if (dataPoints.length === 0) return null;

        // Sort datapoints by date (most recent first)
        const sortedPoints = dataPoints
          .map(point => ({
            ...point,
            dateObj: new Date(point.date)
          }))
          .filter(point => !isNaN(point.dateObj.getTime()))
          .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

        if (sortedPoints.length === 0) return null;

        // Take the last N datapoints (where N is the number of days)
        // If there are fewer than N datapoints, use all available
        const pointsToUse = sortedPoints.slice(0, Math.min(days, sortedPoints.length));

        if (pointsToUse.length === 0) return null;

        // Calculate average efficiency
        const sum = pointsToUse.reduce((acc, point) => acc + point.efficiency, 0);
        return sum / pointsToUse.length;
      };

      // Convert map to array and get latest efficiency for each alliance
      const allianceEfficiencyData = Array.from(allianceDataMap.values()).map(alliance => {
        // Get the most recent data point for current efficiency
        const latestDataPoint = alliance.dataPoints[alliance.dataPoints.length - 1];
        
        // Calculate rolling averages
        const avg30 = calculateRollingAverage(
          alliance.dataPoints.map(p => ({ date: p.date, efficiency: p.efficiency })),
          30
        );
        const avg60 = calculateRollingAverage(
          alliance.dataPoints.map(p => ({ date: p.date, efficiency: p.efficiency })),
          60
        );
        const avg90 = calculateRollingAverage(
          alliance.dataPoints.map(p => ({ date: p.date, efficiency: p.efficiency })),
          90
        );
        
        return {
          allianceId: alliance.allianceId,
          allianceName: alliance.allianceName,
          currentEfficiency: latestDataPoint ? latestDataPoint.efficiency : 0,
          currentTotalAidOffers: latestDataPoint ? latestDataPoint.totalAidOffers : 0,
          currentTotalNations: latestDataPoint ? latestDataPoint.totalNations : 0,
          avg30Days: avg30,
          avg60Days: avg60,
          avg90Days: avg90,
          timeSeries: alliance.dataPoints
        };
      });

      // Sort by current efficiency (descending)
      allianceEfficiencyData.sort((a, b) => b.currentEfficiency - a.currentEfficiency);

      console.log(`[API] getAidEfficiency: Returning ${allianceEfficiencyData.length} alliances with efficiency data`);

      res.json({
        success: true,
        data: allianceEfficiencyData
      });
    } catch (error) {
      console.error('Error fetching aid efficiency data:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

