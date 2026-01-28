/**
 * ActivityTracker - Sprint 17 (T17.5)
 * Tracks user activity for collaboration features
 */

export interface Activity {
  id: string;
  type: 'status_change' | 'message_drafted' | 'prospect_viewed' | 'comment_added';
  user: 'Me' | 'Jake';
  prospectId: string;
  prospectName: string;
  details: string;
  timestamp: number;
}

const STORAGE_KEY = 'yardflow_activity_log';
const MAX_ACTIVITIES = 50;

class ActivityTracker {
  private activities: Activity[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Track a new activity
   */
  track(activity: Omit<Activity, 'id' | 'timestamp'>): void {
    const newActivity: Activity = {
      ...activity,
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.activities.unshift(newActivity);

    // Keep only the most recent activities
    if (this.activities.length > MAX_ACTIVITIES) {
      this.activities = this.activities.slice(0, MAX_ACTIVITIES);
    }

    this.saveToStorage();
  }

  /**
   * Get recent activities
   */
  getRecent(count: number = 20): Activity[] {
    return this.activities.slice(0, count);
  }

  /**
   * Get activities for a specific prospect
   */
  getForProspect(prospectId: string): Activity[] {
    return this.activities.filter(a => a.prospectId === prospectId);
  }

  /**
   * Clear all activities
   */
  clear(): void {
    this.activities = [];
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.activities));
    } catch (e) {
      console.warn('Failed to save activity log:', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.activities = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load activity log:', e);
      this.activities = [];
    }
  }
}

// Singleton instance
let instance: ActivityTracker | null = null;

export function getActivityTracker(): ActivityTracker {
  if (!instance) {
    instance = new ActivityTracker();
  }
  return instance;
}

export { ActivityTracker };
