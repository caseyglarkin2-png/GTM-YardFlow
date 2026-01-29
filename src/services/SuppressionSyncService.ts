import { EmailComplianceService } from './EmailComplianceService';
import { SendGridClient } from './SendGridClient';

export class SuppressionSyncService {
  constructor(
    private readonly sendGrid: SendGridClient,
    private readonly compliance: EmailComplianceService,
    // Firestore db reserved for future use
  ) {}

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
