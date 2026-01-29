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
  TrendingUp
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

// --- Sprint 34 Components ---
import { CommandPalette } from './components/CommandPalette';
import { SyncStatus } from './components/SyncStatus';
import { PresenceIndicator } from './components/PresenceIndicator';

// --- Sprint 35 Components ---
import { DateRangePicker } from './components/DateRangePicker';
import { dashboardExporter } from './services/DashboardExporter';
import { FunnelChart, BarChart, PieChart } from './components/charts';

// Initialize singletons
const conversationManager = ConversationManagerSingleton.getInstance();
const activityTracker = getActivityTracker();

// --- Templates with Network Effects Messaging ---
const TEMPLATES = (prospect: Prospect, senderName: string): MessageTemplate[] => [
  {
    id: 'dm_codev',
    label: 'App DM: Co-Dev Network Effects',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, YardFlow Co-Dev: 2-3 partners get voting seats. Primo Brands saw $1M+ contribution margin across 25 facilities—now rolling to 260. Would love to share the network effects math for ${prospect.company}. Coffee? -${senderName}`
  },
  {
    id: 'dm_exec',
    label: 'App DM: Exec - Headcount Neutral',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, Primo Brands took on additional volume while staying headcount neutral in dock ops. Curious how ${prospect.company} handles yard-to-dock bottlenecks today? 10 min at Manifest? -${senderName}`
  },
  {
    id: 'dm_ops',
    label: 'App DM: Ops - Dock Optimization',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, we found bottom-quartile facilities waste 5 min/shipment on dock assignments alone. System-driven assignment is the fix. Want to compare notes on ${prospect.company}'s yard flow? -${senderName}`
  },
  {
    id: 'dm_carrier',
    label: 'App DM: Carrier Benchmarking',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, 40% of carriers have 10% of drivers underperforming in yard (slow check-in, slow BOL). We're benchmarking this across networks. Relevant for ${prospect.company}? Quick chat at Manifest? -${senderName}`
  },
  {
    id: 'codev_invite',
    label: 'Email: Co-Development Invitation',
    type: 'codev',
    subject: `Manifest: Network Effects Design Partner for ${prospect.company}?`,
    body: `Hi ${prospect.name.split(' ')[0]},

I saw you're attending Manifest and wanted to flag something specific for ${prospect.company}.

We're launching the YardFlow Co-Development Program—2-3 enterprise partners get a voting seat on the 2026 roadmap.

**The proof point:** Primo Brands (fka Nestlé Waters) is rolling YardFlow from 25 to 260 facilities. The ~25 running sites already added $1M+ in contribution margin—while staying headcount neutral in dock operations.

**The network effects thesis:**
- Standard data model across all yards = carrier benchmarking + bottleneck identification
- Real-time visibility = trailer pool optimization + dwell time alerts
- Standard protocols = faster driver navigation at every facility

Given ${prospect.company}'s scale, I'd love to walk through what this math looks like for your network.

10 minutes at the show?

Best,
${senderName}`
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
  // Hitlist date filter (Sprint 35 - T35.4)
  const [hitlistDatePeriod, setHitlistDatePeriod] = useState<TimePeriod>('all');
  const [hitlistCustomRange, setHitlistCustomRange] = useState<DateRange | undefined>(undefined);
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
  const [loading, setLoading] = useState(true);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  
  // Mobile State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Activity State
  const [recentActivities, setRecentActivities] = useState<ActivityType[]>(() => 
    activityTracker.getRecent(15)
  );
  
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
  const dashboard = useDashboardData(dashboardDateRange);
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
      } else {
        await dashboardExporter.downloadPdf(dashboardRef.current, {
          dateRange: dashboardDateRange,
          includeHeader: true,
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
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
    return [{ role: 'model', text: "I'm the YardFlow Brain. Loaded with Manifest strategy, Primo Brands case study ($1M+ margin from 25 facilities), and Network Effects framework. Ask me to draft messages, analyze prospects, or explain our value prop." }];
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
    }, (error) => console.error("Snapshot error:", error));
    return () => unsubscribe();
  }, [user]);

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
    } catch (e) { console.error("Error saving status", e); }
  };

  const filteredProspects = useMemo(() => {
    return prospects.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(filter.toLowerCase()) || 
                            p.company.toLowerCase().includes(filter.toLowerCase());
      const matchesTier = tierFilter === 'All' || p.tier === tierFilter;
      // Date filter (Sprint 35 - T35.4)
      let matchesDate = true;
      if (hitlistDateRange && p.createdAt) {
        const prospectDate = new Date(p.createdAt);
        matchesDate = prospectDate >= hitlistDateRange.start && prospectDate <= hitlistDateRange.end;
      }
      return matchesSearch && matchesTier && matchesDate;
    }).sort((a, b) => b.score - a.score);
  }, [prospects, filter, tierFilter, hitlistDateRange]);

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
  const isOverLimit = charCount > 250;

  const copyToClipboard = () => {
    const textArea = document.createElement("textarea");
    textArea.value = generatedMessage;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
      handleStatusUpdate('drafted');
    } catch (err) { console.error('Fallback copy failed', err); }
    document.body.removeChild(textArea);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'contacted': return 'bg-green-100 text-green-800 border-green-200';
      case 'meeting_booked': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'drafted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  // Screen reader announcements
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    setTimeout(() => setAnnouncement(''), 1000);
  }, []);

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
              
              {/* KPI Cards - use dashboard hook data if available, fall back to stats */}
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

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h3 className="text-sm font-bold text-slate-700 mb-4">Team Leaderboard</h3>
                <Leaderboard
                  data={dashboard.data.team?.leaderboard ?? [
                    { userId: '1', userName: 'Me', totalActivities: 45, prospectsContacted: stats.contacted, dealsCreated: stats.booked, dealsWon: Math.floor(stats.booked * 0.5), revenue: stats.contacted * 10000, avgResponseTime: 2, rank: 1 },
                    { userId: '2', userName: 'Jake', totalActivities: 38, prospectsContacted: Math.floor(stats.contacted * 0.7), dealsCreated: Math.floor(stats.booked * 0.7), dealsWon: Math.floor(stats.booked * 0.35), revenue: stats.contacted * 8000, avgResponseTime: 3, rank: 2 },
                  ]}
                />
              </div>

              {/* Charts Row (Sprint 35 - T35.3) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
            </div>
          ) : activeTab === 'import' ? (
            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl p-6 text-white shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="h-5 w-5" />
                  <span className="text-green-100 text-xs font-medium uppercase tracking-wider">Import Center</span>
                </div>
                <div className="text-2xl font-bold">LinkedIn Sales Navigator</div>
                <div className="text-green-200 text-xs mt-2">Import contacts from CSV exports</div>
              </div>
              
              <button
                onClick={() => setShowImportWizard(true)}
                className="w-full bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <div className="text-sm font-medium text-slate-700">Click to Import CSV</div>
                <div className="text-xs text-slate-500 mt-1">LinkedIn Sales Navigator exports supported</div>
              </button>
              
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-blue-800 mb-2">Import Features</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>✓ Automatic column mapping</li>
                  <li>✓ Duplicate detection & merging</li>
                  <li>✓ Company matching</li>
                  <li>✓ Tier classification</li>
                </ul>
              </div>
            </div>
          ) : activeTab === 'integrations' ? (
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
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    hubspotConnectionStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
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
                  {hubspot.error && (
                    <div className="mt-2 text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {hubspot.error}
                      <button 
                        onClick={hubspot.retry}
                        className="text-blue-600 hover:underline ml-auto"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {hubspot.isConnected && hubspot.portalId && (
                    <div className="mt-2 text-xs text-slate-500">
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
          ) : (
            <ul role="listbox" aria-label="Prospect list" className="divide-y divide-slate-100">
              {filteredProspects.map(prospect => (
                <li 
                  key={prospect.id}
                  role="option"
                  aria-selected={selectedProspect?.id === prospect.id}
                  onClick={() => { 
                    setSelectedProspect(prospect); 
                    setIsMobileSidebarOpen(false);
                  }}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') {
                      setSelectedProspect(prospect);
                      setIsMobileSidebarOpen(false);
                    }
                  }}
                  tabIndex={0}
                  className={`p-4 cursor-pointer transition-colors group relative focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                    selectedProspect?.id === prospect.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-semibold text-sm ${selectedProspect?.id === prospect.id ? 'text-blue-700' : 'text-slate-800'}`}>
                      {prospect.name}
                    </h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${getStatusColor(prospect.status)}`}>
                      {prospect.status === 'meeting_booked' ? 'BOOKED' : prospect.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mb-2">{prospect.title}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs font-medium text-slate-700">
                      <Briefcase className="h-3 w-3 mr-1 text-slate-400" aria-hidden="true" />
                      {prospect.company}
                    </div>
                    {prospect.tier === 'Tier 1' && (
                      <span className="flex h-2 w-2 rounded-full bg-orange-500 ring-2 ring-orange-100" title="Tier 1" aria-label="Tier 1 priority target" />
                    )}
                  </div>
                  
                  {prospect.lastEditedBy && prospect.lastEditedBy !== currentUser && prospect.status !== 'new' && (
                    <div className="absolute top-2 right-2 h-2 w-2 bg-blue-500 rounded-full animate-pulse" title={`Updated by ${prospect.lastEditedBy}`} aria-label={`Updated by ${prospect.lastEditedBy}`} />
                  )}
                </li>
              ))}
              {filteredProspects.length === 0 && (
                <li className="p-8 text-center text-slate-400 text-sm">
                  No prospects found.
                </li>
              )}
            </ul>
          )}
        </div>
        
        {activeTab === 'prospects' && (
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
                        Draft Preview • <span className={isOverLimit ? 'text-red-600 font-bold' : 'text-slate-400'}>{charCount}/250 chars</span>
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
                             } catch (e) {
                               console.error('Generation failed:', e);
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
                             } catch (e) {
                               console.error('Refinement failed:', e);
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
                    
                    <div className="h-1 w-full bg-slate-100">
                      <div 
                        className={`h-full transition-all duration-300 ${isOverLimit ? 'bg-red-500' : charCount > 200 ? 'bg-orange-400' : 'bg-blue-500'}`} 
                        style={{ width: `${Math.min((charCount / 250) * 100, 100)}%` }}
                      ></div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                      <div className="flex items-center">
                        {isOverLimit && (
                           <span className="text-xs text-red-600 font-bold flex items-center bg-red-50 px-2 py-1 rounded">
                             <AlertCircle className="h-3 w-3 mr-1" /> Over Limit
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
                          className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-md transform active:scale-95 ${
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
                              Copy for App
                            </>
                          )}
                        </button>
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
    </div>
  );
}
