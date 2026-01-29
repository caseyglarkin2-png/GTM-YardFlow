import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminDb } from '../../lib/firebaseAdmin';

const db = getAdminDb();
const auth = getAdminAuth();

export interface EmailStatusResponse {
  id: string;
  status: 'pending' | 'scheduled' | 'processing' | 'sent' | 'failed' | 'canceled';
  attempts: number;
  maxAttempts: number;
  scheduledAt?: number;
  sentAt?: number;
  lastError?: string;
  deliveryEvents?: Array<{
    type: string;
    at: number;
    url?: string;
  }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Extract email ID from query parameter
  const emailId = req.query.id as string | undefined;
  if (!emailId) {
    res.status(400).json({ error: 'Missing email id parameter' });
    return;
  }

  // Authentication required - verify user owns this email
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  let userId: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    userId = decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  try {
    // Fetch queue item
    const queueDoc = await db.collection('email_queue').doc(emailId).get();
    
    if (!queueDoc.exists) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const queueData = queueDoc.data() as Record<string, unknown>;

    // Verify ownership - user must own the email to see its status
    if (queueData.userId && queueData.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Fetch delivery events
    const eventsSnapshot = await db
      .collection('email_events')
      .where('emailId', '==', emailId)
      .orderBy('at', 'asc')
      .limit(50)
      .get();

    const deliveryEvents = eventsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        type: data.type as string,
        at: data.at as number,
        url: data.url as string | undefined,
      };
    });

    const response: EmailStatusResponse = {
      id: emailId,
      status: (queueData.status as EmailStatusResponse['status']) || 'pending',
      attempts: (queueData.attempts as number) || 0,
      maxAttempts: (queueData.maxAttempts as number) || 3,
      scheduledAt: queueData.scheduledAt as number | undefined,
      sentAt: queueData.sentAt as number | undefined,
      lastError: queueData.lastError as string | undefined,
      deliveryEvents: deliveryEvents.length > 0 ? deliveryEvents : undefined,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('Failed to fetch email status:', err);
    res.status(500).json({ error: 'Failed to fetch email status' });
  }
}
