import { describe, it, expect, vi } from 'vitest';
import { RailwayMailSender } from '../../services/RailwayMailSender';
import { railwayServerClient } from '../../../lib/railway-client';
import type { EmailMessage } from '../../types/email';

// Mock the network client
vi.mock('../../../lib/railway-client', () => ({
  railwayServerClient: {
    post: vi.fn()
  }
}));

describe('RailwayMailSender', () => {
  it('should map metadata.prospectId to payload.prospectId', async () => {
    const sender = new RailwayMailSender();
    
    const message: EmailMessage = {
      id: 'msg-1',
      to: 'test@example.com',
      from: 'me@yardflow.io',
      subject: 'Hello',
      html: '<p>Hi</p>',
      metadata: {
        userId: 'user-123',
        prospectId: 'prospect-999',
        campaignId: 'camp-1'
      }
    };

    // Mock successful response
    (railwayServerClient.post as any).mockResolvedValue({ ok: true, data: { id: 'railway-id' } });

    await sender.sendEmail(message);

    // Verify payload
    expect(railwayServerClient.post).toHaveBeenCalledWith(
      '/api/outreach/send-email',
      expect.objectContaining({
        to: 'test@example.com',
        prospectId: 'prospect-999', // Critical check
        campaignId: 'camp-1'
      })
    );
  });
});
