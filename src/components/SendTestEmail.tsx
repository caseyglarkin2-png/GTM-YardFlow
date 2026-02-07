/**
 * SendTestEmail - YardFlow Hub
 * 
 * Component for sending a test email to verify email infrastructure.
 * Can be placed in settings or used for debugging.
 */

import { useState, useCallback } from 'react';
import { Send, Loader, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { auth } from '@/lib/firebase';

export interface SendTestEmailProps {
  /** Default recipient email */
  defaultEmail?: string;
  /** Callback when email is sent successfully */
  onSuccess?: (emailId: string) => void;
  /** Callback when email fails to send */
  onError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export interface TestEmailResult {
  id: string;
  status: string;
  message?: string;
}

export function SendTestEmail({
  defaultEmail = '',
  onSuccess,
  onError,
  className = '',
}: SendTestEmailProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState('YardFlow Test Email');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; emailId?: string } | null>(null);

  const handleSendTest = useCallback(async () => {
    if (!email) {
      setResult({ success: false, message: 'Please enter an email address' });
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const user = auth?.currentUser;

      if (!user) {
        throw new Error('You must be logged in to send test emails');
      }

      const token = await user.getIdToken();
      const testEmailId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': testEmailId,
        },
        body: JSON.stringify({
          id: testEmailId,
          to: email,
          toName: 'Test Recipient',
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1e40af;">🎉 YardFlow Email Test Successful!</h1>
              <p>This is a test email from YardFlow GTM Hub.</p>
              <p>If you're seeing this, your email infrastructure is working correctly.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="font-size: 12px; color: #6b7280;">
                Sent at: ${new Date().toISOString()}<br/>
                Email ID: ${testEmailId}
              </p>
            </div>
          `,
          text: `YardFlow Email Test Successful!\n\nThis is a test email from YardFlow GTM Hub.\n\nIf you're seeing this, your email infrastructure is working correctly.\n\nSent at: ${new Date().toISOString()}\nEmail ID: ${testEmailId}`,
          metadata: {
            type: 'test',
            source: 'SendTestEmail',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to send: ${response.status}`);
      }

      const data = await response.json();
      setResult({ 
        success: true, 
        message: `Test email queued successfully!`,
        emailId: data.id || testEmailId,
      });
      onSuccess?.(data.id || testEmailId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send test email';
      setResult({ success: false, message });
      onError?.(message);
    } finally {
      setIsSending(false);
    }
  }, [email, subject, onSuccess, onError]);

  const handleCheckStatus = useCallback(async () => {
    if (!result?.emailId) return;

    try {
      const user = auth?.currentUser;
      const token = user ? await user.getIdToken() : null;

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/email/status?id=${result.emailId}`, { headers });
      const data = await response.json();

      setResult(prev => ({
        ...prev!,
        message: `Status: ${data.status}${data.sentAt ? ` (sent at ${new Date(data.sentAt).toLocaleTimeString()})` : ''}`,
      }));
    } catch {
      // Ignore status check errors
    }
  }, [result?.emailId]);

  return (
    <div className={`bg-white rounded-lg border border-slate-200 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5 text-blue-600" />
        <h3 className="font-medium text-slate-800">Send Test Email</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="test-email-to" className="block text-sm font-medium text-slate-700 mb-1">
            Recipient Email
          </label>
          <input
            id="test-email-to"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            disabled={isSending}
          />
        </div>

        <div>
          <label htmlFor="test-email-subject" className="block text-sm font-medium text-slate-700 mb-1">
            Subject
          </label>
          <input
            id="test-email-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Test email subject"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            disabled={isSending}
          />
        </div>

        <button
          onClick={handleSendTest}
          disabled={isSending || !email}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 
            bg-blue-600 text-white font-medium rounded-lg
            hover:bg-blue-700 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Test Email
            </>
          )}
        </button>

        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm
            ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
          >
            {result.success ? (
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p>{result.message}</p>
              {result.emailId && (
                <button
                  onClick={handleCheckStatus}
                  className="mt-1 text-xs underline hover:no-underline"
                >
                  Check delivery status
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Use this to verify your SendGrid configuration is working correctly.
      </p>
    </div>
  );
}

export default SendTestEmail;
