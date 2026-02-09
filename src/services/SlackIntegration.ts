/**
 * SlackIntegration
 * 
 * Rich Slack notifications for YardFlow events using Block Kit formatting.
 * Supports meeting notifications, reply alerts, and bounce warnings.
 * 
 * Sprint 47: Integration Expansion
 */

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  botName?: string;
  iconEmoji?: string;
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text?: string | { type: string; text: string }; url?: string; action_id?: string }>;
  accessory?: { type: string; image_url?: string; alt_text?: string };
}

export interface SlackMessage {
  text: string;
  channel?: string;
  username?: string;
  icon_emoji?: string;
  blocks?: SlackBlock[];
}

/**
 * Meeting booked event data
 */
export interface MeetingBookedData {
  prospectName: string;
  prospectCompany: string;
  prospectEmail?: string;
  meetingTime: string;
  meetingType?: string;
  sequenceName?: string;
  bookedBy?: string;
}

/**
 * Reply received event data
 */
export interface ReplyReceivedData {
  prospectName: string;
  prospectCompany: string;
  prospectEmail: string;
  subject: string;
  bodyPreview: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  isOOO?: boolean;
}

/**
 * Bounce detected event data
 */
export interface BounceDetectedData {
  prospectEmail: string;
  prospectName?: string;
  prospectCompany?: string;
  bounceType: 'hard' | 'soft';
  reason?: string;
  timestamp: string;
}

/**
 * SlackIntegration - Rich Slack notifications
 */
export class SlackIntegration {
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  /**
   * Send a Slack message
   */
  private async sendMessage(message: SlackMessage): Promise<{ ok: boolean; error?: string }> {
    if (!this.config.webhookUrl) {
      return { ok: false, error: 'No webhook URL configured' };
    }

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...message,
          channel: message.channel || this.config.channel,
          username: message.username || this.config.botName || 'FreightRoll Bot',
          icon_emoji: message.icon_emoji || this.config.iconEmoji || ':zap:'
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      return { ok: true };
    } catch (error) {
      return { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Notify when a meeting is booked (🎉 NORTH STAR!)
   */
  async notifyMeetingBooked(data: MeetingBookedData): Promise<{ ok: boolean; error?: string }> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🎉 Meeting Booked!', emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Prospect:*\n${data.prospectName}` },
          { type: 'mrkdwn', text: `*Company:*\n${data.prospectCompany}` },
          { type: 'mrkdwn', text: `*Time:*\n${data.meetingTime}` },
          ...(data.meetingType ? [{ type: 'mrkdwn', text: `*Type:*\n${data.meetingType}` }] : [])
        ]
      },
      ...(data.sequenceName ? [{
        type: 'context' as const,
        elements: [
          { type: 'mrkdwn', text: `📧 Sequence: ${data.sequenceName}` }
        ]
      }] : []),
      {
        type: 'divider'
      } as SlackBlock
    ];

    return this.sendMessage({
      text: `🎉 Meeting booked with ${data.prospectName} from ${data.prospectCompany}`,
      blocks
    });
  }

  /**
   * Notify when a reply is received
   */
  async notifyReplyReceived(data: ReplyReceivedData): Promise<{ ok: boolean; error?: string }> {
    // Determine emoji based on sentiment/OOO status
    let emoji = '📬';
    let headerText = 'Reply Received';
    
    if (data.isOOO) {
      emoji = '🏖️';
      headerText = 'Out of Office Reply';
    } else if (data.sentiment === 'positive') {
      emoji = '😊';
      headerText = 'Positive Reply!';
    } else if (data.sentiment === 'negative') {
      emoji = '😔';
      headerText = 'Reply Received';
    }

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} ${headerText}`, emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*From:*\n${data.prospectName}` },
          { type: 'mrkdwn', text: `*Company:*\n${data.prospectCompany}` }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Subject:* ${data.subject}\n\n>${data.bodyPreview.substring(0, 200)}${data.bodyPreview.length > 200 ? '...' : ''}` }
      },
      {
        type: 'divider'
      } as SlackBlock
    ];

    return this.sendMessage({
      text: `${emoji} Reply from ${data.prospectName}: ${data.subject}`,
      blocks
    });
  }

  /**
   * Notify when a bounce is detected
   */
  async notifyBounceDetected(data: BounceDetectedData): Promise<{ ok: boolean; error?: string }> {
    const isHard = data.bounceType === 'hard';
    const emoji = isHard ? '🚫' : '⚠️';
    const severity = isHard ? 'Hard Bounce' : 'Soft Bounce';

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} ${severity} Detected`, emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Email:*\n${data.prospectEmail}` },
          ...(data.prospectName ? [{ type: 'mrkdwn', text: `*Name:*\n${data.prospectName}` }] : []),
          ...(data.prospectCompany ? [{ type: 'mrkdwn', text: `*Company:*\n${data.prospectCompany}` }] : [])
        ]
      },
      ...(data.reason ? [{
        type: 'section' as const,
        text: { type: 'mrkdwn' as const, text: `*Reason:* ${data.reason}` }
      }] : []),
      ...(isHard ? [{
        type: 'context' as const,
        elements: [
          { type: 'mrkdwn', text: '⚠️ This email has been added to the suppression list' }
        ]
      }] : []),
      {
        type: 'divider'
      } as SlackBlock
    ];

    return this.sendMessage({
      text: `${emoji} ${severity}: ${data.prospectEmail}`,
      blocks
    });
  }

  /**
   * Send a simple text notification
   */
  async notify(message: string, emoji = ':bell:'): Promise<{ ok: boolean; error?: string }> {
    return this.sendMessage({
      text: message,
      icon_emoji: emoji
    });
  }

  /**
   * Send daily summary
   */
  async notifyDailySummary(stats: {
    emailsSent: number;
    emailsOpened: number;
    repliesReceived: number;
    meetingsBooked: number;
    bounces: number;
  }): Promise<{ ok: boolean; error?: string }> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📊 Daily FreightRoll Summary', emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Emails Sent:*\n${stats.emailsSent}` },
          { type: 'mrkdwn', text: `*Opens:*\n${stats.emailsOpened}` },
          { type: 'mrkdwn', text: `*Replies:*\n${stats.repliesReceived}` },
          { type: 'mrkdwn', text: `*Meetings:*\n🎉 ${stats.meetingsBooked}` }
        ]
      },
      ...(stats.bounces > 0 ? [{
        type: 'context' as const,
        elements: [
          { type: 'mrkdwn', text: `⚠️ Bounces: ${stats.bounces}` }
        ]
      }] : []),
      {
        type: 'divider'
      } as SlackBlock
    ];

    return this.sendMessage({
      text: `📊 Daily Summary: ${stats.emailsSent} sent, ${stats.meetingsBooked} meetings booked`,
      blocks
    });
  }
}

// Factory function to create SlackIntegration from env vars
export function createSlackIntegration(): SlackIntegration | null {
  const webhookUrl = typeof process !== 'undefined' 
    ? process.env.SLACK_WEBHOOK_URL || process.env.ALERT_WEBHOOK_URL
    : undefined;
    
  if (!webhookUrl) {
    return null;
  }

  return new SlackIntegration({ webhookUrl });
}
