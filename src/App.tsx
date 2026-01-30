import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Users, 
  MessageSquare, 
  Send, 
  Save, 
  CheckCircle, 
  Search, 
  Briefcase, 
  Zap, 
  Settings, 
  AlertCircle,
  Bot,
  Loader,
  Download,
  Trash2,
  Sparkles,
  RefreshCw,
  Menu,
  X,
  ChevronDown,
  Clock,
  Activity,
  Calculator,
  LayoutDashboard,
  Upload,
  Link2,
  TrendingUp,
  Building2
} from 'lucide-react';
import { ConversationManagerSingleton } from './services/ConversationManager';
import { buildSystemPrompt } from './services/SystemPromptBuilder';
import { generateTemplate, refineTemplate } from './services/TemplateGenerator';
import { getActivityTracker } from './services/ActivityTracker';
import type { Activity as ActivityType } from './services/ActivityTracker';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  query, 
  onSnapshot, 
  Timestamp, 
  doc,
  setDoc
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

const hasFirebaseConfig = firebaseConfig.apiKey && firebaseConfig.projectId;
const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = import.meta.env.VITE_FIREBASE_APP_ID || 'default-app-id';

// --- Types ---
import { Prospect, MessageTemplate, ChatMessage } from './types';
import { HITLIST_PROSPECTS } from './data/hitlistData';

// --- New Sprint 18-20 Components ---
import { ROITab } from './components/ROITab';
import { AssetsPanel } from './components/AssetsPanel';

// --- Sprint 72: Company-Centric View ---
import { CompanyListView } from './components/CompanyListView';
import { CompanyDetailPanel } from './components/CompanyDetailPanel';
import { ViewModeToggle, type ViewMode } from './components/ViewModeToggle';
import { aggregateByCompany, type CompanyRow } from './services/CompanyAggregator';

// --- Sprint 26-33 Components ---
import { ImportWizard } from './components/ImportWizard';
import { KPICard } from './components/KPICard';
import { Leaderboard } from './components/Leaderboard';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { OfflineBanner } from './components/OfflineBanner';
import type { TimePeriod, DateRange } from './types/analytics';

// --- Sprint 34 Hooks ---
import { useHubSpot } from './hooks/useHubSpot';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import { usePresence, usePresenceViewTracker } from './hooks/usePresence';

// --- Sprint 35 Hooks ---
import { useDashboardData } from './hooks/useDashboardData';
import { createAnalyticsAggregator, type ProspectData, type ActivityData } from './services/AnalyticsAggregator';

// --- Sprint 60 Services ---
import { copyToClipboard as clipboardCopy } from './services/ClipboardService';

// --- Sprint 34 Components ---
import { CommandPalette } from './components/CommandPalette';
import { SyncStatus } from './components/SyncStatus';
import { PresenceIndicator } from './components/PresenceIndicator';

// --- Sprint 35 Components ---
import { DateRangePicker } from './components/DateRangePicker';
import { dashboardExporter } from './services/DashboardExporter';
import { FunnelChart, BarChart, PieChart, LineChart } from './components/charts';

// --- Unshipped Components - Now Wired In ---
import { MessageQualityIndicator } from './components/MessageQualityIndicator';
import { 
  KPIGridSkeleton, 
  LeaderboardSkeleton, 
  ErrorState, 
  LoadingOverlay 
} from './components/DashboardStates';
import { SearchIndexService, type SearchableProspect } from './services/SearchIndexService';
import { SavedFiltersService, type SavedFilter } from './services/SavedFiltersService';
import type { FilterCondition } from './services/FilterBuilderService';

// --- Sprint 36 Components (Bulk Operations) ---
import { BulkActionsToolbar } from './components/BulkActionsToolbar';
import { BulkSequenceModal } from './components/BulkSequenceModal';
import { BulkTagModal } from './components/BulkTagModal';
import { BulkDeleteModal } from './components/BulkDeleteModal';
import { BulkStatusModal } from './components/BulkStatusModal';

// --- Toast Notification System ---
import { ToastContainer, useToast } from './components/Toast';

// --- Sprint 47 Tab Components ---
import { IntegrationsTab, ImportTab } from './components/tabs';

// --- Sprint 36 Services (Bulk Operations) ---
import { BulkExporter } from './services/BulkExporter';
import { BulkDeleteService } from './services/BulkDeleteService';
import { BulkActionService } from './services/BulkActionService';
import { useMultiSelect } from './services/MultiSelectService';

// Initialize singletons
const conversationManager = ConversationManagerSingleton.getInstance();
const activityTracker = getActivityTracker();
const bulkExporter = new BulkExporter();
const bulkDeleteService = new BulkDeleteService();
const bulkActionService = new BulkActionService();

// Initialize SearchIndexService for fuzzy search
const searchIndexService = new SearchIndexService<SearchableProspect>({
  keys: [
    { name: 'fullName', weight: 0.3 },
    { name: 'company', weight: 0.25 },
    { name: 'title', weight: 0.2 },
    { name: 'email', weight: 0.15 },
    { name: 'tags', weight: 0.1 },
  ],
  threshold: 0.4,
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
});

// Initialize SavedFiltersService for filter presets
const savedFiltersService = new SavedFiltersService('yardflow');
savedFiltersService.load();

// --- Email Confidence Badge Component ---
// Displays confidence score based on email format and source
function EmailConfidenceBadge({ email }: { email: string }): React.ReactElement | null {
  // Calculate confidence based on email characteristics
  const getConfidence = (email: string): { level: 'high' | 'medium' | 'low'; label: string; color: string } => {
    // High confidence: Personal email patterns (first.last@, first_last@, etc.)
    const personalPattern = /^[a-z]+[._-]?[a-z]+@/i;
    const isPersonalFormat = personalPattern.test(email);
    
    // Check for common corporate domains vs generic
    const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
    const domain = email.split('@')[1]?.toLowerCase() || '';
    const isCorporateDomain = !genericDomains.includes(domain);
    
    // High: Corporate domain + personal format
    if (isCorporateDomain && isPersonalFormat) {
      return { level: 'high', label: 'Verified', color: 'bg-green-100 text-green-700 border-green-200' };
    }
    // Medium: Corporate domain OR personal format
    if (isCorporateDomain || isPersonalFormat) {
      return { level: 'medium', label: 'Likely', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    }
    // Low: Generic domain + no personal format
    return { level: 'low', label: 'Unverified', color: 'bg-slate-100 text-slate-500 border-slate-200' };
  };

  const confidence = getConfidence(email);
  
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${confidence.color}`}>
      {confidence.label}
    </span>
  );
}

// --- Calendar Link Configuration ---
const CALENDAR_LINK = 'https://calendly.com/jake-freightroll/manifest-meeting';

// --- Templates with Network Effects Messaging ---
// Shortened for platform character limits (LinkedIn DM ~300 chars, InMail ~1900 chars)
const TEMPLATES = (prospect: Prospect, senderName: string): MessageTemplate[] => [
  {
    id: 'dm_codev',
    label: 'DM: Co-Dev (Short)',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, YardFlow Co-Dev: 2-3 partners get voting seats. Primo Brands saving $1M+/facility—now at 260. Love to share the math for ${prospect.company}. ${CALENDAR_LINK} -${senderName}`
  },
  {
    id: 'dm_exec',
    label: 'DM: Exec - Headcount Neutral',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, Primo saved $1M+/facility staying headcount neutral. Curious about ${prospect.company}'s yard flow? ${CALENDAR_LINK} -${senderName}`
  },
  {
    id: 'dm_ops',
    label: 'DM: Ops - Dock Time',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, avg facility wastes 5 min/shipment on dock assignments. System-driven is the fix. Compare notes? ${CALENDAR_LINK} -${senderName}`
  },
  {
    id: 'dm_carrier',
    label: 'DM: Carrier Benchmarking',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, 40% of carriers have 10% drivers underperforming in yard. We're benchmarking. Relevant for ${prospect.company}? ${CALENDAR_LINK} -${senderName}`
  },
  {
    id: 'codev_invite',
    label: 'Email: Co-Dev Invitation',
    type: 'codev',
    subject: `Manifest: Design Partner for ${prospect.company}?`,
    body: `Hi ${prospect.name.split(' ')[0]},

Saw you're at Manifest—wanted to flag something for ${prospect.company}.

We're launching the YardFlow Co-Dev Program: 2-3 enterprise partners get a voting seat on the 2026 roadmap.

**The proof:** Primo Brands is rolling YardFlow from 25→260 facilities. Each averages $1M+ margin improvement—headcount neutral.

**Network effects:**
• Standard data model = carrier benchmarking + bottleneck ID
• Real-time visibility = trailer optimization + dwell alerts
• Standard protocols = faster driver navigation

Given ${prospect.company}'s scale, I'd walk through this math.

${CALENDAR_LINK}

-${senderName}`
  }
];

export default function App() {
  const [user, setUser] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<'prospects' | 'stats' | 'assistant' | 'roi' | 'assets' | 'dashboard' | 'import' | 'integrations'>('prospects');
  const [prospects, setProspects] = useState<Prospect[]>(HITLIST_PROSPECTS);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [currentUser, setCurrentUser] = useState<'Jake' | 'Me'>('Me');
  const [filter, setFilter] = useState('');
  const [tierFilter, setTierFilter] = useState<'All' | 'Tier 1' | 'Tier 2' | 'Tier 3'>('All');
  // Sprint 72: View mode toggle (company vs person view) with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('yardflow-view-mode');
      return (saved === 'people' || saved === 'companies') ? saved : 'companies';
    } catch {
      return 'companies';
    }
  });
  const [selectedCompany, setSelectedCompany] = useState<CompanyRow | null>(null);
  const [companySortBy, setCompanySortBy] = useState<'score' | 'facilities' | 'contacts' | 'roi'>(() => {
    try {
      const saved = localStorage.getItem('yardflow-company-sort');
      if (saved === 'score' || saved === 'facilities' || saved === 'contacts' || saved === 'roi') {
        return saved;
      }
      return 'score';
    } catch {
      return 'score';
    }
  });
  // Email editing state
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editingEmailValue, setEditingEmailValue] = useState('');
  // Hitlist date filter (Sprint 35 - T35.4)
  const [hitlistDatePeriod, setHitlistDatePeriod] = useState<TimePeriod>('all');
  const [hitlistCustomRange, setHitlistCustomRange] = useState<DateRange | undefined>(undefined);
  
  // Saved Filters State (wiring in SavedFiltersService)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => savedFiltersService.getAllFilters());
  const [showSavedFiltersMenu, setShowSavedFiltersMenu] = useState(false);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const hitlistDateRange = useMemo(() => {
    if (hitlistDatePeriod === 'custom' && hitlistCustomRange) {
      return { start: hitlistCustomRange.start, end: hitlistCustomRange.end };
    }
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    switch (hitlistDatePeriod) {
      case 'today': return { start: new Date(now.getTime() - 1 * dayMs), end: now };
      case 'week': return { start: new Date(now.getTime() - 7 * dayMs), end: now };
      case 'month': return { start: new Date(now.getTime() - 30 * dayMs), end: now };
      case 'quarter': return { start: new Date(now.getTime() - 90 * dayMs), end: now };
      case 'year': return { start: new Date(now.getTime() - 365 * dayMs), end: now };
      default: return null;
    }
  }, [hitlistDatePeriod, hitlistCustomRange]);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('dm_codev');
  const [showCopied, setShowCopied] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSendStatus, setEmailSendStatus] = useState<'idle' | 'success' | 'error' | 'no_email' | 'rate_limit'>('idle');
  const [emailErrorMessage, setEmailErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  
  // Mobile State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Activity State
  const [recentActivities, setRecentActivities] = useState<ActivityType[]>(() => 
    activityTracker.getRecent(15)
  );

  // Toast Notifications
  const { toasts, dismissToast, success: showSuccess, error: showError } = useToast();

  // Screen reader announcements
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    setTimeout(() => setAnnouncement(''), 1000);
  }, []);

  // Update search index when prospects change
  useEffect(() => {
    const searchableProspects: SearchableProspect[] = prospects.map(p => ({
      id: p.id,
      firstName: p.name.split(' ')[0] || '',
      lastName: p.name.split(' ').slice(1).join(' ') || '',
      fullName: p.name,
      email: p.email || '',
      company: p.company,
      title: p.title,
      linkedInUrl: p.linkedinUrl,
      location: p.location,
      status: p.status,
      tags: p.tags,
      notes: p.notes,
    }));
    searchIndexService.loadItems(searchableProspects);
  }, [prospects]);

  const filteredProspects = useMemo(() => {
    let matchingProspects = prospects;
    
    // Use fuzzy search if filter is provided
    if (filter.trim()) {
      const searchResults = searchIndexService.search(filter, { limit: 100, threshold: 0.6 });
      const matchingIds = new Set(searchResults.map(r => r.item.id));
      matchingProspects = prospects.filter(p => matchingIds.has(p.id));
    }
    
    return matchingProspects
      .filter(p => {
        const matchesTier = tierFilter === 'All' || p.tier === tierFilter;
        let matchesDate = true;
        if (hitlistDateRange && p.createdAt) {
          const prospectDate = new Date(p.createdAt);
          matchesDate = prospectDate >= hitlistDateRange.start && prospectDate <= hitlistDateRange.end;
        }
        return matchesTier && matchesDate;
      })
      .sort((a, b) => b.score - a.score);
  }, [prospects, filter, tierFilter, hitlistDateRange]);

  // --- Sprint 72: Aggregate prospects by company for company-centric view ---
  const aggregatedCompanies = useMemo(() => {
    return aggregateByCompany(filteredProspects, undefined, {
      sortBy: companySortBy,
      sortDirection: 'desc',
      searchTerm: filter,
    });
  }, [filteredProspects, companySortBy, filter]);
  
  // --- Sprint 36: Bulk Selection State (using useMultiSelect hook) ---
  const prospectIds = useMemo(() => filteredProspects.map(p => p.id), [filteredProspects]);
  const multiSelect = useMultiSelect(prospectIds);
  const {
    selectedIds: selectedProspectIds,
    selectedCount,
    isAllSelected,
    hasSelection,
    toggle: toggleSelection,
    selectAll,
    deselectAll: clearSelection,
    toggleAll: handleSelectAllToggle,
    handleClick: handleSelectionClick,
    isSelected,
  } = multiSelect;
  
  const [bulkActionModal, setBulkActionModal] = useState<'sequence' | 'tag' | 'status' | 'delete' | null>(null);
  const [isProcessingBulkAction, setIsProcessingBulkAction] = useState(false);
  const [isExportingBulk, setIsExportingBulk] = useState(false);
  const [deletedProspects, setDeletedProspects] = useState<Prospect[]>([]);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Check if some (but not all) are selected (for indeterminate state)
  const isSomeSelected = useMemo(() => 
    selectedCount > 0 && !isAllSelected,
    [selectedCount, isAllSelected]
  );

  // Get selected prospects
  const selectedProspects = useMemo(() => 
    prospects.filter(p => selectedProspectIds.has(p.id)),
    [prospects, selectedProspectIds]
  );

  // Update indeterminate state for select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  // Announce selection changes for screen readers
  useEffect(() => {
    if (selectedCount > 0) {
      announce(`${selectedCount} prospect${selectedCount === 1 ? '' : 's'} selected`);
    }
  }, [selectedCount, announce]);

  // Sprint 72: Persist view mode and sort preference
  useEffect(() => {
    try {
      localStorage.setItem('yardflow-view-mode', viewMode);
    } catch {
      // Ignore storage errors
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('yardflow-company-sort', companySortBy);
    } catch {
      // Ignore storage errors
    }
  }, [companySortBy]);

  // Global keyboard shortcuts for bulk selection (Cmd/Ctrl+A, Escape)
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      // Only handle when on hitlist tab and not in an input
      if (activeTab !== 'prospects') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // Cmd/Ctrl+A to select all visible rows
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        announce(`${prospectIds.length} prospects selected`);
      }

      // Escape to clear selection
      if (e.key === 'Escape' && hasSelection) {
        e.preventDefault();
        clearSelection();
        announce('Selection cleared');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeTab, selectAll, clearSelection, hasSelection, prospectIds.length, announce]);

  // --- Bulk Action Handlers (wired to BulkActionService) ---
  const handleBulkAssignSequence = useCallback(async (sequenceId: string) => {
    const prospectIdsArray = Array.from(selectedProspectIds);
    setIsProcessingBulkAction(true);

    try {
      // Register handler that calls the email API
      bulkActionService.registerHandler('sequence', async (ids, value) => {
        // Get prospect data for the selected IDs
        const selectedProspects = prospects.filter(p => ids.includes(p.id));
        
        // For each prospect, enqueue an email via the API
        const results = await Promise.allSettled(
          selectedProspects.map(async (prospect) => {
            // Get auth token if available
            const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
            
            if (!token) {
              throw new Error('Not authenticated');
            }

            const response = await fetch('/api/email/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Idempotency-Key': `seq-${value}-${prospect.id}-${Date.now()}`,
              },
              body: JSON.stringify({
                id: `${value}-${prospect.id}-${Date.now()}`,
                to: prospect.email,
                toName: prospect.name,
                subject: `Following up - ${prospect.company}`,
                html: `<p>Hi ${prospect.name.split(' ')[0]},</p><p>I wanted to reach out about YardFlow...</p>`,
                text: `Hi ${prospect.name.split(' ')[0]},\n\nI wanted to reach out about YardFlow...`,
                metadata: {
                  prospectId: prospect.id,
                  sequenceId: value,
                  stepIndex: 0,
                },
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to send email');
            }

            return response.json();
          })
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        return {
          success: failed === 0,
          type: 'sequence' as const,
          processed: succeeded,
          failed,
          data: { sequenceId: value }
        };
      });

      const result = await bulkActionService.execute({
        type: 'sequence',
        prospectIds: prospectIdsArray,
        value: sequenceId
      });

      if (result.success) {
        clearSelection();
        announce(`${result.processed} prospect${result.processed === 1 ? '' : 's'} assigned to sequence`);
      } else if (result.processed > 0) {
        announce(`Partial success: ${result.processed} assigned, ${result.failed} failed`);
      } else {
        announce('Failed to assign prospects to sequence');
      }
    } catch (error) {
      console.error('Bulk sequence assignment failed', error);
      showError('Sequence Assignment Failed', 'Unable to assign prospects to the selected sequence. Please try again.');
      announce('Failed to assign prospects to sequence');
    } finally {
      setBulkActionModal(null);
      setIsProcessingBulkAction(false);
    }
  }, [selectedProspectIds, prospects, clearSelection, announce, showError]);

  const handleBulkAddTag = useCallback(async (tags: string[]) => {
    const prospectIdsArray = Array.from(selectedProspectIds);
    setIsProcessingBulkAction(true);

    try {
      // Register handler for tag action
      bulkActionService.registerHandler('tag', async (ids, value) => {
        const tagsToAdd = value as string[];
        // Update prospects with new tags
        setProspects(prev => prev.map(p => {
          if (ids.includes(p.id)) {
            const existingTags = p.tags || [];
            const newTags = [...new Set([...existingTags, ...tagsToAdd])];
            return { ...p, tags: newTags };
          }
          return p;
        }));
        return {
          success: true,
          type: 'tag' as const,
          processed: ids.length,
          failed: 0,
          data: { tags: tagsToAdd }
        };
      });

      const result = await bulkActionService.execute({
        type: 'tag',
        prospectIds: prospectIdsArray,
        value: tags
      });

      if (result.success) {
        clearSelection();
        announce(`Added ${tags.length} tag${tags.length === 1 ? '' : 's'} to ${result.processed} prospect${result.processed === 1 ? '' : 's'}`);
      }
    } catch (error) {
      console.error('Bulk tag failed', error);
      showError('Tag Update Failed', 'Unable to add tags to the selected prospects. Please try again.');
      announce('Failed to add tags');
    } finally {
      setBulkActionModal(null);
      setIsProcessingBulkAction(false);
    }
  }, [selectedProspectIds, clearSelection, announce, showError]);

  const handleBulkChangeStatus = useCallback(async (status: Prospect['status']) => {
    const prospectIdsArray = Array.from(selectedProspectIds);
    setIsProcessingBulkAction(true);

    try {
      // Register handler for status action
      bulkActionService.registerHandler('status', async (ids, value) => {
        const newStatus = value as Prospect['status'];
        setProspects(prev => prev.map(p => {
          if (ids.includes(p.id)) {
            return { ...p, status: newStatus };
          }
          return p;
        }));
        return {
          success: true,
          type: 'status' as const,
          processed: ids.length,
          failed: 0,
          data: { status: newStatus }
        };
      });

      const result = await bulkActionService.execute({
        type: 'status',
        prospectIds: prospectIdsArray,
        value: status
      });

      if (result.success) {
        clearSelection();
        announce(`Updated status to ${status} for ${result.processed} prospect${result.processed === 1 ? '' : 's'}`);
      }
    } catch (error) {
      console.error('Bulk status change failed', error);
      showError('Status Update Failed', 'Unable to update status for the selected prospects. Please try again.');
      announce('Failed to update status');
    } finally {
      setBulkActionModal(null);
      setIsProcessingBulkAction(false);
    }
  }, [selectedProspectIds, clearSelection, announce, showError]);

  const handleBulkExport = useCallback(async () => {
    setIsExportingBulk(true);
    try {
      const prospectsToExport = prospects.filter(p => selectedProspectIds.has(p.id));
      const result = await bulkExporter.exportToCSV(
        prospectsToExport,
        `yardflow-prospects-${new Date().toISOString().split('T')[0]}.csv`
      );

      if (result.success) {
        bulkExporter.download(result);
        clearSelection();
        showSuccess('Export Complete', `Exported ${result.rowCount} prospect${result.rowCount === 1 ? '' : 's'} to CSV`);
        announce(`Exported ${result.rowCount} prospect${result.rowCount === 1 ? '' : 's'}`);
      } else {
        showError('Export Failed', 'Unable to generate the export file. Please try again.');
        announce('Export failed');
      }
    } catch (error) {
      console.error('Export failed:', error);
      showError('Export Failed', 'An unexpected error occurred during export. Please try again.');
      announce('Export failed');
    } finally {
      setBulkActionModal(null);
      setIsExportingBulk(false);
    }
  }, [prospects, selectedProspectIds, clearSelection, announce, showSuccess, showError]);

  const handleBulkDelete = useCallback(async () => {
    const prospectsToDelete = prospects.filter(p => selectedProspectIds.has(p.id));
    const prospectIdsArray = Array.from(selectedProspectIds);
    setIsProcessingBulkAction(true);
    setDeletedProspects(prospectsToDelete);
    
    try {
      await bulkDeleteService.delete(prospectsToDelete, { soft: true, deletedBy: currentUser });

      // Remove from prospects list (soft delete)
      setProspects(prev => prev.filter(p => !selectedProspectIds.has(p.id)));
      
      // Also remove from selection if the selected prospect was deleted
      if (selectedProspect && selectedProspectIds.has(selectedProspect.id)) {
        setSelectedProspect(null);
      }
      
      clearSelection();
      setBulkActionModal(null);
      announce(`Deleted ${prospectIdsArray.length} prospect${prospectIdsArray.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Bulk delete failed', error);
      showError('Delete Failed', 'Unable to delete the selected prospects. Please try again.');
      announce('Failed to delete prospects');
    } finally {
      setIsProcessingBulkAction(false);
    }
  }, [prospects, selectedProspectIds, selectedProspect, clearSelection, announce, currentUser, showError]);

  const handleUndoDelete = useCallback(async () => {
    if (deletedProspects.length === 0) return;
    
    try {
      await bulkDeleteService.restore(deletedProspects.map(p => p.id));
      // Restore deleted prospects
      setProspects(prev => [...prev, ...deletedProspects]);
      setDeletedProspects([]);
      announce(`Restored ${deletedProspects.length} prospects`);
    } catch (error) {
      console.error('Undo delete failed', error);
      showError('Restore Failed', 'Unable to restore deleted prospects. Please try again.');
      announce('Failed to restore prospects');
    }
  }, [deletedProspects, announce, showError]);
  
  // AI State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  // Dashboard State (Sprint 28, enhanced Sprint 35)
  const [dashboardPeriod, setDashboardPeriod] = useState<TimePeriod>('month');
  const [dashboardCustomRange, setDashboardCustomRange] = useState<{ start: Date; end: Date } | undefined>();
  
  // Calculate date range from period
  const dashboardDateRange = useMemo(() => {
    if (dashboardPeriod === 'custom' && dashboardCustomRange) {
      return dashboardCustomRange;
    }
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;
    switch (dashboardPeriod) {
      case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'week': start = new Date(now); start.setDate(start.getDate() - 7); break;
      case 'quarter': start = new Date(now); start.setMonth(start.getMonth() - 3); break;
      case 'year': start = new Date(now); start.setFullYear(start.getFullYear() - 1); break;
      case 'month':
      default: start = new Date(now); start.setMonth(start.getMonth() - 1); break;
    }
    return { start, end };
  }, [dashboardPeriod, dashboardCustomRange]);
  
  // Dashboard data hook (Sprint 35)
  // Convert app prospects to aggregator format
  const aggregator = useMemo(() => {
    const prospectData: ProspectData[] = prospects.map(p => ({
      id: p.id,
      status: p.status,
      source: p.source,
      segment: p.tier,
      assignee: p.lastEditedBy,
      dealValue: p.score * 1000, // Approximate deal value from score
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
    }));
    const activityData: ActivityData[] = []; // Activities would come from activity tracker
    const userData = [{ id: 'me', name: currentUser }];
    return createAnalyticsAggregator({ prospects: prospectData, activities: activityData, users: userData });
  }, [prospects, currentUser]);
  
  const dashboard = useDashboardData(dashboardDateRange, { aggregator });
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Dashboard export handler (Sprint 35 - T35.2)
  const handleDashboardExport = async (format: 'png' | 'pdf') => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      if (format === 'png') {
        await dashboardExporter.downloadPng(dashboardRef.current, {
          dateRange: dashboardDateRange,
        });
        showSuccess('Export Complete', 'Dashboard exported as PNG');
      } else {
        await dashboardExporter.downloadPdf(dashboardRef.current, {
          dateRange: dashboardDateRange,
          includeHeader: true,
        });
        showSuccess('Export Complete', 'Dashboard exported as PDF');
      }
    } catch (error) {
      console.error('Export failed:', error);
      showError('Export Failed', 'Unable to export dashboard. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  // Import State (Sprint 29)
  const [showImportWizard, setShowImportWizard] = useState(false);
  
  // HubSpot OAuth (Sprint 34 - replaces fake state)
  const hubspot = useHubSpot();
  const hubspotConnectionStatus = hubspot.status;
  
  // Command Palette (Sprint 34)
  const commandPalette = useCommandPalette();
  
  // Offline Queue Status (Sprint 34)
  const offlineQueue = useOfflineQueue();
  
  // Presence (Sprint 34 - T34.4)
  const firebaseUser = user as { uid?: string; displayName?: string; email?: string; photoURL?: string } | null;
  const presence = usePresence({
    tenantId: appId,
    userId: firebaseUser?.uid || 'anonymous',
    displayName: currentUser === 'Me' ? 'You' : currentUser,
    email: firebaseUser?.email,
    avatarUrl: firebaseUser?.photoURL,
    enabled: !!firebaseUser?.uid,
  });
  
  // Track current view for presence
  usePresenceViewTracker(
    presence.service,
    activeTab,
    selectedProspect?.id
  );
  
  // Initialize from conversation manager's persisted history
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const persisted = conversationManager.getHistory();
    if (persisted.length > 0) {
      return persisted.map(m => ({ role: m.role, text: m.content }));
    }
    return [{ role: 'model', text: "I'm the YardFlow Brain. Loaded with Manifest strategy, Primo Brands case study ($1M+ margin per facility), and Network Effects framework. Ask me to draft messages, analyze prospects, or explain our value prop." }];
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Auth & Init ---
  useEffect(() => {
    const initAuth = async () => {
      if (!auth) {
        setLoading(false);
        return;
      }
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth failed", error);
      }
    };
    initAuth();
    
    // Load API Key from local storage if available
    const storedKey = localStorage.getItem('yardflow_gemini_key');
    if (storedKey) setGeminiApiKey(storedKey);

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  // --- Firestore Sync ---
  useEffect(() => {
    if (!user || !db) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'prospects'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const remoteData: { originalId?: string; status?: Prospect['status']; notes?: string; lastEditedBy?: string }[] = [];
      snapshot.forEach((docSnap) => {
        remoteData.push({ ...docSnap.data(), id: docSnap.id } as typeof remoteData[number]);
      });
      setProspects(prev => prev.map(p => {
        const remote = remoteData.find(r => r.originalId === p.id);
        return remote ? { ...p, status: remote.status ?? p.status, notes: remote.notes, lastEditedBy: remote.lastEditedBy } : p;
      }));
    }, (error) => {
      console.error("Snapshot error:", error);
      showError('Sync Error', 'Unable to sync with Firestore. Your changes may not be saved.');
    });
    return () => unsubscribe();
  }, [user, showError]);

  // Update conversation manager when prospect changes
  useEffect(() => {
    if (selectedProspect) {
      conversationManager.setProspectContext({
        name: selectedProspect.name,
        title: selectedProspect.title,
        company: selectedProspect.company,
        tier: selectedProspect.tier,
        score: selectedProspect.score,
        isOps: selectedProspect.isOps,
        isExec: selectedProspect.isExec,
        status: selectedProspect.status
      });
    } else {
      conversationManager.setProspectContext(null);
    }
  }, [selectedProspect]);

  // Calculate stats for context
  const stats = useMemo(() => {
    const total = prospects.length;
    const contacted = prospects.filter(p => p.status === 'contacted' || p.status === 'meeting_booked').length;
    const booked = prospects.filter(p => p.status === 'meeting_booked').length;
    const tier1 = prospects.filter(p => p.tier === 'Tier 1').length;
    return { total, contacted, booked, tier1 };
  }, [prospects]);

  // --- Gemini API Call with Full Context ---
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim()) return;
    if (!geminiApiKey) {
      setChatHistory(prev => [...prev, { role: 'user', text: chatInput }, { role: 'model', text: "⚠️ Please enter your Gemini API Key in Settings (gear icon) to enable the Brain." }]);
      setChatInput('');
      return;
    }

    const userMessage = chatInput;
    const newMsg: ChatMessage = { role: 'user', text: userMessage };
    setChatHistory(prev => [...prev, newMsg]);
    setChatInput('');
    setIsGenerating(true);

    // Add to conversation manager for persistence
    conversationManager.addMessage({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });

    try {
      // Build dynamic system prompt with context
      const prospectContext = selectedProspect ? {
        name: selectedProspect.name,
        title: selectedProspect.title,
        company: selectedProspect.company,
        tier: selectedProspect.tier,
        score: selectedProspect.score,
        isOps: selectedProspect.isOps,
        isExec: selectedProspect.isExec,
        status: selectedProspect.status
      } : null;

      const systemPrompt = buildSystemPrompt({
        prospect: prospectContext,
        stats: stats,
        recentActions: conversationManager.getRecentActions()
      });

      // Build conversation history for Gemini
      const contents = conversationManager.buildGeminiContents();

      // Use stable Gemini 1.5 Flash model with full conversation history
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });

      const data = await response.json();
      
      // Better error handling for API responses
      if (data.error) {
        const errorMsg = data.error.message || "API error occurred";
        setChatHistory(prev => [...prev, { role: 'model', text: `⚠️ API Error: ${errorMsg}` }]);
        return;
      }
      
      const botText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response. Check your API key.";
      
      // Add to conversation manager for persistence
      conversationManager.addMessage({
        role: 'model',
        content: botText,
        timestamp: Date.now()
      });
      
      setChatHistory(prev => [...prev, { role: 'model', text: botText }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setChatHistory(prev => [...prev, { role: 'model', text: "Error connecting to Gemini. Check your API key and try again." }]);
    } finally {
      setIsGenerating(false);
    }
  }, [chatInput, geminiApiKey, selectedProspect, stats]);

  // Clear chat history
  const handleClearHistory = useCallback(() => {
    conversationManager.clearHistory();
    setChatHistory([{ role: 'model', text: "I'm the YardFlow Brain. I've been loaded with the Manifest strategy docs, RFQ decks, and the Hitlist logic. Ask me to draft emails, analyze prospects, or explain 'Reynolds Number'." }]);
  }, []);

  // Export chat history
  const handleExportChat = useCallback((format: 'md' | 'json') => {
    const content = format === 'md' 
      ? conversationManager.exportAsMarkdown()
      : conversationManager.exportAsJSON();
    
    const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yardflow-chat-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const saveApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('yardflow_gemini_key', key);
  };

  // --- Email Update Handler ---
  const handleEmailUpdate = async (newEmail: string) => {
    if (!selectedProspect) return;
    const trimmedEmail = newEmail.trim();
    
    // Update local state
    setProspects(prev => prev.map(p => p.id === selectedProspect.id ? { ...p, email: trimmedEmail || undefined } : p));
    setSelectedProspect({ ...selectedProspect, email: trimmedEmail || undefined });
    
    // Track activity (use status_change type for email updates)
    activityTracker.track({
      type: 'status_change',
      user: currentUser,
      prospectId: selectedProspect.id,
      prospectName: selectedProspect.name,
      details: trimmedEmail ? `Added email: ${trimmedEmail}` : 'Removed email'
    });
    setRecentActivities(activityTracker.getRecent(15));
    
    // Persist to Firestore
    if (!user || !db) return;
    try {
      const docRef = doc(db, `artifacts/${appId}/users/${(user as { uid: string }).uid}/prospects`, selectedProspect.id);
      await setDoc(docRef, { email: trimmedEmail || null, updatedAt: Date.now() }, { merge: true });
      showSuccess('Email Updated', 'Contact email has been saved');
    } catch (err) {
      console.error('Failed to save email:', err);
      showError('Save Failed', 'Unable to save email to database. Changes saved locally.');
    }
  };

  // --- Logic ---
  const handleStatusUpdate = async (newStatus: Prospect['status']) => {
    if (!selectedProspect) return;
    const oldStatus = selectedProspect.status;
    setProspects(prev => prev.map(p => p.id === selectedProspect.id ? { ...p, status: newStatus } : p));
    setSelectedProspect({ ...selectedProspect, status: newStatus });
    
    // Track action for AI context
    conversationManager.addRecentAction({
      type: 'status_change',
      prospectId: selectedProspect.id,
      prospectName: selectedProspect.name,
      fromStatus: oldStatus,
      toStatus: newStatus,
      timestamp: Date.now()
    });
    
    // Track activity for collaboration feed
    activityTracker.track({
      type: 'status_change',
      user: currentUser,
      prospectId: selectedProspect.id,
      prospectName: selectedProspect.name,
      details: `Changed status from ${oldStatus} to ${newStatus}`
    });
    setRecentActivities(activityTracker.getRecent(15));
    
    if (!user || !db) return;
    try {
      const docId = `prospect_${selectedProspect.id}`;
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'prospects', docId);
      await setDoc(docRef, {
        originalId: selectedProspect.id,
        status: newStatus,
        lastEditedBy: currentUser,
        updatedAt: Timestamp.now(),
        name: selectedProspect.name
      }, { merge: true });
    } catch (e) { 
      console.error("Error saving status", e);
      showError('Save Failed', 'Could not save status change. Please try again.');
    }
  };

  const currentTemplates = useMemo(() => {
    if (!selectedProspect) return [];
    return TEMPLATES(selectedProspect, currentUser === 'Me' ? 'The YardFlow Team' : 'Jake');
  }, [selectedProspect, currentUser]);

  useEffect(() => {
    if (selectedProspect && currentTemplates.length > 0) {
      const tmpl = currentTemplates.find(t => t.id === selectedTemplateId) || currentTemplates[0];
      setGeneratedMessage(tmpl.body);
    }
  }, [selectedProspect, selectedTemplateId, currentUser, currentTemplates]);

  const charCount = generatedMessage.length;
  // Only apply 250 char limit to short DM templates (for Manifest app), not emails
  const currentTemplate = currentTemplates.find(t => t.id === selectedTemplateId);
  const isShortDM = currentTemplate?.type === 'short_dm';
  const isOverLimit = isShortDM && charCount > 250;

  const copyToClipboard = async () => {
    const result = await clipboardCopy(generatedMessage);
    if (result.success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
      handleStatusUpdate('drafted');
      showSuccess('Copied!', 'Message copied to clipboard');
    } else {
      console.error('Copy to clipboard failed:', result.error);
      showError('Copy failed', result.error || 'Could not copy to clipboard');
    }
  };

  // Send email to selected prospect
  const sendEmailToProspect = async () => {
    if (!selectedProspect) return;
    
    if (!selectedProspect.email) {
      setEmailSendStatus('no_email');
      setTimeout(() => setEmailSendStatus('idle'), 3000);
      return;
    }

    setIsSendingEmail(true);
    setEmailSendStatus('idle');

    try {
      const auth = await import('firebase/auth').then(m => m.getAuth());
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('You must be logged in to send emails');
      }

      const token = await user.getIdToken();
      const emailId = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': emailId,
        },
        body: JSON.stringify({
          id: emailId,
          to: selectedProspect.email,
          toName: selectedProspect.name,
          subject: `YardFlow for ${selectedProspect.company}`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${generatedMessage
              .replace(/https:\/\/calendly\.com\/[^\s]+/g, url => `<a href="${url}" style="color: #2563eb; text-decoration: underline;">${url}</a>`)
              .split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
          </div>`,
          text: generatedMessage,
          metadata: {
            prospectId: selectedProspect.id,
            prospectName: selectedProspect.name,
            source: 'ProspectDetail',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Handle rate limit specifically
        if (response.status === 429) {
          setEmailErrorMessage(errorData.message || 'Daily email limit reached. Try again tomorrow or set BYPASS_EMAIL_WARMUP=true in Vercel.');
          setEmailSendStatus('rate_limit');
          setTimeout(() => setEmailSendStatus('idle'), 8000);
          return;
        }
        throw new Error(errorData.error || `Failed to send: ${response.status}`);
      }

      setEmailSendStatus('success');
      handleStatusUpdate('contacted');
      setTimeout(() => setEmailSendStatus('idle'), 3000);
    } catch (err) {
      console.error('Email send failed:', err);
      setEmailErrorMessage((err as Error).message || 'Failed to send email');
      setEmailSendStatus('error');
      setTimeout(() => setEmailSendStatus('idle'), 5000);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'contacted': return 'bg-green-100 text-green-800 border-green-200';
      case 'meeting_booked': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'drafted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400" role="status" aria-label="Loading application">
      <Loader className="h-6 w-6 animate-spin mr-2" aria-hidden="true" />
      Loading War Room...
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      {/* PWA Components */}
      <PWAInstallPrompt />
      <PWAUpdateNotification />
      <OfflineBanner />
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} position="bottom-right" />
      
      {/* Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        commands={[
          {
            id: 'nav-hitlist',
            name: 'Go to Hitlist',
            description: 'View and manage prospects',
            category: 'Navigation',
            action: () => { setActiveTab('prospects'); commandPalette.close(); },
          },
          {
            id: 'nav-dashboard',
            name: 'Go to Dashboard',
            description: 'View analytics and KPIs',
            category: 'Navigation',
            action: () => { setActiveTab('dashboard'); commandPalette.close(); },
          },
          {
            id: 'nav-assistant',
            name: 'Go to AI Assistant',
            description: 'Chat with YardFlow Brain',
            category: 'Navigation',
            action: () => { setActiveTab('assistant'); commandPalette.close(); },
          },
          {
            id: 'nav-roi',
            name: 'Go to ROI Calculator',
            description: 'Calculate ROI for prospects',
            category: 'Navigation',
            action: () => { setActiveTab('roi'); commandPalette.close(); },
          },
          {
            id: 'nav-integrations',
            name: 'Go to Integrations',
            description: 'Manage connected apps',
            category: 'Navigation',
            action: () => { setActiveTab('integrations'); commandPalette.close(); },
          },
          {
            id: 'action-import',
            name: 'Import Prospects',
            description: 'Import from CSV or LinkedIn',
            category: 'Actions',
            action: () => { setShowImportWizard(true); commandPalette.close(); },
          },
          {
            id: 'action-settings',
            name: 'Open Settings',
            description: 'Configure your preferences',
            category: 'Actions',
            action: () => { setShowSettings(true); commandPalette.close(); },
          },
        ]}
        recentCommands={commandPalette.recentCommands}
      />
      
      {/* Screen reader live region for announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {announcement}
      </div>
      
      {/* Skip link for keyboard users */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>
      
      {/* Import Wizard Modal */}
      {showImportWizard && (
        <div 
          className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-wizard-title"
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <ImportWizard
              existingProspects={prospects}
              onComplete={(imported) => {
                setProspects(prev => [...prev, ...imported]);
                setShowImportWizard(false);
                announce(`Imported ${imported.length} prospects successfully`);
              }}
              onCancel={() => setShowImportWizard(false)}
            />
          </div>
        </div>
      )}
      
      {/* Settings Modal */}
      {showSettings && (
        <div 
          className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 id="settings-title" className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-slate-500" aria-hidden="true" />
              Settings
            </h3>
            
            {/* API Key Section */}
            <div className="mb-6">
              <label htmlFor="gemini-api-key" className="block text-xs font-semibold text-slate-500 uppercase mb-2">Gemini API Key</label>
              <input 
                id="gemini-api-key" 
                type="password" 
                placeholder="Paste AI Studio Key here..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={geminiApiKey}
                onChange={(e) => saveApiKey(e.target.value)}
              />
            </div>
            
            {/* Data Management Section */}
            <div className="border-t border-slate-200 pt-4 mb-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Data Management</h4>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const data = {
                      prospects: prospects,
                      exportDate: new Date().toISOString(),
                      version: '1.0.0'
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `yardflow-prospects-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-slate-500" />
                    Export Prospects (JSON)
                  </span>
                  <span className="text-xs text-slate-400">{prospects.length} records</span>
                </button>
                <button
                  onClick={() => {
                    const headers = ['Name', 'Company', 'Title', 'Tier', 'Status', 'Score'];
                    const csvRows = [
                      headers.join(','),
                      ...prospects.map(p => [
                        `"${p.name}"`,
                        `"${p.company}"`,
                        `"${p.title}"`,
                        p.tier,
                        p.status,
                        p.score
                      ].join(','))
                    ];
                    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `yardflow-prospects-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-slate-500" />
                    Export Prospects (CSV)
                  </span>
                  <span className="text-xs text-slate-400">Spreadsheet format</span>
                </button>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={() => setShowSettings(false)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header - visible only on mobile */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 p-3 flex items-center justify-between lg:hidden">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6 text-slate-700" aria-hidden="true" />
        </button>
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 bg-blue-600 rounded-lg flex items-center justify-center" aria-hidden="true">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-base text-slate-800">YardFlow <span className="text-blue-600">Hub</span></span>
        </div>
        <button 
          onClick={() => setShowSettings(true)} 
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5 text-slate-600" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - hidden on mobile, shown on lg+ */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg lg:shadow-sm
        transform transition-transform duration-300 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        pt-0 lg:pt-0
      `}>
        {/* Mobile close button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center" aria-hidden="true">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-800">YardFlow <span className="text-blue-600">Hub</span></h1>
          </div>
          <button 
            onClick={() => setIsMobileSidebarOpen(false)} 
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5 text-slate-600" aria-hidden="true" />
          </button>
        </div>
        
        <div className="p-4 border-b border-slate-100">
          {/* Desktop header - hidden on mobile */}
          <div className="hidden lg:flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center" aria-hidden="true">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h1 className="font-bold text-lg tracking-tight text-slate-800">YardFlow <span className="text-blue-600">Hub</span></h1>
            </div>
            <div className="flex items-center gap-2">
              <SyncStatus 
                status={offlineQueue.status} 
                pendingCount={offlineQueue.pendingCount}
                onRetry={offlineQueue.retry}
                showDetails={false}
              />
              <button 
                onClick={() => setShowSettings(true)} 
                className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
                aria-label="Open settings"
              >
                <Settings className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          
          {/* Tab Navigation - A11y: role="tablist" */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg mb-4" role="tablist" aria-label="Main navigation">
             <button 
               onClick={() => { setActiveTab('dashboard'); announce('Dashboard tab selected'); }} 
               role="tab"
               aria-selected={activeTab === 'dashboard'}
               aria-controls="panel-dashboard"
               id="tab-dashboard"
               className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
             >
               <LayoutDashboard className="h-3 w-3 mr-1" aria-hidden="true" /> Dashboard
             </button>
             <button 
               onClick={() => { setActiveTab('prospects'); announce('Targets tab selected'); }} 
               role="tab"
               aria-selected={activeTab === 'prospects'}
               aria-controls="panel-prospects"
               id="tab-prospects"
               className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'prospects' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
             >
               <Users className="h-3 w-3 mr-1" aria-hidden="true" /> Hitlist
             </button>
             <button 
               onClick={() => { setActiveTab('import'); announce('Import tab selected'); }} 
               role="tab"
               aria-selected={activeTab === 'import'}
               aria-controls="panel-import"
               id="tab-import"
               className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'import' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
             >
               <Upload className="h-3 w-3 mr-1" aria-hidden="true" /> Import
             </button>
             <button 
               onClick={() => { setActiveTab('integrations'); announce('Integrations tab selected'); }} 
               role="tab"
               aria-selected={activeTab === 'integrations'}
               aria-controls="panel-integrations"
               id="tab-integrations"
               className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'integrations' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
             >
               <Link2 className="h-3 w-3 mr-1" aria-hidden="true" /> Integrations
             </button>
             <button 
               onClick={() => { setActiveTab('assistant'); announce('AI Brain tab selected'); }} 
               role="tab"
               aria-selected={activeTab === 'assistant'}
               aria-controls="panel-assistant"
               id="tab-assistant"
               className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'assistant' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
             >
               <Bot className="h-3 w-3 mr-1" aria-hidden="true" /> Brain
             </button>
             <button 
               onClick={() => { setActiveTab('roi'); announce('ROI Calculator tab selected'); }} 
               role="tab"
               aria-selected={activeTab === 'roi'}
               aria-controls="panel-roi"
               id="tab-roi"
               className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'roi' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
             >
               <Calculator className="h-3 w-3 mr-1" aria-hidden="true" /> ROI
             </button>
          </div>

          {activeTab === 'prospects' && (
            <>
              <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-lg border border-slate-200 mb-4" role="group" aria-label="Sender selection">
                <span className="text-[10px] uppercase font-bold text-slate-400 pl-2" id="sender-label">Sender:</span>
                <button 
                  onClick={() => setCurrentUser('Me')} 
                  aria-pressed={currentUser === 'Me'}
                  className={`px-3 py-1 text-xs font-bold rounded ${currentUser === 'Me' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Me
                </button>
                <button 
                  onClick={() => setCurrentUser('Jake')} 
                  aria-pressed={currentUser === 'Jake'}
                  className={`px-3 py-1 text-xs font-bold rounded ${currentUser === 'Jake' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Jake
                </button>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input 
                  type="text" 
                  placeholder="Search prospects..." 
                  aria-label="Search prospects by name or company"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="group" aria-label="Filter by tier">
                {(['All', 'Tier 1', 'Tier 2', 'Tier 3'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTierFilter(t)}
                    aria-pressed={tierFilter === t}
                    className={`text-xs px-3 py-1 rounded-full whitespace-nowrap border ${
                      tierFilter === t 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {/* Date Range Picker (Sprint 35 - T35.4) */}
              <div className="mt-2" data-testid="hitlist-date-filter">
                <DateRangePicker
                  selectedPeriod={hitlistDatePeriod}
                  onPeriodChange={setHitlistDatePeriod}
                  customRange={hitlistCustomRange}
                  onCustomRangeChange={setHitlistCustomRange}
                />
              </div>

              {/* Sprint 72: View Mode Toggle (Company vs People) */}
              <div className="mt-3" data-testid="view-mode-toggle">
                <ViewModeToggle
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  peopleCount={filteredProspects.length}
                  companyCount={aggregatedCompanies.length}
                />
              </div>
              
              {/* Saved Filters UI - Wiring in SavedFiltersService */}
              <div className="mt-3 relative" data-testid="saved-filters">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <button
                      onClick={() => setShowSavedFiltersMenu(!showSavedFiltersMenu)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-slate-600">Saved Filters ({savedFilters.length})</span>
                      <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showSavedFiltersMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showSavedFiltersMenu && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                        {savedFilters.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 text-center">
                            No saved filters yet
                          </div>
                        ) : (
                          savedFilters.map(sf => (
                            <button
                              key={sf.id}
                              onClick={() => {
                                // Apply saved filter - restore tier filter from saved state
                                const firstCondition = sf.rootGroup?.conditions?.[0];
                                if (firstCondition && 'value' in firstCondition) {
                                  setTierFilter((firstCondition as FilterCondition).value as typeof tierFilter);
                                }
                                savedFiltersService.recordUsage(sf.id);
                                setShowSavedFiltersMenu(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                            >
                              <span className="flex items-center gap-2">
                                {sf.isPinned && <span className="text-orange-500">★</span>}
                                {sf.name}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  savedFiltersService.deleteFilter(sf.id);
                                  setSavedFilters(savedFiltersService.getAllFilters());
                                }}
                                className="text-slate-400 hover:text-red-500 p-1"
                                title="Delete filter"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setShowSaveFilterModal(true)}
                    className="px-3 py-2 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                    title="Save current filter"
                  >
                    <Save className="h-3 w-3" />
                  </button>
                </div>
                
                {/* Save Filter Modal */}
                {showSaveFilterModal && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-3">
                    <div className="text-xs font-medium text-slate-700 mb-2">Save Current Filter</div>
                    <input
                      type="text"
                      value={newFilterName}
                      onChange={(e) => setNewFilterName(e.target.value)}
                      placeholder="Filter name..."
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-2"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (newFilterName.trim()) {
                            const newFilter = savedFiltersService.createFilter(newFilterName.trim(), {
                              rootGroup: {
                                id: 'root',
                                type: 'and',
                                conditions: [{ id: '1', field: 'tier', operator: 'equals', value: tierFilter }],
                              },
                            });
                            setSavedFilters(savedFiltersService.getAllFilters());
                            setNewFilterName('');
                            setShowSaveFilterModal(false);
                            announce(`Filter "${newFilter.name}" saved`);
                          }
                        }}
                        className="flex-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setNewFilterName('');
                          setShowSaveFilterModal(false);
                        }}
                        className="px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Prospect list panel */}
        <div className="flex-1 overflow-y-auto" role="tabpanel" id="panel-prospects" aria-labelledby="tab-prospects">
          {activeTab === 'dashboard' ? (
            <div ref={dashboardRef} className="p-6 space-y-6" data-testid="dashboard-tab">
              {/* Dashboard Header with DateRangePicker */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-blue-100 text-xs font-medium uppercase tracking-wider">Analytics Dashboard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={dashboard.refetch}
                      disabled={dashboard.isLoading}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
                      aria-label="Refresh data"
                      data-testid="dashboard-refresh"
                    >
                      <RefreshCw className={`h-4 w-4 ${dashboard.isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {/* Export dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        disabled={isExporting}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                        aria-label="Export dashboard"
                        data-testid="dashboard-export"
                      >
                        <Download className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
                      </button>
                      {showExportMenu && (
                        <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                          <button
                            onClick={() => handleDashboardExport('png')}
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                            data-testid="export-png"
                          >
                            Export as PNG
                          </button>
                          <button
                            onClick={() => handleDashboardExport('pdf')}
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                            data-testid="export-pdf"
                          >
                            Export as PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-bold">GTM Performance</div>
                <div className="text-blue-200 text-xs mt-2 flex items-center justify-between">
                  <span>Real-time metrics from your outreach campaigns</span>
                  {dashboard.lastUpdated && (
                    <span className="text-blue-300">
                      Updated {dashboard.lastUpdated.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Date Range Picker */}
              <div className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between">
                <DateRangePicker
                  selectedPeriod={dashboardPeriod}
                  customRange={dashboardCustomRange}
                  onPeriodChange={setDashboardPeriod}
                  onCustomRangeChange={setDashboardCustomRange}
                />
                <div className="text-xs text-slate-500">
                  {dashboardDateRange.start.toLocaleDateString()} - {dashboardDateRange.end.toLocaleDateString()}
                </div>
              </div>
              
              {/* Error State - using DashboardStates */}
              {dashboard.error && (
                <ErrorState
                  title="Failed to load dashboard data"
                  message={dashboard.error.message || 'An error occurred while loading analytics. Please try again.'}
                  onRetry={dashboard.refetch}
                />
              )}
              
              {/* KPI Cards - use DashboardStates skeleton when loading */}
              {dashboard.isLoading ? (
                <KPIGridSkeleton count={4} columns={2} />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {dashboard.data.kpis.length > 0 ? (
                    dashboard.data.kpis.slice(0, 4).map(kpi => (
                      <KPICard key={kpi.id} metric={kpi} />
                    ))
                  ) : (
                    <>
                      <KPICard metric={{ id: 'total', name: 'Total Prospects', value: { current: stats.total, previous: stats.total, change: 0, changePercent: 0, trend: 'flat' }, format: 'number' }} />
                      <KPICard metric={{ id: 'booked', name: 'Meetings Booked', value: { current: stats.booked, previous: Math.floor(stats.booked * 0.8), change: stats.booked - Math.floor(stats.booked * 0.8), changePercent: 25, trend: 'up' }, format: 'number' }} />
                      <KPICard metric={{ id: 'rate', name: 'Contact Rate', value: { current: (stats.contacted / stats.total) * 100, previous: 50, change: (stats.contacted / stats.total) * 100 - 50, changePercent: 10, trend: 'up' }, format: 'percent' }} />
                      <KPICard metric={{ id: 'tier1', name: 'Tier 1 Pipeline', value: { current: stats.tier1, previous: stats.tier1, change: 0, changePercent: 0, trend: 'flat' }, format: 'number' }} />
                    </>
                  )}
                </div>
              )}

              {/* Leaderboard with skeleton loading */}
              {dashboard.isLoading ? (
                <LeaderboardSkeleton rows={3} />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Team Leaderboard</h3>
                  <Leaderboard
                    data={dashboard.data.team?.leaderboard ?? [
                      { userId: '1', userName: 'Me', totalActivities: 45, prospectsContacted: stats.contacted, dealsCreated: stats.booked, dealsWon: Math.floor(stats.booked * 0.5), revenue: stats.contacted * 10000, avgResponseTime: 2, rank: 1 },
                      { userId: '2', userName: 'Jake', totalActivities: 38, prospectsContacted: Math.floor(stats.contacted * 0.7), dealsCreated: Math.floor(stats.booked * 0.7), dealsWon: Math.floor(stats.booked * 0.35), revenue: stats.contacted * 8000, avgResponseTime: 3, rank: 2 },
                    ]}
                  />
                </div>
              )}

              {/* Charts Row (Sprint 35 - T35.3) - with skeleton loading */}
              <LoadingOverlay isLoading={dashboard.isLoading} message="Loading charts...">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* NEW: LineChart for Outreach Trends */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Outreach Trends (Last 7 Days)</h3>
                  <LineChart
                    data={{
                      series: [
                        {
                          name: 'Prospects Contacted',
                          color: '#3B82F6',
                          data: Array.from({ length: 7 }, (_, i) => {
                            const date = new Date();
                            date.setDate(date.getDate() - (6 - i));
                            return {
                              date: date.toISOString().split('T')[0],
                              value: Math.floor(Math.random() * 10) + (stats.contacted / 7),
                            };
                          }),
                        },
                        {
                          name: 'Meetings Booked',
                          color: '#10B981',
                          data: Array.from({ length: 7 }, (_, i) => {
                            const date = new Date();
                            date.setDate(date.getDate() - (6 - i));
                            return {
                              date: date.toISOString().split('T')[0],
                              value: Math.floor(Math.random() * 3) + (stats.booked / 7),
                            };
                          }),
                        },
                      ],
                    }}
                    height={200}
                    showLegend={true}
                    showGrid={true}
                    smooth={true}
                  />
                </div>

                {/* Funnel Chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Pipeline Funnel</h3>
                  <FunnelChart
                    data={dashboard.data.funnel?.stages ?? [
                      { id: 'new', name: 'New', count: stats.total, value: stats.total * 5000, conversionRate: 100, avgTimeInStage: 3, color: '#3B82F6' },
                      { id: 'contacted', name: 'Contacted', count: stats.contacted, value: stats.contacted * 5000, conversionRate: Math.round((stats.contacted / stats.total) * 100), avgTimeInStage: 5, color: '#8B5CF6' },
                      { id: 'booked', name: 'Booked', count: stats.booked, value: stats.booked * 10000, conversionRate: Math.round((stats.booked / stats.contacted) * 100), avgTimeInStage: 7, color: '#10B981' },
                    ]}
                    height={200}
                  />
                </div>

                {/* Activity Bar Chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Activity by Type</h3>
                  <BarChart
                    data={dashboard.data.activities?.byType.map(a => ({ label: a.label, value: a.count, color: '#3B82F6' })) ?? [
                      { label: 'Messages Sent', value: stats.contacted * 2, color: '#3B82F6' },
                      { label: 'Replies', value: Math.floor(stats.contacted * 0.3), color: '#10B981' },
                      { label: 'Meetings', value: stats.booked, color: '#F59E0B' },
                    ]}
                    height={200}
                  />
                </div>

                {/* Tier Distribution Pie */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Tier Distribution</h3>
                  <PieChart
                    data={[
                      { label: 'Tier 1', value: stats.tier1, color: '#F59E0B' },
                      { label: 'Tier 2', value: prospects.filter(p => p.tier === 'Tier 2').length, color: '#3B82F6' },
                      { label: 'Tier 3', value: prospects.filter(p => p.tier === 'Tier 3').length, color: '#8B5CF6' },
                    ]}
                    height={200}
                  />
                </div>

                {/* Status Distribution */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Outreach Status</h3>
                  <PieChart
                    data={[
                      { label: 'New', value: prospects.filter(p => p.status === 'new').length, color: '#6B7280' },
                      { label: 'Contacted', value: prospects.filter(p => p.status === 'contacted').length, color: '#3B82F6' },
                      { label: 'Booked', value: prospects.filter(p => p.status === 'meeting_booked').length, color: '#10B981' },
                    ]}
                    height={200}
                  />
                </div>
              </div>
              </LoadingOverlay>
            </div>
          ) : activeTab === 'import' ? (
            <ImportTab onOpenImportWizard={() => setShowImportWizard(true)} />
          ) : activeTab === 'integrations' ? (
            <IntegrationsTab 
              hubspot={hubspot} 
              hubspotConnectionStatus={hubspotConnectionStatus} 
            />
          ) : activeTab === 'stats' ? (
            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-md">
                <div className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">Total Booked</div>
                <div className="text-4xl font-bold">{stats.booked}</div>
                <div className="text-blue-200 text-xs mt-2">Meetings confirmed</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-slate-500 text-xs font-medium uppercase mb-1">Contacted</div>
                  <div className="text-2xl font-bold text-slate-800">{stats.contacted}</div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full" style={{ width: `${(stats.contacted / stats.total) * 100}%` }}></div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-slate-500 text-xs font-medium uppercase mb-1">Remaining</div>
                  <div className="text-2xl font-bold text-slate-800">{stats.total - stats.contacted}</div>
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <div className="flex items-center text-orange-800 font-bold text-sm mb-2">
                  <Zap className="h-4 w-4 mr-2" /> Tier 1 Progress
                </div>
                <div className="text-xs text-orange-700">
                  {stats.tier1} High Value Targets in pipeline. Focus here for maximum Co-Dev conversion.
                </div>
              </div>

              {/* Activity Feed */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Recent Activity</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{recentActivities.length} actions</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {recentActivities.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No recent activity. Status changes will appear here.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {recentActivities.map((activity) => (
                        <div key={activity.id} className="px-4 py-2.5 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              activity.user === 'Me' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {activity.user === 'Me' ? 'ME' : 'JK'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-700 truncate">
                                <span className="font-medium">{activity.user}</span>
                                {' → '}
                                <span className="font-medium text-slate-800">{activity.prospectName}</span>
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">{activity.details}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 flex-shrink-0 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'assistant' ? (
             <div className="p-4 text-center text-slate-500 text-sm">
               <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Bot className="h-8 w-8 text-blue-600" />
               </div>
               <p className="mb-2">This assistant is connected to the YardFlow Strategy Brain.</p>
               <p className="text-xs text-slate-400">Context loaded: RFQ Deck, Hitlist Logic, Manifest Outreach Doc</p>
             </div>
          ) : viewMode === 'companies' ? (
            /* Sprint 72: Company-centric view */
            <CompanyListView
              companies={aggregatedCompanies}
              onCompanySelect={(company) => {
                setSelectedCompany(company);
                // Also select first contact for detail panel
                if (company.contacts.length > 0) {
                  setSelectedProspect(company.contacts[0]);
                }
              }}
              onContactSelect={(prospect) => {
                setSelectedProspect(prospect);
              }}
              onResearchClick={(company) => {
                // TODO: Sprint 73 - Trigger AI research
                console.log('Research requested for:', company.company);
              }}
              selectedCompanyId={selectedCompany?.id}
              searchTerm={filter}
              onSearchChange={setFilter}
              sortBy={companySortBy}
              onSortChange={setCompanySortBy}
            />
          ) : (
            <div role="grid" aria-label="Prospect list" aria-multiselectable="true" className="divide-y divide-slate-100">
              <div
                role="row"
                className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-3 text-[11px] font-semibold text-slate-500 uppercase"
              >
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  aria-label="Select all prospects"
                  data-testid="select-all-checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAllToggle}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1">Prospect</span>
                <span className="w-32 text-right">Company</span>
                <span className="w-20 text-right">Tier</span>
                <span className="w-28 text-right">Status</span>
              </div>

              {filteredProspects.map(prospect => {
                const isRowSelected = isSelected(prospect.id);
                return (
                  <div
                    key={prospect.id}
                    role="row"
                    aria-selected={isRowSelected}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedProspect(prospect);
                      setIsMobileSidebarOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setSelectedProspect(prospect);
                        setIsMobileSidebarOpen(false);
                      }
                      // Spacebar toggles selection
                      if (e.key === ' ' || e.key === 'Spacebar') {
                        e.preventDefault();
                        toggleSelection(prospect.id, { extend: e.ctrlKey || e.metaKey });
                      }
                    }}
                    className={`px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors relative focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                      isRowSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${prospect.name}`}
                      data-testid={`row-checkbox-${prospect.id}`}
                      checked={isRowSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Use handleClick for proper shift/ctrl key handling
                        handleSelectionClick(prospect.id, { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey });
                      }}
                      onChange={() => {}}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className={`font-semibold text-sm truncate ${selectedProspect?.id === prospect.id ? 'text-blue-700' : 'text-slate-800'}`}>
                          {prospect.name}
                        </h3>
                        {prospect.lastEditedBy && prospect.lastEditedBy !== currentUser && prospect.status !== 'new' && (
                          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0 ml-1" title={`Updated by ${prospect.lastEditedBy}`} aria-label={`Updated by ${prospect.lastEditedBy}`} />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{prospect.title}</p>
                    </div>

                    <div className="w-32 min-w-0 text-right">
                      <div className="text-xs font-medium text-slate-700 flex items-center justify-end gap-1">
                        <Briefcase className="h-3 w-3 text-slate-400 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{prospect.company}</span>
                      </div>
                    </div>

                    <div className="w-20 text-right flex-shrink-0">
                      <span className="inline-flex items-center justify-end text-[11px] font-semibold text-slate-600">
                        {prospect.tier}
                        {prospect.tier === 'Tier 1' && (
                          <span className="ml-1 flex h-2 w-2 rounded-full bg-orange-500 ring-2 ring-orange-100" title="Tier 1" aria-label="Tier 1 priority target" />
                        )}
                      </span>
                    </div>
                    <div className="w-28 text-right">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${getStatusColor(prospect.status)}`}>
                        {prospect.status === 'meeting_booked' ? 'BOOKED' : prospect.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredProspects.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm" role="row">
                  No prospects found.
                </div>
              )}
            </div>
          )}
        </div>
        
        {activeTab === 'prospects' && viewMode === 'people' && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-400 text-center">
            {filteredProspects.length} Targets Loaded
          </div>
        )}
      </div>

      {/* Main Content */}
      <main id="main-content" className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative pt-14 lg:pt-0" role="main">
        {activeTab === 'assistant' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] lg:max-w-[80%] rounded-2xl p-3 lg:p-4 text-sm whitespace-pre-wrap ${
                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                   <div className="bg-white border border-slate-200 rounded-2xl p-4 rounded-bl-none shadow-sm flex items-center space-x-2">
                     <Loader className="h-4 w-4 animate-spin text-blue-600" />
                     <span className="text-xs text-slate-500">Brain is thinking...</span>
                   </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-slate-200">
               {/* Chat controls: Export and Clear */}
               {chatHistory.length > 1 && (
                 <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => handleExportChat('md')}
                       className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                       title="Export as Markdown"
                     >
                       <Download className="h-3 w-3" />
                       Export .md
                     </button>
                     <button
                       onClick={() => handleExportChat('json')}
                       className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                       title="Export as JSON"
                     >
                       <Download className="h-3 w-3" />
                       Export .json
                     </button>
                   </div>
                   <button
                     onClick={handleClearHistory}
                     className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                     title="Clear chat history"
                   >
                     <Trash2 className="h-3 w-3" />
                     <span className="hidden sm:inline">Clear</span>
                   </button>
                 </div>
               )}
               <div className="relative">
                 <input 
                   type="text" 
                   className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-14 py-3 text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                   placeholder="Ask the brain..."
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                   disabled={isGenerating}
                 />
                 <button 
                   onClick={handleSendMessage}
                   disabled={isGenerating}
                   className="absolute right-2 top-1.5 bg-blue-600 text-white p-2 lg:p-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 min-w-[40px] min-h-[40px] lg:min-w-[32px] lg:min-h-[32px] flex items-center justify-center"
                   aria-label="Send message"
                 >
                   <Send className="h-5 w-5 lg:h-4 lg:w-4" />
                 </button>
               </div>
            </div>
          </div>
        ) : activeTab === 'roi' ? (
          <div className="flex-1 overflow-y-auto">
            <ROITab 
              selectedProspect={selectedProspect}
              onGenerateDM={(dmLine: string) => {
                setGeneratedMessage(prev => prev ? `${prev}\n\n${dmLine}` : dmLine);
                setActiveTab('prospects');
              }}
            />
          </div>
        ) : activeTab === 'assets' ? (
          <div className="flex-1 overflow-y-auto">
            <AssetsPanel 
              selectedProspect={selectedProspect}
            />
          </div>
        ) : viewMode === 'companies' && selectedCompany ? (
          /* Sprint 72: Company Detail Panel when in company view */
          <CompanyDetailPanel
            company={selectedCompany}
            onContactSelect={(prospect) => {
              setSelectedProspect(prospect);
              // Switch to people view to show prospect details
              setViewMode('people');
            }}
            onResearchClick={(company) => {
              // TODO: Sprint 73 - Trigger AI research
              console.log('Research requested for:', company.company);
            }}
            onQueueOutreach={(company, contacts) => {
              // TODO: Sprint 75 - Queue outreach
              console.log('Queue outreach for:', company.company, 'contacts:', contacts.length);
            }}
          />
        ) : viewMode === 'companies' && !selectedCompany ? (
          /* Sprint 72: Empty state for company view */
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-4">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-600 text-center">Select a company to view details</p>
            <p className="text-sm mt-2 max-w-xs text-center">Choose from the company list to see ROI potential and contacts.</p>
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="mt-4 lg:hidden bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              View Companies
            </button>
          </div>
        ) : !selectedProspect ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-4">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-600 text-center">Select a target to start outreach</p>
            <p className="text-sm mt-2 max-w-xs text-center">Choose from the hitlist to generate a personalized Manifest message.</p>
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="mt-4 lg:hidden bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              View Prospects
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white px-4 lg:px-8 py-4 lg:py-6 border-b border-slate-200 shadow-sm">
              {/* Mobile back button */}
              <button 
                onClick={() => setSelectedProspect(null)}
                className="lg:hidden mb-3 text-blue-600 text-sm font-medium flex items-center gap-1"
              >
                <ChevronDown className="h-4 w-4 rotate-90" />
                Back to list
              </button>
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 lg:gap-3 mb-2">
                  <h2 className="text-xl lg:text-2xl font-bold text-slate-800">{selectedProspect.name}</h2>
                  {selectedProspect.tier === 'Tier 1' && (
                    <span className="bg-orange-100 text-orange-700 text-[10px] lg:text-xs font-bold px-2 py-1 rounded border border-orange-200">
                      TIER 1
                    </span>
                  )}
                  {selectedProspect.isOps && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded border border-blue-200">
                      OPS LEADER
                    </span>
                  )}
                  {/* Presence Indicator - shows who else is viewing this prospect */}
                  <PresenceIndicator
                    presenceService={presence.service}
                    filterDocId={selectedProspect.id}
                    size="sm"
                    showCount={false}
                    data-testid="presence-indicator"
                  />
                </div>
                <p className="text-slate-600 flex items-center">
                  <span className="font-medium mr-2">{selectedProspect.title}</span> 
                  <span className="text-slate-300 mx-2">|</span> 
                  <span>{selectedProspect.company}</span>
                </p>
                {/* Email Address with Confidence Indicator - EDITABLE */}
                <div className="mt-2 flex items-center gap-2">
                  {isEditingEmail ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={editingEmailValue}
                        onChange={(e) => setEditingEmailValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleEmailUpdate(editingEmailValue);
                            setIsEditingEmail(false);
                          } else if (e.key === 'Escape') {
                            setIsEditingEmail(false);
                          }
                        }}
                        placeholder="email@company.com"
                        className="text-sm px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          handleEmailUpdate(editingEmailValue);
                          setIsEditingEmail(false);
                        }}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingEmail(false)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : selectedProspect.email ? (
                    <div className="flex items-center gap-2">
                      <a 
                        href={`mailto:${selectedProspect.email}`}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {selectedProspect.email}
                      </a>
                      <EmailConfidenceBadge email={selectedProspect.email} />
                      <button
                        onClick={() => {
                          setEditingEmailValue(selectedProspect.email || '');
                          setIsEditingEmail(true);
                        }}
                        className="text-xs text-slate-400 hover:text-blue-600"
                        title="Edit email"
                      >
                        ✎
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingEmailValue('');
                        setIsEditingEmail(true);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 border border-dashed border-blue-300 px-2 py-1 rounded hover:bg-blue-50"
                    >
                      <span>+ Add email address</span>
                    </button>
                  )}
                </div>
                <div className="mt-4 flex items-center space-x-4">
                   <div className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">Hitlist Score:</span> {selectedProspect.score}
                   </div>
                   <div className="flex bg-slate-100 rounded-lg p-0.5">
                      {[
                        { s: 'new' as const, label: 'New', icon: Users },
                        { s: 'contacted' as const, label: 'Sent', icon: Send },
                        { s: 'meeting_booked' as const, label: 'Booked', icon: CheckCircle }
                      ].map((item) => (
                        <button
                          key={item.s}
                          onClick={() => handleStatusUpdate(item.s)}
                          className={`flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            selectedProspect.status === item.s 
                              ? 'bg-white text-blue-700 shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <item.icon className="h-3 w-3 mr-1.5" />
                          {item.label}
                        </button>
                      ))}
                   </div>
                </div>
              </div>
              
              <div className="hidden lg:flex flex-col items-end space-y-2">
                <div className="text-xs text-right text-slate-400">Co-Dev Potential</div>
                 {selectedProspect.tier === 'Tier 1' ? (
                   <div className="flex items-center text-green-600 font-semibold text-sm bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                     <Zap className="h-4 w-4 mr-1.5 fill-current" />
                     High Priority
                   </div>
                 ) : (
                   <div className="flex items-center text-slate-500 text-sm bg-slate-100 px-3 py-1.5 rounded-full">
                     Standard Outreach
                   </div>
                 )}
              </div>
              </div>
            </div>

            {/* Generator Area */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
                
                {/* Template Selection */}
                <div className="lg:col-span-4 space-y-3 lg:space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 lg:mb-4">Manifest App DMs (Max 250)</h3>
                  {currentTemplates.filter(t => t.type === 'short_dm').map(tmpl => (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all group ${
                        selectedTemplateId === tmpl.id
                          ? 'border-blue-600 bg-blue-50/30'
                          : 'border-white bg-white hover:border-blue-200 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-semibold ${selectedTemplateId === tmpl.id ? 'text-blue-700' : 'text-slate-700'}`}>
                          {tmpl.label}
                        </span>
                        {tmpl.id === 'dm_codev' && (
                          <Zap className="h-4 w-4 text-orange-500 fill-orange-500" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {tmpl.body}
                      </p>
                    </button>
                  ))}

                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 mt-8">Long Form (Email)</h3>
                  {currentTemplates.filter(t => t.type !== 'short_dm').map(tmpl => (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all group ${
                        selectedTemplateId === tmpl.id
                          ? 'border-blue-600 bg-blue-50/30'
                          : 'border-white bg-white hover:border-blue-200 shadow-sm'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${selectedTemplateId === tmpl.id ? 'text-blue-700' : 'text-slate-700'}`}>
                        {tmpl.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Editor */}
                <div className="lg:col-span-8 flex flex-col min-h-[400px] lg:h-full">
                  <div className={`bg-white rounded-xl shadow-sm border flex flex-col flex-1 overflow-hidden transition-colors ${isOverLimit ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}>
                    <div className="p-3 lg:p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        Draft Preview • <span className={isOverLimit ? 'text-red-600 font-bold' : 'text-slate-400'}>{charCount}{isShortDM ? '/250' : ''} chars{!isShortDM && ' (no limit for emails)'}</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                         {/* AI Generate Button */}
                         <button 
                           onClick={async () => {
                             if (!geminiApiKey || !selectedProspect) return;
                             setIsGeneratingTemplate(true);
                             try {
                               const style = selectedProspect.isExec ? 'exec_focused' : 'ops_focused';
                               const result = await generateTemplate({
                                 prospect: selectedProspect,
                                 style: selectedProspect.tier === 'Tier 1' ? 'codev' : style,
                                 senderName: currentUser === 'Me' ? 'The YardFlow Team' : 'Jake'
                               }, geminiApiKey);
                               setGeneratedMessage(result.body);
                               showSuccess('Template Generated', 'AI-powered message is ready for review');
                             } catch (e) {
                               console.error('Generation failed:', e);
                               showError('Generation Failed', 'Unable to generate template. Check your API key.');
                             } finally {
                               setIsGeneratingTemplate(false);
                             }
                           }}
                           disabled={!geminiApiKey || isGeneratingTemplate}
                           className="flex items-center text-xs text-purple-600 hover:text-purple-700 disabled:text-slate-300 px-2 py-1.5 rounded hover:bg-purple-50 transition-colors min-h-[36px]"
                           title={!geminiApiKey ? 'Add Gemini API key in Settings' : 'Generate with AI'}
                         >
                           {isGeneratingTemplate ? (
                             <Loader className="h-3 w-3 mr-1 animate-spin" />
                           ) : (
                             <Sparkles className="h-3 w-3 mr-1" />
                           )}
                           <span className="hidden sm:inline">AI Generate</span>
                           <span className="sm:hidden">AI</span>
                         </button>
                         {/* Refine Button */}
                         <button 
                           onClick={async () => {
                             if (!geminiApiKey || !selectedProspect || !generatedMessage) return;
                             setIsGeneratingTemplate(true);
                             try {
                               const refined = await refineTemplate(
                                 generatedMessage,
                                 'Make it more concise and punchy. Ensure under 250 chars.',
                                 selectedProspect,
                                 geminiApiKey
                               );
                               setGeneratedMessage(refined);
                               showSuccess('Template Refined', 'Message has been improved');
                             } catch (e) {
                               console.error('Refinement failed:', e);
                               showError('Refinement Failed', 'Unable to refine template. Please try again.');
                             } finally {
                               setIsGeneratingTemplate(false);
                             }
                           }}
                           disabled={!geminiApiKey || isGeneratingTemplate || !generatedMessage}
                           className="flex items-center text-xs text-blue-600 hover:text-blue-700 disabled:text-slate-300 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                           title="Refine with AI"
                         >
                           <RefreshCw className="h-3 w-3 mr-1" />
                           Refine
                         </button>
                         <button 
                           onClick={() => setGeneratedMessage(`Hi ${selectedProspect.name.split(' ')[0]},\n\n`)}
                           className="text-xs text-slate-400 hover:text-blue-600"
                         >
                           Reset
                         </button>
                      </div>
                    </div>
                    
                    <textarea 
                      className="flex-1 p-6 text-sm text-slate-700 leading-relaxed focus:outline-none resize-none font-mono bg-white"
                      value={generatedMessage}
                      onChange={(e) => setGeneratedMessage(e.target.value)}
                      placeholder="Select a template or click 'AI Generate' to create a personalized message..."
                    />
                    
                    {/* MessageQualityIndicator - Real-time quality feedback */}
                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                      <MessageQualityIndicator
                        message={generatedMessage}
                        channel="linkedin_dm"
                        persona={selectedProspect?.isOps ? 'ops_director' : selectedProspect?.isExec ? 'cfo' : undefined}
                        companyName={selectedProspect?.company}
                        prospectName={selectedProspect?.name}
                        compact={true}
                        showBreakdown={false}
                      />
                    </div>
                    
                    {/* Progress bar only shown for short DMs with 250 char limit */}
                    {isShortDM && (
                      <div className="h-1 w-full bg-slate-100">
                        <div 
                          className={`h-full transition-all duration-300 ${isOverLimit ? 'bg-red-500' : charCount > 200 ? 'bg-orange-400' : 'bg-blue-500'}`} 
                          style={{ width: `${Math.min((charCount / 250) * 100, 100)}%` }}
                        ></div>
                      </div>
                    )}
                    
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                      <div className="flex items-center">
                        {isOverLimit && (
                           <span className="text-xs text-red-600 font-bold flex items-center bg-red-50 px-2 py-1 rounded">
                             <AlertCircle className="h-3 w-3 mr-1" /> Over Limit (DM only)
                           </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleStatusUpdate('drafted')}
                          className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Draft
                        </button>
                        <button
                          onClick={copyToClipboard}
                          className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-md transform active:scale-95 ${
                            showCopied ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {showCopied ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Copy for DM
                            </>
                          )}
                        </button>
                        {/* Relative container for email button + error tooltip */}
                        <div className="relative">
                          <button
                            onClick={sendEmailToProspect}
                            disabled={isSendingEmail || !generatedMessage.trim()}
                            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-md transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                              emailSendStatus === 'success' 
                                ? 'bg-green-600' 
                                : emailSendStatus === 'error' || emailSendStatus === 'rate_limit'
                                  ? 'bg-red-600'
                                  : emailSendStatus === 'no_email'
                                    ? 'bg-amber-600'
                                    : 'bg-purple-600 hover:bg-purple-700'
                            }`}
                            title={
                              emailSendStatus === 'rate_limit' 
                                ? emailErrorMessage 
                                : selectedProspect?.email 
                                  ? `Send to ${selectedProspect.email}` 
                                  : 'No email address for this prospect'
                            }
                          >
                            {isSendingEmail ? (
                              <>
                                <Loader className="h-4 w-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : emailSendStatus === 'success' ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Sent!
                              </>
                            ) : emailSendStatus === 'error' ? (
                              <>
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Failed
                              </>
                            ) : emailSendStatus === 'rate_limit' ? (
                              <>
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Limit Hit
                              </>
                            ) : emailSendStatus === 'no_email' ? (
                              <>
                                <AlertCircle className="h-4 w-4 mr-2" />
                                No Email
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Send Email
                              </>
                            )}
                          </button>
                          {/* Error tooltip - positioned relative to button container */}
                          {(emailSendStatus === 'error' || emailSendStatus === 'rate_limit') && emailErrorMessage && (
                            <div className="absolute bottom-full right-0 mb-2 p-2 bg-red-100 border border-red-200 rounded-lg text-xs text-red-700 max-w-xs whitespace-normal z-10">
                              {emailErrorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                     <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Talking Points Logic</h4>
                     <p className="text-xs text-blue-700 mb-1">
                       <span className="font-bold">Ops:</span> "Fluid mechanics" & "Reynolds #" = Technical superiority over "visibility" platforms.
                     </p>
                     <p className="text-xs text-blue-700">
                       <span className="font-bold">Exec:</span> "Earnings Stability" = Financial impact. "Engineering Nodes" = Active management.
                     </p>
                  </div>
                </div>

              </div>
            </div>
          </>
        )}
      </main>

      {activeTab === 'prospects' && hasSelection && (
        <BulkActionsToolbar
          selectedCount={selectedCount}
          onAssignSequence={() => setBulkActionModal('sequence')}
          onAddTag={() => setBulkActionModal('tag')}
          onChangeStatus={() => setBulkActionModal('status')}
          onExport={handleBulkExport}
          onDelete={() => setBulkActionModal('delete')}
          onClear={clearSelection}
          isExporting={isExportingBulk}
          isProcessing={isProcessingBulkAction}
        />
      )}

      <BulkSequenceModal
        isOpen={bulkActionModal === 'sequence'}
        onClose={() => setBulkActionModal(null)}
        onConfirm={handleBulkAssignSequence}
        selectedCount={selectedCount}
      />

      <BulkTagModal
        isOpen={bulkActionModal === 'tag'}
        onClose={() => setBulkActionModal(null)}
        onConfirm={handleBulkAddTag}
        selectedCount={selectedCount}
      />

      <BulkStatusModal
        isOpen={bulkActionModal === 'status'}
        onClose={() => setBulkActionModal(null)}
        onConfirm={handleBulkChangeStatus}
        selectedCount={selectedCount}
      />

      <BulkDeleteModal
        isOpen={bulkActionModal === 'delete'}
        onClose={() => setBulkActionModal(null)}
        onConfirm={handleBulkDelete}
        onUndo={handleUndoDelete}
        selectedProspects={selectedProspects}
        isProcessing={isProcessingBulkAction}
      />
    </div>
  );
}
