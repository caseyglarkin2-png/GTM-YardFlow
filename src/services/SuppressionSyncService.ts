import type { Firestore } from 'firebase-admin/firestore';
import { EmailComplianceService } from './EmailComplianceService';
import { SendGridClient } from './SendGridClient';

const SUPPRESSION_COLLECTION = 'email_suppressions';

export class SuppressionSyncService {
  constructor(
    private readonly sendGrid: SendGridClient,
    private readonly compliance: EmailComplianceService,
    private readonly db: Firestore,
  ) {}

  async syncToSendGrid(): Promise<{ synced: number; errors: number; total: number }> {
    const snapshot = await this.db.collection(SUPPRESSION_COLLECTION).get();
    let synced = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as { reason?: string };
      try {
        await this.sendGrid.addToSuppression(doc.id, data.reason || 'manual');
        synced++;
      } catch (err) {
        console.warn('Failed to sync suppression to SendGrid', err);
        errors++;
      }
    }

    return { synced, errors, total: snapshot.size };
  }

  async syncFromSendGrid(): Promise<{ imported: number; total: number }> {
    const suppressions = await this.sendGrid.listSuppressions();
    let imported = 0;
    for (const email of suppressions) {
      if (await this.compliance.isOnSuppressionList(email)) continue;
      await this.compliance.addToSuppressionList({
        email,
        reason: 'manual',
        createdAt: Date.now(),
        source: 'sendgrid',
      });
      imported++;
    }
    return { imported, total: suppressions.length };
  }
}
