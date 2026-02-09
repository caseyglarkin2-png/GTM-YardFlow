/**
 * ConversationManager - Sprint 10 (T10.1)
 * Manages conversation state, context building, and history persistence
 */

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface ProspectContext {
  name: string;
  title: string;
  company: string;
  tier: string;
  score: number;
  isOps: boolean;
  isExec: boolean;
  status: string;
}

export interface RecentAction {
  type?: string;
  prospectId: string;
  prospectName: string;
  fromStatus: string;
  toStatus: string;
  timestamp: number;
}

export interface ConversationContext {
  messages: Message[];
  prospect: ProspectContext | null;
  recentActions: RecentAction[];
  stats: {
    total: number;
    contacted: number;
    booked: number;
    tier1: number;
  } | null;
}

const STORAGE_KEY = 'yardflow_chat_history';
const MAX_MESSAGES = 30;
const MAX_RECENT_ACTIONS = 5;

class ConversationManager {
  private messages: Message[] = [];
  private prospect: ProspectContext | null = null;
  private recentActions: RecentAction[] = [];
  private stats: ConversationContext['stats'] = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(message: Message): void {
    this.messages.push(message);
    
    // Trim to max messages (keep most recent)
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }
    
    this.saveToStorage();
  }

  /**
   * Get all messages in history
   */
  getHistory(): Message[] {
    return [...this.messages];
  }

  /**
   * Clear all conversation history
   */
  clearHistory(): void {
    this.messages = [];
    this.saveToStorage();
  }

  /**
   * Set the current prospect context
   */
  setProspectContext(prospect: ProspectContext | null): void {
    this.prospect = prospect;
  }

  /**
   * Get the current prospect context
   */
  getProspectContext(): ProspectContext | null {
    return this.prospect;
  }

  /**
   * Add a recent action to the context
   */
  addRecentAction(action: RecentAction): void {
    this.recentActions.unshift(action);
    
    // Keep only last N actions
    if (this.recentActions.length > MAX_RECENT_ACTIONS) {
      this.recentActions = this.recentActions.slice(0, MAX_RECENT_ACTIONS);
    }
  }

  /**
   * Get recent actions
   */
  getRecentActions(): RecentAction[] {
    return [...this.recentActions];
  }

  /**
   * Set current stats
   */
  setStats(stats: ConversationContext['stats']): void {
    this.stats = stats;
  }

  /**
   * Build the full conversation context for API calls
   */
  buildContext(): ConversationContext {
    return {
      messages: this.getHistory(),
      prospect: this.prospect,
      recentActions: this.recentActions,
      stats: this.stats
    };
  }

  /**
   * Build messages array for Gemini API (includes conversation history)
   */
  buildGeminiContents(): Array<{ role: string; parts: Array<{ text: string }> }> {
    // Convert our messages to Gemini format
    // Gemini expects alternating user/model messages
    return this.messages.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  /**
   * Export chat history as markdown
   */
  exportAsMarkdown(): string {
    const header = `# FreightRoll Chat Export\n\nExported: ${new Date().toISOString()}\n\n---\n\n`;
    
    const messages = this.messages.map(msg => {
      const role = msg.role === 'user' ? '**You**' : '**FreightRoll Brain**';
      const time = new Date(msg.timestamp).toLocaleString();
      return `${role} (${time}):\n\n${msg.content}\n`;
    }).join('\n---\n\n');
    
    return header + messages;
  }

  /**
   * Export chat history as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      messages: this.messages,
      prospect: this.prospect,
      recentActions: this.recentActions
    }, null, 2);
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
    } catch (e) {
      console.warn('Failed to save chat history:', e);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.messages = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load chat history:', e);
      this.messages = [];
    }
  }
}

// Singleton pattern
let instance: ConversationManager | null = null;

export class ConversationManagerSingleton {
  static getInstance(): ConversationManager {
    if (!instance) {
      instance = new ConversationManager();
    }
    return instance;
  }
}

// Re-export class for direct use
export { ConversationManager };
