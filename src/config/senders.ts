/**
 * Sender Identity Configuration
 * 
 * Sprint 38B: Configurable sender identities for email outreach
 * 
 * Allows selecting from Jake, Casey, or "The FreightRoll Team"
 * All senders use @freightroll.com domain (must be verified in SendGrid)
 */

export interface SenderIdentity {
  id: string;
  name: string;
  email: string;
  title?: string;
  /** Short signature for email sign-offs */
  signOff: string;
  /** Full signature block (optional) */
  signature?: string;
  /** Is this the default sender? */
  isDefault?: boolean;
}

/**
 * Available sender identities
 * Note: All emails must be verified in SendGrid before use
 */
export const SENDER_IDENTITIES: SenderIdentity[] = [
  {
    id: 'jake',
    name: 'Jake',
    email: 'jake@freightroll.com',
    title: 'CEO',
    signOff: 'Best,\nJake',
    signature: `Jake
CEO, FreightRoll
jake@freightroll.com`,
    isDefault: true,
  },
  {
    id: 'casey',
    name: 'Casey',
    email: 'casey@freightroll.com',
    title: 'Head of Sales',
    signOff: 'Best,\nCasey',
    signature: `Casey
Head of Sales, FreightRoll
casey@freightroll.com`,
  },
  {
    id: 'team',
    name: 'The FreightRoll Team',
    email: 'team@freightroll.com',
    signOff: 'Best,\nThe FreightRoll Team',
    signature: `The FreightRoll Team
team@freightroll.com`,
  },
];

/**
 * Get sender by ID
 */
export function getSender(id: string): SenderIdentity | undefined {
  return SENDER_IDENTITIES.find(s => s.id === id);
}

/**
 * Get the default sender
 */
export function getDefaultSender(): SenderIdentity {
  return SENDER_IDENTITIES.find(s => s.isDefault) || SENDER_IDENTITIES[0];
}

/**
 * Get sender's name for template interpolation
 */
export function getSenderName(senderId?: string): string {
  const sender = senderId ? getSender(senderId) : getDefaultSender();
  return sender?.name || 'The FreightRoll Team';
}

/**
 * Get sender's email for "From" header
 */
export function getSenderEmail(senderId?: string): string {
  const sender = senderId ? getSender(senderId) : getDefaultSender();
  return sender?.email || 'team@freightroll.com';
}

/**
 * Replace {{senderName}} in template with actual sender name
 */
export function interpolateSender(template: string, senderId?: string): string {
  const senderName = getSenderName(senderId);
  return template
    .replace(/\{\{senderName\}\}/g, senderName)
    .replace(/\{\{sender_name\}\}/g, senderName)
    .replace(/\{senderName\}/g, senderName);
}

export type SenderId = 'jake' | 'casey' | 'team';
