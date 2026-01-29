import React from 'react';
import { Link2, CheckCircle, AlertCircle } from 'lucide-react';
import type { useHubSpot, HubSpotConnectionStatus } from '../../hooks/useHubSpot';

export interface IntegrationsTabProps {
  hubspot: ReturnType<typeof useHubSpot>;
  hubspotConnectionStatus: HubSpotConnectionStatus;
}

/**
 * IntegrationsTab - Manage CRM and data connections
 * 
 * Self-contained component for HubSpot, Google, and LinkedIn integrations.
 * Uses the useHubSpot hook for OAuth connection management.
 */
export function IntegrationsTab({ hubspot, hubspotConnectionStatus }: IntegrationsTabProps): React.ReactElement {
  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-br from-purple-600 to-violet-700 rounded-xl p-6 text-white shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-5 w-5" />
          <span className="text-purple-100 text-xs font-medium uppercase tracking-wider">Integrations</span>
        </div>
        <div className="text-2xl font-bold">Connected Apps</div>
        <div className="text-purple-200 text-xs mt-2">Manage your CRM and data connections</div>
      </div>
      
      {/* HubSpot Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-testid="hubspot-settings">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-orange-600 font-bold text-sm">HS</span>
            </div>
            <div>
              <div className="font-semibold text-slate-800">HubSpot CRM</div>
              <div className="text-xs text-slate-500">Bi-directional contact & deal sync</div>
            </div>
          </div>
          <span 
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              hubspotConnectionStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
            }`}
            data-testid="hubspot-status"
          >
            {hubspotConnectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
          </span>
        </div>
        <div className="p-4">
          <button
            onClick={() => hubspotConnectionStatus === 'connected' ? hubspot.disconnect() : hubspot.connect()}
            disabled={hubspotConnectionStatus === 'connecting'}
            data-testid="hubspot-connect-button"
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              hubspotConnectionStatus === 'connected' 
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {hubspotConnectionStatus === 'connecting' ? 'Connecting...' : 
             hubspotConnectionStatus === 'connected' ? 'Disconnect HubSpot' : 'Connect HubSpot'}
          </button>
          {/* HubSpot OAuth Error States with User-Friendly Messages */}
          {hubspot.error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="hubspot-error">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <HubSpotErrorMessage error={hubspot.error} onRetry={hubspot.retry} />
                </div>
              </div>
            </div>
          )}
          {hubspot.isConnected && hubspot.portalId && (
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-2" data-testid="hubspot-portal-info">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Portal ID: {hubspot.portalId}
            </div>
          )}
        </div>
      </div>

      {/* Google Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">G</span>
            </div>
            <div>
              <div className="font-semibold text-slate-800">Google Workspace</div>
              <div className="text-xs text-slate-500">Calendar & Gmail integration</div>
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
            Coming Soon
          </span>
        </div>
      </div>

      {/* LinkedIn Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">in</span>
            </div>
            <div>
              <div className="font-semibold text-slate-800">LinkedIn Sales Navigator</div>
              <div className="text-xs text-slate-500">CSV import & enrichment</div>
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
            Via Import
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper component for user-friendly HubSpot error messages
 */
function HubSpotErrorMessage({ error, onRetry }: { error: string; onRetry: () => void }): React.ReactElement {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('popup') || errorLower.includes('blocked')) {
    return (
      <>
        <p className="text-sm font-medium text-red-800">Popup Blocked</p>
        <p className="text-xs text-red-600 mt-1">
          Please allow popups for this site to connect HubSpot. 
          Look for the popup blocker icon in your browser's address bar.
        </p>
        <ErrorActions onRetry={onRetry} />
      </>
    );
  }
  
  if (errorLower.includes('client_id') || errorLower.includes('invalid_client')) {
    return (
      <>
        <p className="text-sm font-medium text-red-800">Configuration Error</p>
        <p className="text-xs text-red-600 mt-1">
          HubSpot app not configured correctly. 
          <a 
            href="https://developers.hubspot.com/docs/api/oauth-quickstart-guide" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline ml-1"
          >
            View setup guide →
          </a>
        </p>
        <ErrorActions onRetry={onRetry} />
      </>
    );
  }
  
  if (errorLower.includes('denied') || errorLower.includes('cancelled') || errorLower.includes('access_denied')) {
    return (
      <>
        <p className="text-sm font-medium text-red-800">Authorization Cancelled</p>
        <p className="text-xs text-red-600 mt-1">
          You cancelled the HubSpot authorization. Click "Connect HubSpot" to try again.
        </p>
        <ErrorActions onRetry={onRetry} />
      </>
    );
  }
  
  if (errorLower.includes('timeout')) {
    return (
      <>
        <p className="text-sm font-medium text-red-800">Connection Timed Out</p>
        <p className="text-xs text-red-600 mt-1">
          The authorization took too long. Please try again.
        </p>
        <ErrorActions onRetry={onRetry} />
      </>
    );
  }
  
  if (errorLower.includes('missing') && errorLower.includes('redirect')) {
    return (
      <>
        <p className="text-sm font-medium text-red-800">Configuration Missing</p>
        <p className="text-xs text-red-600 mt-1">
          OAuth redirect URI not configured. Check your environment variables.
        </p>
        <ErrorActions onRetry={onRetry} />
      </>
    );
  }
  
  return (
    <>
      <p className="text-sm font-medium text-red-800">Connection Error</p>
      <p className="text-xs text-red-600 mt-1">{error}</p>
      <ErrorActions onRetry={onRetry} />
    </>
  );
}

function ErrorActions({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div className="flex items-center gap-3 mt-2">
      <button 
        onClick={onRetry}
        className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
      >
        Try Again
      </button>
      <a 
        href="https://developers.hubspot.com/docs/api/oauth-quickstart-guide" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
      >
        Need Help?
      </a>
    </div>
  );
}

export default IntegrationsTab;
