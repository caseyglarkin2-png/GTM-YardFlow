import { featureFlags } from '@/config/featureFlags';

export interface EmailStatsData {
  period: {
    start: string;
    end: string;
  };
  totals: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    meeting: number; 
  };
  timeline: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
  }>;
}

export class EmailStatsService {
  /**
   * Fetch aggregated email statistics for the dashboard
   */
  async getStats(period: '7d' | '30d' = '7d'): Promise<EmailStatsData> {
    // Calculate dates
    const end = new Date();
    const start = new Date();
    const days = period === '7d' ? 7 : 30;
    start.setDate(end.getDate() - days);

    // Call the API endpoint
    // We use the existing /api/email/stats endpoint which presumably handles aggregation
    const params = new URLSearchParams({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      groupBy: 'day'
    });

    try {
      const response = await fetch(`/api/email/stats?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch email stats: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Ensure the data shape matches what UI expects, especially 'meeting' count if not in API
      // The API response might not have 'meeting' in totals yet, so we default to 0
      return {
        ...data,
        totals: {
          ...data.totals,
          meeting: data.totals.meeting || 0
        }
      };
    } catch (error) {
      console.error('EmailStatsService.getStats error:', error);
      // Return empty structure on error to prevent UI crash
      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        totals: { sent: 0, opened: 0, clicked: 0, replied: 0, meeting: 0 },
        timeline: []
      };
    }
  }
}

export const emailStatsService = new EmailStatsService();
