/**
 * UnsubscribePage Component
 * 
 * Sprint 2: T2.6 - Unsubscribe Landing Page
 * 
 * Professional unsubscribe experience:
 * - Clear messaging
 * - Confirm/cancel actions
 * - Success/error states
 * - Preference center option
 */

import { useState, useEffect } from 'react';
import { Mail, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

type PageState = 'loading' | 'confirm' | 'processing' | 'success' | 'error' | 'invalid';

interface UnsubscribePageProps {
  /** Token from URL query param */
  token?: string;
}

export function UnsubscribePage({ token: propToken }: UnsubscribePageProps) {
  const [state, setState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Get token from URL if not passed as prop
  const token = propToken || new URLSearchParams(window.location.search).get('token') || '';

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setErrorMessage('No unsubscribe token provided');
      return;
    }
    
    // Validate token on load
    validateToken();
  }, [token]);

  const validateToken = async () => {
    setState('loading');
    try {
      const response = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: 'GET',
      });
      
      if (response.ok) {
        setState('confirm');
      } else {
        const data = await response.json();
        setState('invalid');
        setErrorMessage(data.error || 'Invalid or expired link');
      }
    } catch (err) {
      setState('error');
      setErrorMessage('Unable to verify unsubscribe link');
    }
  };

  const handleUnsubscribe = async () => {
    setState('processing');
    try {
      const response = await fetch('/api/email/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `token=${encodeURIComponent(token)}&List-Unsubscribe=One-Click`,
      });
      
      if (response.ok) {
        setState('success');
      } else {
        const data = await response.json();
        setState('error');
        setErrorMessage(data.error || 'Failed to unsubscribe');
      }
    } catch (err) {
      setState('error');
      setErrorMessage('Unable to process your request');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Email Preferences</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          {state === 'loading' && (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-slate-600">Verifying your request...</p>
            </div>
          )}

          {state === 'confirm' && (
            <div className="p-8">
              <h2 className="text-xl font-semibold text-slate-800 text-center mb-4">
                Unsubscribe from emails?
              </h2>
              <p className="text-slate-600 text-center mb-6">
                You will no longer receive marketing and sales emails from us.
                Important transactional emails may still be sent.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleUnsubscribe}
                  className="w-full py-3 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Unsubscribe Me
                </button>
                
                <button
                  onClick={() => window.close()}
                  className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {state === 'processing' && (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-slate-600">Processing your request...</p>
            </div>
          )}

          {state === 'success' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                You've been unsubscribed
              </h2>
              <p className="text-slate-600 mb-6">
                You will no longer receive emails from us.
                It may take up to 24 hours to fully process.
              </p>
              
              <div className="p-4 bg-slate-50 rounded-lg text-left">
                <p className="text-sm text-slate-600">
                  <strong>Changed your mind?</strong> Contact us and we can re-subscribe you.
                </p>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Something went wrong
              </h2>
              <p className="text-slate-600 mb-6">
                {errorMessage || 'We couldn\'t process your unsubscribe request.'}
              </p>
              
              <button
                onClick={validateToken}
                className="py-2 px-4 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {state === 'invalid' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Invalid Link
              </h2>
              <p className="text-slate-600 mb-6">
                {errorMessage || 'This unsubscribe link is invalid or has expired.'}
              </p>
              
              <p className="text-sm text-slate-500">
                If you need to unsubscribe, please click the unsubscribe link in a recent email.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} YardFlow. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default UnsubscribePage;
