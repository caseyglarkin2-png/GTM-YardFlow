import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// Sprint 1003: Virtualization for large prospect lists
import { useVirtualizer } from '@tanstack/react-virtual';
import { v4 as uuidv4 } from 'uuid';
// Critical icons only - used in loading state before lazy loading kicks in
import { Zap, Loader } from 'lucide-react';
// LazyIcon for all other icons - fixes INP by lazy loading
import { LazyIcon, preloadCriticalIcons } from './components/icons';
// Sprint 800: Desktop detection for responsive layout improvements
import { useIsDesktop } from './hooks/useMediaQuery';
import { initErrorTracking, setUserContext } from './services/ErrorTracking';
import { ConversationManagerSingleton } from './services/ConversationManager';
import { buildSystemPrompt } from './services/SystemPromptBuilder';
import { generateTemplate, refineTemplate } from './services/TemplateGenerator';
import { getActivityTracker } from './services/ActivityTracker';
import type { Activity as ActivityType } from './services/ActivityTracker';
import { 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where,
  orderBy,
  limit,
  onSnapshot, 
  getDocs,
  Timestamp, 
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, appId, hasFirebaseConfig } from './lib/firebase';

/*
// --- Firebase Configuration ---
// Moved to src/lib/firebase.ts
*/

/* 
const hasFirebaseConfig = ... 
const app = ...
const auth = ...
const db = ...
*/
// appId is imported from ./lib/firebase

// T100.2: Initialize error tracking
initErrorTracking();

// T1000.3: Log feature flags at startup for debugging
import { logFeatureFlagsOnStartup } from './config/featureFlags';
logFeatureFlagsOnStartup();

// T1003.1: Validate environment variables
import { validateEnv } from './utils/envValidation';
const envResult = validateEnv();
if (!envResult.valid) {
  console.error('❌ [YardFlow] Environment validation failed. Check console for details.');
}

// --- Types ---
import { Prospect, MessageTemplate, ChatMessage } from './types';
// HITLIST_PROSPECTS now loaded via useProspectState hook

// --- New Sprint 18-20 Components ---
import { ROITab } from './components/ROITab';
import { AssetsPanel } from './components/AssetsPanel';

// --- Sprint 72: Company-Centric View ---
import { CompanyListView } from './components/CompanyListView';
import { CompanyDetailPanel } from './components/CompanyDetailPanel';
import { ViewModeToggle, type ViewMode } from './components/ViewModeToggle';
import { aggregateByCompany, type CompanyRow } from './services/CompanyAggregator';
import { researchCompany, type CompanyResearchResult } from './services/CompanyResearchService';

// --- Sprint 26-33 Components ---
import { ImportWizard } from './components/ImportWizard';
import { EmailImportModal } from './components/EmailImportModal';
import { KPICard } from './components/KPICard';
import { Leaderboard } from './components/Leaderboard';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { OfflineBanner } from './components/OfflineBanner';
import type { TimePeriod, DateRange } from './types/analytics';

// --- Sprint 34 Hooks ---
import { useHubSpot } from './hooks/useHubSpot';
// --- Sprint 93: Prospect State Management ---
import { useProspectState } from './hooks/useProspectState';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import { usePresence, usePresenceViewTracker } from './hooks/usePresence';

// --- Sprint 35 Hooks ---

// --- Sprint 60 Services ---
import { copyToClipboard as clipboardCopy } from './services/ClipboardService';

// --- Sprint 80-81 Railway Integration ---
import { sendEmailViaRailway, isRailwayAvailable } from './services/RailwayEmailService';

// --- Sprint 81 Sequence Enrollment ---
import { useSequenceEnrollment } from './hooks/useSequenceEnrollment';
import { useSequences } from './hooks/useSequences';

// --- Sprint 24: Railway Email ---
import { useRailwayEmail } from './hooks/useRailwayEmail';
import { SequenceEnrollmentBadge } from './components/SequenceEnrollmentBadge';
import { useReplyNotifications } from './hooks/useReplyNotifications';

// --- Sprint 84: Sequence Performance ---
import { SequencePerformancePanel } from './components/SequencePerformancePanel';
import { SequenceManagerPanel } from './components/SequenceManagerPanel';

// --- Sprint 34 Components ---
import { CommandPalette } from './components/CommandPalette';
import { SyncStatus } from './components/SyncStatus';
import { PresenceIndicator } from './components/PresenceIndicator';

// --- Sprint 35 Components ---
import { DateRangePicker } from './components/DateRangePicker';

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
import { HitlistPanel } from './components/panels/HitlistPanel';
import { BulkStatusModal } from './components/BulkStatusModal';
import { BulkEmailModal, type BulkEmailProgress } from './components/BulkEmailModal';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';

// --- Toast Notification System ---
import { ToastContainer, useToast } from './components/Toast';
import { useRailwayHealth, type RailwayHealthStatus } from './hooks/useRailwayHealth';

// --- Sprint 47 Tab Components ---
import { IntegrationsTab, ImportTab } from './components/tabs';

// --- Sprint 36 Services (Bulk Operations) ---
import { BulkExporter } from './services/BulkExporter';
import { BulkDeleteService } from './services/BulkDeleteService';
import { BulkActionService } from './services/BulkActionService';
import { useMultiSelect } from './services/MultiSelectService';

// --- Sprint 84: Meeting Attribution ---
import { recordMeeting } from './services/MeetingAttributionService';

// --- Sprint 101: Email Health Status ---

// --- Sprint 800.3: Navigation Configuration ---
import { type TabId } from './config/navigation';

// --- Sprint 800.3: Desktop Layout ---
import { DesktopLayout, SidebarContent } from './components/layout';

// --- Sprint 34: Error Boundary for Panel Protection ---
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Sprint 2-4: Analytics & Sequence Components ---
import { SequenceBuilder } from './components/SequenceBuilder';

// --- Sprint 1004: Data Quality Panel ---
// Sprint 906: Manifest Dashboard Components
import { ChatPanel } from './components/panels/ChatPanel';
import { CampaignDashboard } from './components/panels/CampaignDashboard';
import { ProspectListPanel } from './components/panels/ProspectListPanel';
import { ProspectDetailPanel } from './components/panels/ProspectDetailPanel';
import { InboxPanel } from './components/panels/InboxPanel';
import { ProspectFormModal } from './components/ProspectFormModal';
import { useFilteredProspects } from './hooks/useFilteredProspects';


// Initialize singletons
const conversationManager = ConversationManagerSingleton.getInstance();
const activityTracker = getActivityTracker();
const bulkExporter = new BulkExporter();
const bulkDeleteService = new BulkDeleteService();
const bulkActionService = new BulkActionService();

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



// --- Templates moved to src/config/templates.ts ---

import { StatusPage } from './components/StatusPage';

export default function App() {
  // Sprint 904: Status Page Route
  if (typeof window !== 'undefined' && window.location.pathname === '/status') {
    return <StatusPage />;
  }

  // Sprint 800: Use desktop detection hook for responsive layout
  const isDesktop = useIsDesktop();
  const [user, setUser] = useState<unknown>(null);
  // TabId from navigation + detail view tabs (stats, assets) that aren't in main nav
  const [activeTab, setActiveTab] = useState<TabId | 'stats' | 'assets'>('prospects');
  // Sprint 93: Use centralized prospect state hook with Railway/Firestore toggle
  // The hook provides setProspects for direct updates, plus typed methods for common operations
  // These typed methods (updateProspect, etc.) can be used for Railway-aware operations
  const {
    prospects,
    setProspects,
    isLoading: isProspectsLoading,
    addProspects,
    updateProspect,
    // These methods are available for Railway-integrated updates when ready:
    // updateProspectStatus, updateProspectEmail,
    // deleteProspect, bulkDeleteProspects, bulkUpdateProspects,
    // dataSource: prospectDataSource,
  } = useProspectState();
  
  // Sprint 201: Inbox Badge Count
  const unreadReplyCount = useMemo(() => {
    return prospects.filter(p => p.status === 'replied' || p.needsResponse === true).length;
  }, [prospects]);

  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [currentUser, setCurrentUser] = useState<'Jake' | 'Me'>('Me');
  // Sprint 1002: Filter state with localStorage persistence
  const [filter, setFilter] = useState(() => {
    try {
      return localStorage.getItem('yardflow-filter') || '';
    } catch {
      return '';
    }
  });
  const [tierFilter, setTierFilter] = useState<'All' | 'Tier 1' | 'Tier 2' | 'Tier 3'>(() => {
    try {
      const saved = localStorage.getItem('yardflow-tier-filter');
      return (saved === 'All' || saved === 'Tier 1' || saved === 'Tier 2' || saved === 'Tier 3') ? saved : 'All';
    } catch {
      return 'All';
    }
  });
  // Ship Today: Email filter for quick filtering to sendable prospects
  const [emailFilter, setEmailFilter] = useState<'all' | 'has_email' | 'no_email'>(() => {
    try {
      const saved = localStorage.getItem('yardflow-email-filter');
      return (saved === 'all' || saved === 'has_email' || saved === 'no_email') ? saved : 'all';
    } catch {
      return 'all';
    }
  });
  // Sprint 32: Tag filter for filtering prospects by tag
  const [tagFilter, setTagFilter] = useState<string | null>(null);
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
  // Sprint 81.3: Sequence enrollment dropdown
  const [isSequenceDropdownOpen, setIsSequenceDropdownOpen] = useState(false);
  // Sprint 84.1: Meeting booking modal
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [isBookingMeeting, setIsBookingMeeting] = useState(false);
  // Sprint 3.1: Sequence Builder modal
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false);
  // Sprint 1004: Manual prospect entry
  const [showProspectForm, setShowProspectForm] = useState(false);
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

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSendStatus, setEmailSendStatus] = useState<'idle' | 'success' | 'error' | 'no_email' | 'rate_limit'>('idle');
  const [emailErrorMessage, setEmailErrorMessage] = useState<string>('');
  // Sprint 72: Company research state
  const [isResearchingCompany, setIsResearchingCompany] = useState<string | null>(null);
  const [_researchResults, setResearchResults] = useState<Map<string, CompanyResearchResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  
  // Mobile State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Activity State
  const [recentActivities, setRecentActivities] = useState<ActivityType[]>(() => 
    activityTracker.getRecent(15)
  );

  // Toast Notifications
  const { toasts, dismissToast, success: showSuccess, error: showError, warning: showWarning, info: showInfo } = useToast();

  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Railway health (for status indicator and offline toasts)
  const { status: railwayStatus } = useRailwayHealth();
  const previousRailwayStatus = useRef<RailwayHealthStatus>('checking');

  useEffect(() => {
    if (previousRailwayStatus.current === 'healthy' && railwayStatus === 'unhealthy') {
      showWarning('Connection lost', 'Working in offline mode.');
    } else if (previousRailwayStatus.current === 'unhealthy' && railwayStatus === 'healthy') {
      showSuccess('Connection restored', 'Railway is reachable again.');
    }
    previousRailwayStatus.current = railwayStatus;
  }, [railwayStatus, showSuccess, showWarning]);

  // T1002.3: Quick Copy Shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedProspect?.email) {
        // Only if not in an input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        e.preventDefault();
        clipboardCopy(selectedProspect.email);
        showSuccess('Email copied!', selectedProspect.email);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProspect, showSuccess]);

  // Keyboard Shortcuts Help (triggered by ?)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTextInput) return;

      const isQuestionMark = event.key === '?' || (event.key === '/' && event.shiftKey);
      if (!isQuestionMark) return;

      event.preventDefault();
      setShowShortcutsHelp(true);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Sequence Enrollment (Sprint 81)
  const { 
    sequences, 
    refreshSequences, 
    enrollments: _enrollments, // Used in real-time updates, accessed via getEnrollmentForProspect
    getEnrollmentForProspect,
    enrollProspects,
    pauseEnrollment,
    resumeEnrollment,
    cancelEnrollment: _cancelEnrollment, // Available for SequenceManagerPanel
    isEnrolling,
    // enrollmentProgress - available for future progress UI
  } = useSequenceEnrollment();

  // Sprint 1005: Railway Sequence Management
  const { 
    createSequence, 
    updateSequence, 
  } = useSequences();

  // Sprint 83.6: Real-time reply notifications
  useReplyNotifications({
    showToast: (type, title, message) => {
      if (type === 'success') showSuccess(title, message);
      else showInfo(title, message);
    },
    onNewReply: (reply) => {
      // Could add additional handling here, like highlighting the prospect
      console.log('New reply received:', reply);
    },
    enabled: !!user, // Only listen when authenticated
  });

  // Screen reader announcements
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    setTimeout(() => setAnnouncement(''), 1000);
  }, []);

  // Preload critical icons on mount to avoid layout shift
  useEffect(() => {
    preloadCriticalIcons();
  }, []);

  // Sprint 1002: Persist filter state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('yardflow-filter', filter);
      localStorage.setItem('yardflow-tier-filter', tierFilter);
      localStorage.setItem('yardflow-email-filter', emailFilter);
    } catch {
      // localStorage may not be available
    }
  }, [filter, tierFilter, emailFilter]);

  // Hook for filtering and searching (replaces local logic)
  const { filteredProspects, allTags } = useFilteredProspects({
    prospects,
    filter,
    tierFilter,
    emailFilter,
    hitlistDateRange,
    tagFilter
  });


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
  
  const [bulkActionModal, setBulkActionModal] = useState<'sequence' | 'tag' | 'status' | 'delete' | 'email' | null>(null);
  const [isProcessingBulkAction, setIsProcessingBulkAction] = useState(false);
  const [isExportingBulk, setIsExportingBulk] = useState(false);
  const [deletedProspects, setDeletedProspects] = useState<Prospect[]>([]);
  // Sprint 22A: Bulk email state
  const [isSendingBulkEmail, setIsSendingBulkEmail] = useState(false);
  const [bulkEmailProgress, setBulkEmailProgress] = useState<BulkEmailProgress>({ sent: 0, total: 0, failed: 0 });
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  
  // Sprint 1003: Virtualization ref for prospect list
  const prospectListRef = useRef<HTMLDivElement>(null);

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

  // Global keyboard shortcuts for bulk selection (Cmd/Ctrl+A, Escape, Cmd/Ctrl+C)
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

      // Sprint 1002: Cmd/Ctrl+C to copy selected prospect email
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedProspect?.email) {
        e.preventDefault();
        clipboardCopy(selectedProspect.email);
        announce(`Copied ${selectedProspect.email}`);
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
  }, [activeTab, selectAll, clearSelection, hasSelection, prospectIds.length, announce, selectedProspect]);


  // --- Bulk Action Handlers (wired to BulkActionService) ---
  const handleBulkAssignSequence = useCallback(async (sequenceId: string) => {
    const prospectIdsArray = Array.from(selectedProspectIds);
    setIsProcessingBulkAction(true);

    try {
      // Get prospect data for the selected IDs
      const selectedProspects = prospects.filter(p => prospectIdsArray.includes(p.id));
      
      // Use the real sequence enrollment service
      const results = await enrollProspects(selectedProspects, sequenceId);
      
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (failed === 0) {
        clearSelection();
        showSuccess(
          'Enrolled in Sequence',
          `${succeeded} prospect${succeeded === 1 ? '' : 's'} enrolled. First email will send at 9:15 AM.`
        );
        announce(`${succeeded} prospect${succeeded === 1 ? '' : 's'} enrolled in sequence`);
      } else if (succeeded > 0) {
        showWarning(
          'Partial Enrollment',
          `${succeeded} enrolled, ${failed} failed (already enrolled or invalid email)`
        );
        announce(`Partial success: ${succeeded} enrolled, ${failed} failed`);
      } else {
        showError('Enrollment Failed', 'Could not enroll any prospects. They may already be in this sequence.');
        announce('Failed to enroll prospects in sequence');
      }
    } catch (error) {
      console.error('Bulk sequence enrollment failed', error);
      showError('Enrollment Failed', 'Unable to enroll prospects. Please try again.');
      announce('Failed to enroll prospects in sequence');
    } finally {
      setBulkActionModal(null);
      setIsProcessingBulkAction(false);
    }
  }, [selectedProspectIds, prospects, enrollProspects, clearSelection, announce, showSuccess, showWarning, showError]);

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

  // Sprint 24: Railway Email Hook
  const { sendBatch, isRailwayEnabled } = useRailwayEmail();

  // Sprint 22A: Bulk Email Send Handler (Updated for Railway in Sprint 24)
  const handleBulkSendEmail = useCallback(async (subject: string, body: string, templateId: string) => {
    const eligibleProspects = selectedProspects.filter(p => p.email);
    if (eligibleProspects.length === 0) {
      showWarning('No emails', 'None of the selected prospects have email addresses.');
      return;
    }

    setIsSendingBulkEmail(true);
    setBulkEmailProgress({ sent: 0, total: eligibleProspects.length, failed: 0 });

    try {
      // Debug: log auth state
      console.log('[YardFlow] handleBulkSendEmail - auth object exists:', !!auth);
      console.log('[YardFlow] handleBulkSendEmail - currentUser:', auth?.currentUser?.uid || 'null');
      
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) {
        // Provide more specific error message
        if (!auth) {
          showError('Firebase Not Configured', 'Check VITE_FIREBASE_* environment variables in Vercel.');
        } else {
          showError('Auth Required', 'Authentication pending. Please wait a moment and try again.');
        }
        setIsSendingBulkEmail(false);
        return;
      }

      const token = await firebaseUser.getIdToken();

      // Build batch email items with personalization
      const emails = eligibleProspects.map(prospect => {
        const firstName = prospect.name.split(' ')[0] || prospect.name;
        const personalizedBody = body
          .replace(/\{first_name\}/g, firstName)
          .replace(/\{name\}/g, prospect.name)
          .replace(/\{company\}/g, prospect.company)
          .replace(/\{title\}/g, prospect.title);
        const personalizedSubject = subject
          .replace(/\{first_name\}/g, firstName)
          .replace(/\{name\}/g, prospect.name)
          .replace(/\{company\}/g, prospect.company)
          .replace(/\{title\}/g, prospect.title);
        
        return {
          to: prospect.email!,
          toName: prospect.name,
          subject: personalizedSubject,
          body: personalizedBody,
          htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">${personalizedBody.split('\n').map(line => `<p style="margin: 0 0 10px 0;">${line || '&nbsp;'}</p>`).join('')}</div>`,
          prospectId: prospect.id,
          metadata: { prospectName: prospect.name, templateId },
        };
      });

      console.log(`[BulkEmail] Sending ${emails.length} emails via ${isRailwayEnabled ? 'Railway' : 'local'}`);

      // Use the hook's sendBatch which handles Railway vs local routing
      const result = await sendBatch(emails, token);

      // Update progress from result
      setBulkEmailProgress({ sent: result.sent, total: result.total, failed: result.failed });

      // Update prospect status for successful sends
      for (const res of result.results) {
        if (res.success) {
          await updateProspect(res.prospectId, { status: 'contacted', lastContactedAt: new Date().toISOString() });
        }
      }

      setIsSendingBulkEmail(false);
      setBulkActionModal(null);
      clearSelection();
      
      if (result.sent > 0) {
        showSuccess('Emails Sent', `Successfully sent ${result.sent} email${result.sent > 1 ? 's' : ''}${isRailwayEnabled ? ' via Railway' : ''}.`);
        announce(`Sent ${result.sent} emails`);
      }
      if (result.failed > 0) {
        showWarning('Some Failed', `${result.failed} email${result.failed > 1 ? 's' : ''} failed to send.`);
      }
    } catch (err) {
      console.error('Bulk email failed:', err);
      showError('Email Failed', 'Failed to send bulk emails. Please try again.');
      setIsSendingBulkEmail(false);
    }
  }, [selectedProspects, auth, updateProspect, clearSelection, showSuccess, showWarning, showError, announce, sendBatch, isRailwayEnabled]);
  
  // AI State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  
  // Import State (Sprint 29)
  const [showImportWizard, setShowImportWizard] = useState(false);
  // Email Import Modal (Ship Today)
  const [showEmailImportModal, setShowEmailImportModal] = useState(false);
  
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
        console.warn('[YardFlow] Firebase Auth not initialized - check VITE_FIREBASE_* env vars');
        setLoading(false);
        return;
      }
      try {
        console.log('[YardFlow] Attempting anonymous sign-in...');
        const credential = await signInAnonymously(auth);
        console.log('[YardFlow] Anonymous sign-in successful:', credential.user.uid);
      } catch (error) {
        console.error("[YardFlow] Auth failed:", error);
        // Still set loading to false so UI doesn't hang
        setLoading(false);
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
        // T100.2: Set user context for error tracking
        if (u) {
          setUserContext({
            id: u.uid,
            email: u.email || undefined,
            name: u.displayName || undefined,
          });
        } else {
          setUserContext(null);
        }
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

      // Route through server-side proxy for API key security
      // Falls back to client-side if proxy unavailable and API key is set locally
      let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
      
      try {
        // Try server-side proxy first (secure - API key stays on server)
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents,
            systemInstruction: { parts: [{ text: systemPrompt }] }
          })
        });
        data = await response.json();
      } catch (proxyError) {
        // Fallback to client-side only if local API key is configured
        // This allows development without server-side setup
        if (geminiApiKey) {
          console.warn('[AI] Server proxy unavailable, using client-side API key');
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: contents,
              systemInstruction: { parts: [{ text: systemPrompt }] }
            })
          });
          data = await response.json();
        } else {
          throw proxyError;
        }
      }
      
      // Better error handling for API responses
      if (data.error) {
        const errorMsg = data.error.message || "API error occurred";
        setChatHistory(prev => [...prev, { role: 'model', text: `⚠️ API Error: ${errorMsg}` }]);
        return;
      }
      
      const botText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
      
      // Add to conversation manager for persistence
      conversationManager.addMessage({
        role: 'model',
        content: botText,
        timestamp: Date.now()
      });
      
      setChatHistory(prev => [...prev, { role: 'model', text: botText }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setChatHistory(prev => [...prev, { role: 'model', text: "Error connecting to AI service. Please try again later." }]);
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

  // Sprint 81.3: Handle single prospect sequence enrollment
  const handleEnrollInSequence = useCallback(async (sequenceId: string) => {
    if (!selectedProspect) return;

    if (!selectedProspect.email) {
      showWarning('Missing Email', 'Add an email address before enrolling in a sequence.');
      announce('Enrollment blocked: missing email');
      setIsSequenceDropdownOpen(false);
      return;
    }
    
    setIsSequenceDropdownOpen(false);
    
    const selectedSequence = sequences.find(s => s.id === sequenceId);
    const sequenceName = selectedSequence?.name || 'sequence';
    
    showInfo('Enrolling...', `Starting ${sequenceName} for ${selectedProspect.name}`);
    
    try {
      const results = await enrollProspects([selectedProspect], sequenceId);
      const result = results[0];
      
      if (result?.success) {
        showSuccess('Sequence Started', `${selectedProspect.name} enrolled in ${sequenceName}. First email scheduled.`);
        announce(`Enrolled in ${sequenceName}`);
      } else {
        showWarning('Enrollment Issue', result?.error || 'Could not enroll prospect');
      }
    } catch (err) {
      console.error('Failed to enroll prospect:', err);
      showError('Enrollment Failed', 'Could not start sequence. Please try again.');
    }
  }, [selectedProspect, sequences, enrollProspects, showInfo, showSuccess, showWarning, showError, announce]);

  // Sprint 1004: Handle manual prospect creation/editing
  const handleSaveProspect = useCallback(async (data: Partial<Prospect>) => {
    if (!addProspects) return;
    
    // Check required fields
    if (!data.name || !data.company) {
      showError('Validation Error', 'Name and Company are required');
      return;
    }

    try {
      if (selectedProspect && showProspectForm) {
         // This is an update to existing prospect
         if (updateProspect) {
             await updateProspect(selectedProspect.id, data);
             showSuccess('Prospect updated successfully');
         }
      } else {
        // Create new prospect
         const newProspect: Prospect = {
            id: uuidv4(),
            name: data.name,
            company: data.company,
            title: data.title || '',
            email: data.email || '',
            linkedinUrl: data.linkedinUrl || '',
            tier: data.tier || 'Tier 3',
            status: 'new',
            addedAt: new Date().toISOString(),
            lastContactedAt: null,
            notes: data.notes || '',
            tags: [],
            ...data
         } as Prospect;

         await addProspects([newProspect]);
         showSuccess('Prospect added successfully');
      }
      setShowProspectForm(false);
    } catch (error) {
       console.error('Failed to save prospect:', error);
       showError('Save Failed', 'Could not save prospect data.');
    }
  }, [addProspects, updateProspect, selectedProspect, showProspectForm, showSuccess, showError]);

  // Sprint 84.1: Handle meeting booking with attribution
  const handleBookMeeting = useCallback(async () => {
    if (!selectedProspect || !meetingDate) {
      showWarning('Missing Info', 'Please select a meeting date.');
      return;
    }
    
    setIsBookingMeeting(true);
    
    try {
      // Get enrollment if exists for attribution
      const enrollment = getEnrollmentForProspect(selectedProspect.id);
      
      // Find the most recent email sent to this prospect for first-touch attribution
      let firstTouchEmailId: string | undefined;
      let firstTouchTemplateId: string | undefined;
      
      if (db) {
        const emailsQuery = query(
          collection(db, 'email_events'),
          where('prospectId', '==', selectedProspect.id),
          where('type', '==', 'sent'),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        
        const emailsSnapshot = await getDocs(emailsQuery);
      
        if (!emailsSnapshot.empty) {
          const emailDoc = emailsSnapshot.docs[0].data();
          firstTouchEmailId = emailDoc.emailId;
          firstTouchTemplateId = emailDoc.templateId;
        }
      }
      
      // Record the meeting with full attribution
      await recordMeeting({
        prospectId: selectedProspect.id,
        prospectName: selectedProspect.name,
        companyName: selectedProspect.company,
        meetingDate: new Date(meetingDate),
        notes: meetingNotes || undefined,
        sequenceId: enrollment?.sequenceId,
        sequenceName: enrollment?.sequenceName,
        enrollmentId: enrollment?.enrollmentId,
        stepNumber: enrollment?.currentStepIndex,
        firstTouchEmailId,
        firstTouchTemplateId,
      });
      
      // Also update prospect status to meeting_booked
      if (db) {
        await setDoc(doc(db, 'prospects', selectedProspect.id), {
          status: 'meeting_booked',
          meetingDate: new Date(meetingDate),
          lastModified: serverTimestamp()
        }, { merge: true });
      }
      
      showSuccess('Meeting Booked! 🎉', `Meeting with ${selectedProspect.name} recorded for ${new Date(meetingDate).toLocaleDateString()}`);
      announce('Meeting booked successfully');
      
      // Reset modal state
      setShowMeetingModal(false);
      setMeetingDate('');
      setMeetingNotes('');
    } catch (err) {
      console.error('Failed to book meeting:', err);
      showError('Booking Failed', 'Could not record meeting. Please try again.');
    } finally {
      setIsBookingMeeting(false);
    }
  }, [selectedProspect, meetingDate, meetingNotes, getEnrollmentForProspect, showWarning, showSuccess, showError, announce]);

  // Sprint 72: Handle AI company research
  const handleCompanyResearch = useCallback(async (company: CompanyRow) => {
    if (isResearchingCompany) {
      showWarning('Research In Progress', 'Please wait for the current research to complete.');
      return;
    }
    
    setIsResearchingCompany(company.company);
    showInfo('AI Research', `Researching ${company.company}...`);
    
    try {
      const result = await researchCompany({
        companyName: company.company,
        researchDepth: 'standard',
      });
      
      // Store result
      setResearchResults(prev => new Map(prev).set(company.company, result));
      
      if (result.success && result.data) {
        showSuccess('Research Complete', `Found data for ${company.company}: ${result.data.facilityCount ?? 'Unknown'} facilities, ${result.data.industryCategory ?? 'Unknown'} industry`);
        
        // Update prospects with research data if available
        if (result.data.facilityCount !== undefined) {
          setProspects(prev => prev.map(p => 
            p.company === company.company 
              ? { ...p, facilities: result.data!.facilityCount }
              : p
          ));
        }
      } else {
        showWarning('Research Limited', result.error || 'Could not find complete data for this company.');
      }
    } catch (error) {
      console.error('Research error:', error);
      showError('Research Failed', 'Unable to research company. Please try again.');
    } finally {
      setIsResearchingCompany(null);
    }
  }, [isResearchingCompany, showInfo, showSuccess, showWarning, showError]);

  // Sprint 72: Handle queue outreach for company contacts
  const handleQueueOutreach = useCallback(async (company: CompanyRow, contacts: Prospect[]) => {
    if (contacts.length === 0) {
      showWarning('No Contacts', 'Please select contacts to queue for outreach.');
      return;
    }

    const withEmail = contacts.filter(c => c.email);
    const withoutEmail = contacts.filter(c => !c.email);

    if (withEmail.length === 0) {
      showWarning('No Emails', 'None of the selected contacts have email addresses.');
      return;
    }

    // Update status to "drafted" for selected contacts (ready for outreach)
    setProspects(prev => prev.map(p => 
      contacts.some(c => c.id === p.id) 
        ? { ...p, status: 'drafted' as const }
        : p
    ));

    // Select the contacts to highlight them
    contacts.forEach(c => toggleSelection(c.id));

    // Track activity
    contacts.forEach(contact => {
      activityTracker.track({
        type: 'status_change',
        user: currentUser,
        prospectId: contact.id,
        prospectName: contact.name,
        details: `Queued for outreach (${company.company})`
      });
    });
    setRecentActivities(activityTracker.getRecent(15));

    // Show success message
    if (withoutEmail.length > 0) {
      showSuccess(
        'Queued for Outreach', 
        `${withEmail.length} contacts queued. ${withoutEmail.length} skipped (no email).`
      );
    } else {
      showSuccess('Queued for Outreach', `${withEmail.length} contacts from ${company.company} queued.`);
    }

    // Open bulk sequence modal for next step
    setBulkActionModal('sequence');
  }, [currentUser, toggleSelection, showSuccess, showWarning]);



  // Send email to selected prospect
  // Sprint 101: Check feature flags to route email correctly
  const sendEmailToProspect = async (templateId: string, body: string, subject: string = 'YardFlow Update') => {
    if (!selectedProspect) return;
    
    if (!selectedProspect.email) {
      setEmailSendStatus('no_email');
      showWarning('Missing Email', 'Add an email address before sending.');
      setTimeout(() => setEmailSendStatus('idle'), 3000);
      return;
    }

    setIsSendingEmail(true);
    setEmailSendStatus('idle');

    try {
      // Sprint 101: Check if Railway is available (feature flags + health)
      const useRailway = await isRailwayAvailable();
      
      if (useRailway) {
        // Railway path - requires NextAuth session (future: auth bridge)
        console.log(`[Email] Railway enabled, sending via Railway → ${selectedProspect.email}`);
        
        const railwayResult = await sendEmailViaRailway({
          to: selectedProspect.email,
          toName: selectedProspect.name,
          subject: subject,
          htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${body
              .replace(/https:\/\/calendly\.com\/[^\s]+/g, url => `<a href="${url}" style="color: #2563eb; text-decoration: underline;">${url}</a>`)
              .split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
          </div>`,
          textBody: body,
          prospectId: selectedProspect.id,
        });

        if (railwayResult.success) {
          console.log('[Email] Railway send successful:', railwayResult.messageId);
          setEmailSendStatus('success');
          handleStatusUpdate('contacted');
          setTimeout(() => setEmailSendStatus('idle'), 3000);
          return;
        }
        
        // Railway failed - throw the error (no fallback when explicitly enabled)
        throw new Error(railwayResult.error || 'Railway email failed');
      }
      
      // Vercel path - Firebase auth required
      console.log(`[Email] Using Vercel SendGrid path → ${selectedProspect.email}`);
      
      const authModule = await import('firebase/auth');
      const authInstance = authModule.getAuth();
      const user = authInstance?.currentUser;
      
      if (!user) {
        throw new Error('Please sign in to send emails');
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
          subject: subject,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${body
              .replace(/https:\/\/calendly\.com\/[^\s]+/g, url => `<a href="${url}" style="color: #2563eb; text-decoration: underline;">${url}</a>`)
              .split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
          </div>`,
          text: body,
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
      
      {/* Email Import Modal (Ship Today - import emails from CSV to existing prospects) */}
      {showEmailImportModal && (
        <EmailImportModal
          prospects={prospects}
          onImportComplete={(updates) => {
            // Update prospects with new emails
            setProspects(prev => prev.map(p => {
              const update = updates.find(u => u.id === p.id);
              if (update) {
                return { ...p, email: update.email, emailSource: update.emailSource };
              }
              return p;
            }));
            showSuccess('Emails Imported', `Added ${updates.length} email addresses to prospects.`);
            announce(`Imported ${updates.length} email addresses`);
          }}
          onClose={() => setShowEmailImportModal(false)}
        />
      )}
      
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
              <LazyIcon name="Settings" className="h-5 w-5 mr-2 text-slate-500" aria-hidden="true" />
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
                    <LazyIcon name="Download" className="h-4 w-4 text-slate-500" />
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
                    <LazyIcon name="Download" className="h-4 w-4 text-slate-500" />
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
      {/* Skip to main content link for keyboard users */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
      
      <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 p-3 flex items-center justify-between lg:hidden">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <LazyIcon name="Menu" className="h-6 w-6 text-slate-700" aria-hidden="true" />
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
          <LazyIcon name="Settings" className="h-5 w-5 text-slate-600" aria-hidden="true" />
        </button>
      </div>

      <DesktopLayout
        sidebarWidth="medium"
        collapsible={true}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onMobileSidebarClose={() => setIsMobileSidebarOpen(false)}
        sidebar={(
          <SidebarContent
            activeTab={activeTab as any}
            onTabChange={setActiveTab}
            onSettingsClick={() => setShowSettings(true)}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            filter={filter}
            onFilterChange={setFilter}
            tierFilter={tierFilter}
            onTierFilterChange={(val) => setTierFilter(val as any)}
            onViewModeChange={setViewMode}
            viewMode={viewMode}
            emailFilter={emailFilter}
            onEmailFilterChange={(val) => setEmailFilter(val as any)}
            announce={announce}
            badgeCounts={{ inbox: unreadReplyCount }}
            tagFilter={tagFilter}
            onTagFilterChange={setTagFilter}
            allTags={allTags}
            railwayStatus={railwayStatus}
          />
        )}
        main={(
          <div id="main-content" className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative pt-14 lg:pt-0">
              {activeTab === 'dashboard' && (
                <ErrorBoundary name="Dashboard">
                  <CampaignDashboard prospects={prospects} currentUser={currentUser} stats={stats} />
                </ErrorBoundary>
              )}
              {activeTab === 'inbox' && (
                <ErrorBoundary name="Inbox">
                  <InboxPanel 
                    prospects={prospects} 
                    isLoading={isProspectsLoading}
                    onUpdateProspect={async (id, updates) => {
                       await updateProspect(id, updates);
                    }}
                    currentUser={currentUser}
                    onBookMeeting={() => setShowMeetingModal(true)}
                    onSendEmail={sendEmailToProspect}
                  />
                </ErrorBoundary>
              )}
              {activeTab === 'assistant' && (
                <ErrorBoundary name="AI Assistant">
                  <ChatPanel selectedProspect={selectedProspect} stats={stats} geminiApiKey={geminiApiKey} />
                </ErrorBoundary>
              )}
              {activeTab === 'roi' && (
                <ErrorBoundary name="ROI Calculator">
                  <ROITab selectedProspect={selectedProspect} />
                </ErrorBoundary>
              )}
              {activeTab === 'assets' && (
                <ErrorBoundary name="Assets">
                  <AssetsPanel selectedProspect={selectedProspect} />
                </ErrorBoundary>
              )}
              {activeTab === 'import' && (
                <ErrorBoundary name="Import">
                  <ImportWizard 
                    onCancel={() => setActiveTab('prospects')}
                    onComplete={(newProspects) => {
                      if (addProspects) addProspects(newProspects);
                      setActiveTab('prospects');
                    }}
                    existingProspects={prospects}
                  />
                </ErrorBoundary>
              )}
              {activeTab === 'prospects' && (
                <ErrorBoundary name="Hitlist">
                  <HitlistPanel
                    viewMode={viewMode}
                    selectedCompany={selectedCompany}
                    companies={aggregatedCompanies}
                    filteredProspects={filteredProspects}
                    allProspects={prospects}
                  isLoading={isProspectsLoading}
                  selectedProspect={selectedProspect}
                  onSelectProspect={setSelectedProspect}
                  onSelectCompany={(company) => {
                    setSelectedCompany(company);
                    if (company) setViewMode('companies');
                  }}
                  currentUser={currentUser}
                  getEnrollmentForProspect={getEnrollmentForProspect}
                  selection={{
                    isSelected,
                    handleSelectionClick,
                    toggleSelection,
                    toggleAll: handleSelectAllToggle,
                    isAllSelected
                  }}
                  onClearFilters={() => { setFilter(''); setTierFilter('All'); setEmailFilter('all'); setTagFilter(null); }}
                  onGoToImport={() => setActiveTab('import')}
                  onAddProspect={() => {
                    setSelectedProspect(null);
                    setShowProspectForm(true);
                  }}
                  onUpdateProspect={async (updates) => {
                    if (updates.status) await handleStatusUpdate(updates.status);
                    if (updates.email !== undefined) await handleEmailUpdate(updates.email || '');
                  }}
                  onBookMeeting={() => setShowMeetingModal(true)}
                  onSendEmail={sendEmailToProspect}
                />
                </ErrorBoundary>
              )}
          </div>
        )}
      />
      {activeTab === 'prospects' && hasSelection && (
        <BulkActionsToolbar
          selectedCount={selectedCount}
          onAssignSequence={() => setBulkActionModal('sequence')}
          onAddTag={() => setBulkActionModal('tag')}
          onChangeStatus={() => setBulkActionModal('status')}
          onExport={handleBulkExport}
          onDelete={() => setBulkActionModal('delete')}
          onClear={clearSelection}
          onSendEmail={() => setBulkActionModal('email')}
          isExporting={isExportingBulk}
          isProcessing={isProcessingBulkAction}
          isSendingEmail={isSendingBulkEmail}
        />
      )}

      {/* Sprint 22A: Bulk Email Modal */}
      <BulkEmailModal
        isOpen={bulkActionModal === 'email'}
        onClose={() => setBulkActionModal(null)}
        onConfirm={handleBulkSendEmail}
        selectedProspects={selectedProspects}
        isSending={isSendingBulkEmail}
        progress={bulkEmailProgress}
      />

      <BulkSequenceModal
        isOpen={bulkActionModal === 'sequence'}
        onClose={() => setBulkActionModal(null)}
        onConfirm={handleBulkAssignSequence}
        selectedCount={selectedCount}
        sequences={sequences}
        isLoading={isEnrolling}
        onRetry={refreshSequences}
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

      {/* Sprint 84.1: Meeting Booking Modal */}
      {showMeetingModal && selectedProspect && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowMeetingModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Log Meeting</h3>
              <button
                onClick={() => setShowMeetingModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <LazyIcon name="X" className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prospect
                </label>
                <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                  <div className="font-medium text-slate-800">{selectedProspect.name}</div>
                  <div className="text-xs text-slate-500">{selectedProspect.company}</div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Meeting Date *
                </label>
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  placeholder="Meeting context, topics discussed..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>
              
              {/* Attribution Preview */}
              {(() => {
                const enrollment = getEnrollmentForProspect(selectedProspect.id);
                return enrollment ? (
                  <div className="bg-blue-50 rounded-lg p-3 text-xs">
                    <div className="font-medium text-blue-800 mb-1">Attribution Preview</div>
                    <div className="text-blue-600">
                      Sequence: {enrollment.sequenceName} (Step {enrollment.currentStepIndex + 1}/{enrollment.totalSteps})
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMeetingModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBookMeeting}
                disabled={!meetingDate || isBookingMeeting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isBookingMeeting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <LazyIcon name="CheckCircle" className="h-4 w-4" />
                    Book Meeting
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ProspectFormModal
        isOpen={showProspectForm}
        onClose={() => setShowProspectForm(false)}
        onSave={handleSaveProspect}
        initialData={selectedProspect}
        mode={selectedProspect ? 'edit' : 'create'}
      />
    </div>
  );
}
