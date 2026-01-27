import { useState, useEffect, useMemo, useRef } from 'react';
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
  BarChart2,
  AlertCircle,
  Bot,
  Loader
} from 'lucide-react';
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
interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
  tier: string;
  score: number;
  isOps: boolean;
  isExec: boolean;
  status: 'new' | 'drafted' | 'contacted' | 'meeting_booked';
  notes?: string;
  lastEditedBy?: string;
}

interface MessageTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
  type: 'intro' | 'codev' | 'technical' | 'short_dm';
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// --- The "Brain" Context (Extracted from your Docs) ---
const BRAIN_CONTEXT = `
You are the YardFlow Strategic Assistant for the Manifest 2026 conference.
**Your Mission:** Help the team book meetings and fill the Co-Development Program.

**Core Philosophy:** - Move from "Yard Management" (Passive Visibility) to "Yard Network Systems" (Active Engineering).
- Visibility without agency is just an "observation deck for chaos".

**Key Concepts:**
1. **Operational Reynolds Number:** A metric applying fluid mechanics to yard operations. Reduces friction in high-volume nodes. Use this when talking to Ops Leaders.
2. **Earnings Stability:** The shift from reactive logistics to deterministic outcomes. Use this when talking to Executives (C-Suite/VPs).
3. **Co-Development Program:** We are looking for 2-3 enterprise partners to take a "Voting Seat" on the roadmap for 2026. Reference "Primo Brands" as a successful case study (expanded from 24 to 260 facilities).

**Targeting Logic:**
- **Tier 1:** High volume, strategic fits (e.g., PPL, GXO, StockX, Unilever). Pitch the "Voting Seat" and Co-Dev.
- **Tier 2:** Standard outreach. Pitch "Fluidity" and "New Architecture".
- **Ops Leaders:** Care about the "Black Hole data problem" and daily friction.
- **Execs:** Care about "Growth levers" and "Financial impact".

**Constraints:**
- Manifest App DMs have a strict **250 character limit**.
- Tone: Professional, slightly technical, confident, challenger-sale style.
`;

// --- Seed Data ---
const INITIAL_PROSPECTS: Prospect[] = [
  { id: '1', name: 'Sheetal Shah', title: 'VP Supply Chain & CPO', company: 'PPL Electric', tier: 'Tier 1', score: 37, isOps: true, isExec: true, status: 'new' },
  { id: '2', name: 'Jeff Adams', title: 'VP Strategic Sourcing', company: 'Apothecary Products', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new' },
  { id: '3', name: 'Jamie Saucedo', title: 'VP Business Operations', company: 'GXO', tier: 'Tier 1', score: 157, isOps: true, isExec: true, status: 'new' },
  { id: '4', name: 'Alexis Takvorian', title: 'VP Global Transportation', company: 'StockX', tier: 'Tier 1', score: 125, isOps: true, isExec: true, status: 'new' },
  { id: '5', name: 'Andrew Sylling', title: 'Head of Procurement', company: 'Unilever', tier: 'Tier 1', score: 91, isOps: false, isExec: true, status: 'new' },
  { id: '6', name: 'Krenar Komoni', title: 'CEO & Founder', company: 'Tive', tier: 'Tier 2', score: 12, isOps: false, isExec: true, status: 'new' },
  { id: '7', name: 'Terry Frizelle', title: 'Head of Logistics Procurement', company: 'Dell Technologies', tier: 'Tier 1', score: 34, isOps: true, isExec: true, status: 'new' },
  { id: '8', name: 'Randy Pappal', title: 'VP Purchasing', company: 'Gentex Corporation', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new' },
];

// --- Templates ---
const TEMPLATES = (prospect: Prospect, senderName: string): MessageTemplate[] => [
  {
    id: 'dm_codev',
    label: 'App DM: Co-Dev Invite (Short)',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, launching YardFlow Co-Dev program. 2-3 enterprise partners get voting seats on roadmap. Given your role at ${prospect.company}, I'd love to share our "Reynolds #" research. Open to coffee? -${senderName}`
  },
  {
    id: 'dm_exec',
    label: 'App DM: Exec Strategy (Short)',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, shifting yard strategy from visibility to "Earnings Stability" by engineering the nodes themselves. I'd love to share how this impacts ${prospect.company} before sessions start. Chat? -${senderName}`
  },
  {
    id: 'dm_ops',
    label: 'App DM: Ops Fluidity (Short)',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, releasing new research on "Operational Reynolds #"—applying fluid mechanics to yard ops. Specific to high-volume sites like ${prospect.company}. Open to compare notes vs legacy YMS? -${senderName}`
  },
  {
    id: 'codev_invite',
    label: 'Email: Co-Development Invitation (Long)',
    type: 'codev',
    subject: `Manifest: Design Partner seat for ${prospect.company}?`,
    body: `Hi ${prospect.name.split(' ')[0]},\n\nI saw you're attending Manifest and wanted to flag something specific given your role at ${prospect.company}.\n\nWe're launching the YardFlow Co-Development Program—moving beyond standard "yard management" to a true Yard Network System. We're actively looking for 2-3 enterprise partners to take a voting seat at the table and shape the roadmap for 2026.\n\nSince you're dealing with high-volume complexity, I'd love to show you what "Operational Reynolds Number" metrics look like for a facility of your size.\n\nDo you have 10 mins at the show?\n\nBest,\n${senderName}`
  }
];

export default function App() {
  const [user, setUser] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<'prospects' | 'stats' | 'assistant'>('prospects');
  const [prospects, setProspects] = useState<Prospect[]>(INITIAL_PROSPECTS);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [currentUser, setCurrentUser] = useState<'Jake' | 'Me'>('Me');
  const [filter, setFilter] = useState('');
  const [tierFilter, setTierFilter] = useState<'All' | 'Tier 1' | 'Tier 2'>('All');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('dm_codev');
  const [showCopied, setShowCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // AI State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'model', text: "I'm the YardFlow Brain. I've been loaded with the Manifest strategy docs, RFQ decks, and the Hitlist logic. Ask me to draft emails, analyze prospects, or explain 'Reynolds Number'." }
  ]);
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

  // --- Gemini API Call ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    if (!geminiApiKey) {
      setChatHistory(prev => [...prev, { role: 'user', text: chatInput }, { role: 'model', text: "⚠️ Please enter your Gemini API Key in Settings (gear icon) to enable the Brain." }]);
      setChatInput('');
      return;
    }

    const newMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, newMsg]);
    setChatInput('');
    setIsGenerating(true);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: chatInput }] }],
          systemInstruction: { parts: [{ text: BRAIN_CONTEXT }] }
        })
      });

      const data = await response.json();
      const botText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
      
      setChatHistory(prev => [...prev, { role: 'model', text: botText }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setChatHistory(prev => [...prev, { role: 'model', text: "Error connecting to Gemini. Check your API key." }]);
    } finally {
      setIsGenerating(false);
    }
  };

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
    setProspects(prev => prev.map(p => p.id === selectedProspect.id ? { ...p, status: newStatus } : p));
    setSelectedProspect({ ...selectedProspect, status: newStatus });
    
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
      return matchesSearch && matchesTier;
    }).sort((a, b) => b.score - a.score);
  }, [prospects, filter, tierFilter]);

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

  // Stats Logic
  const stats = useMemo(() => {
    const total = prospects.length;
    const contacted = prospects.filter(p => p.status === 'contacted' || p.status === 'meeting_booked').length;
    const booked = prospects.filter(p => p.status === 'meeting_booked').length;
    const tier1 = prospects.filter(p => p.tier === 'Tier 1').length;
    return { total, contacted, booked, tier1 };
  }, [prospects]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">Loading War Room...</div>;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-slate-500" />
              Settings
            </h3>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Gemini API Key</label>
            <input 
              type="password" 
              placeholder="Paste AI Studio Key here..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={geminiApiKey}
              onChange={(e) => saveApiKey(e.target.value)}
            />
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

      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h1 className="font-bold text-lg tracking-tight text-slate-800">YardFlow <span className="text-blue-600">Hub</span></h1>
            </div>
            <button onClick={() => setShowSettings(true)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <Settings className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg mb-4">
             <button onClick={() => setActiveTab('prospects')} className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'prospects' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}>
               <Users className="h-3 w-3 mr-1" /> Targets
             </button>
             <button onClick={() => setActiveTab('stats')} className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'stats' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}>
               <BarChart2 className="h-3 w-3 mr-1" /> Stats
             </button>
             <button onClick={() => setActiveTab('assistant')} className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'assistant' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}>
               <Bot className="h-3 w-3 mr-1" /> Brain
             </button>
          </div>

          {activeTab === 'prospects' && (
            <>
              <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-lg border border-slate-200 mb-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 pl-2">Sender:</span>
                <button onClick={() => setCurrentUser('Me')} className={`px-3 py-1 text-xs font-bold rounded ${currentUser === 'Me' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>Me</button>
                <button onClick={() => setCurrentUser('Jake')} className={`px-3 py-1 text-xs font-bold rounded ${currentUser === 'Jake' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>Jake</button>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search prospects..." 
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {(['All', 'Tier 1', 'Tier 2'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTierFilter(t)}
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
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'stats' ? (
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
            <>
              {filteredProspects.map(prospect => (
                <div 
                  key={prospect.id}
                  onClick={() => setSelectedProspect(prospect)}
                  className={`p-4 border-b border-slate-100 cursor-pointer transition-colors group relative ${
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
                      <Briefcase className="h-3 w-3 mr-1 text-slate-400" />
                      {prospect.company}
                    </div>
                    {prospect.tier === 'Tier 1' && (
                      <span className="flex h-2 w-2 rounded-full bg-orange-500 ring-2 ring-orange-100" title="Tier 1" />
                    )}
                  </div>
                  
                  {prospect.lastEditedBy && prospect.lastEditedBy !== currentUser && prospect.status !== 'new' && (
                    <div className="absolute top-2 right-2 h-2 w-2 bg-blue-500 rounded-full animate-pulse" title={`Updated by ${prospect.lastEditedBy}`} />
                  )}
                </div>
              ))}
              {filteredProspects.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No prospects found.
                </div>
              )}
            </>
          )}
        </div>
        
        {activeTab === 'prospects' && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-400 text-center">
            {filteredProspects.length} Targets Loaded
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
        {activeTab === 'assistant' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 text-sm whitespace-pre-wrap ${
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
               <div className="relative">
                 <input 
                   type="text" 
                   className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                   placeholder="Ask the brain: 'Write a DM for a VP of Ops at Target'..."
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                   disabled={isGenerating}
                 />
                 <button 
                   onClick={handleSendMessage}
                   disabled={isGenerating}
                   className="absolute right-2 top-2 bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50"
                 >
                   <Send className="h-4 w-4" />
                 </button>
               </div>
            </div>
          </div>
        ) : !selectedProspect ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-600">Select a target to start outreach</p>
            <p className="text-sm mt-2 max-w-xs text-center">Choose from the hitlist on the left to generate a personalized Manifest message.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white px-8 py-6 border-b border-slate-200 shadow-sm flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-slate-800">{selectedProspect.name}</h2>
                  {selectedProspect.tier === 'Tier 1' && (
                    <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded border border-orange-200">
                      TIER 1 TARGET
                    </span>
                  )}
                  {selectedProspect.isOps && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded border border-blue-200">
                      OPS LEADER
                    </span>
                  )}
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
              
              <div className="flex flex-col items-end space-y-2">
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

            {/* Generator Area */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-12 gap-8 h-full">
                
                {/* Template Selection */}
                <div className="col-span-4 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Manifest App DMs (Max 250)</h3>
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
                <div className="col-span-8 flex flex-col h-full">
                  <div className={`bg-white rounded-xl shadow-sm border flex flex-col flex-1 overflow-hidden transition-colors ${isOverLimit ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}>
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-500">
                        Draft Preview • <span className={isOverLimit ? 'text-red-600 font-bold' : 'text-slate-400'}>{charCount}/250 chars</span>
                      </span>
                      <div className="flex gap-2">
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
                      placeholder="Select a template..."
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
      </div>
    </div>
  );
}
