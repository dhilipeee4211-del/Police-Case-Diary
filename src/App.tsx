/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  UploadCloud, 
  CheckCircle, 
  ArrowRight, 
  Lock, 
  RefreshCw, 
  FileDown, 
  ExternalLink, 
  Trash2, 
  LogOut, 
  AlertCircle, 
  HelpCircle,
  FileCheck2,
  ListFilter,
  Plus,
  Trash,
  ChevronRight,
  Sparkles,
  Layers,
  Save,
  Check,
  Search,
  Database,
  History,
  Eye,
  ChevronDown,
  Mic,
  MicOff,
  Edit3,
  Shield,
  Activity,
  Play,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initAuth, googleSignIn, logout } from './firebase';
import { uploadAndConvertPdf, exportToDocx } from './converter';
import { generateCaseDiaryDocx, generateMultipleCaseDiariesDocx } from './exportDocx';
import { exportDiariesToZip } from './exportZip';
import { User } from 'firebase/auth';
import { CaseDiary, Accused, SavedDatabase } from './types';
import { saveSavedDatabase, getSavedDatabases, deleteSavedDatabase } from './dbHelper';
import { extractTextFromPdfClientSide, loadPdfJs } from './clientOcr';

const ALLOWED_EMAILS = [
  'dhilipeee4211@gmail.com',
  'dhileepank2@gmail.com',
  'kgrraju4628@gmail.com'
];

const getUserRole = (email?: string | null) => {
  if (!email) return { name: 'Guest User', badge: 'Guest', level: 'guest', color: 'gray' };
  const lowerEmail = email.toLowerCase().trim();
  if (lowerEmail === 'dhilipeee4211@gmail.com') {
    return { name: 'Administrator', badge: 'Admin', level: 'admin', color: 'gold' };
  }
  if (lowerEmail === 'dhileepank2@gmail.com' || lowerEmail === 'kgrraju4628@gmail.com') {
    return { name: 'Regular User', badge: 'User', level: 'user', color: 'blue' };
  }
  return { name: 'Guest User', badge: 'Guest', level: 'guest', color: 'gray' };
};

// Outlined Material Input Component
interface OutlinedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  value?: any;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  onClear?: () => void;
}

function OutlinedInput({ label, value, onChange, onClear, className = '', ...props }: OutlinedInputProps) {
  return (
    <div className="relative w-full group">
      <input
        value={value}
        onChange={onChange}
        placeholder=" "
        className={`peer w-full pt-5 pb-1.5 px-3.5 bg-white/60 focus:bg-white/95 border border-gray-200 focus:border-indigo-650 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl text-xs font-semibold text-gray-900 focus:outline-none transition-all placeholder-transparent shadow-sm hover:border-gray-300 ${className}`}
        {...props}
      />
      <label className="absolute left-3.5 top-3.5 text-xs font-bold text-gray-400 peer-placeholder-shown:text-xs peer-placeholder-shown:top-3.5 peer-placeholder-shown:left-3.5 peer-focus:top-1.5 peer-focus:left-3 peer-focus:text-[9px] peer-focus:text-indigo-650 transition-all pointer-events-none uppercase tracking-wider scale-100 peer-focus:scale-90 origin-top-left
        peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-[9px] peer-[:not(:placeholder-shown)]:scale-90 peer-[:not(:placeholder-shown)]:text-indigo-650">
        {label}
      </label>
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 text-xs font-bold transition-all cursor-pointer z-10"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Outlined Material Textarea Component with voice dictation support
interface OutlinedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  value?: any;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onVoiceClick?: () => void;
  isListening?: boolean;
  className?: string;
  rows?: number;
}

function OutlinedTextarea({ label, value, onChange, onVoiceClick, isListening, className = '', rows = 3, ...props }: OutlinedTextareaProps) {
  return (
    <div className="relative w-full group">
      <textarea
        value={value}
        onChange={onChange}
        placeholder=" "
        rows={rows}
        className={`peer w-full pt-5 pb-1.5 pl-3.5 pr-12 bg-white/60 focus:bg-white/95 border border-gray-200 focus:border-indigo-650 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none transition-all placeholder-transparent shadow-sm hover:border-gray-300 ${className}`}
        {...props}
      />
      <label className="absolute left-3.5 top-3.5 text-xs font-bold text-gray-400 peer-placeholder-shown:text-xs peer-placeholder-shown:top-3.5 peer-placeholder-shown:left-3.5 peer-focus:top-1.5 peer-focus:left-3 peer-focus:text-[9px] peer-focus:text-indigo-650 transition-all pointer-events-none uppercase tracking-wider scale-100 peer-focus:scale-90 origin-top-left
        peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-[9px] peer-[:not(:placeholder-shown)]:scale-90 peer-[:not(:placeholder-shown)]:text-indigo-650">
        {label}
      </label>
      {onVoiceClick && (
        <button
          type="button"
          onClick={onVoiceClick}
          className={`absolute right-3.5 top-3 p-1.5 rounded-lg border transition-all cursor-pointer z-10 ${
            isListening
              ? 'bg-red-500 hover:bg-red-650 text-white border-red-600 animate-pulse-ripple'
              : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-300 shadow-sm'
          }`}
          title="Voice Typing (Tamil/English)"
        >
          {isListening ? (
            <MicOff className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-indigo-500" />
          )}
        </button>
      )}
    </div>
  );
}



export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Custom Selection Checkbox States
  const [selectedSearchCaseIds, setSelectedSearchCaseIds] = useState<{ dbId: string; diaryId: string }[]>([]);
  const [selectedWorkspaceCaseIds, setSelectedWorkspaceCaseIds] = useState<string[]>([]);

  // Admin Access Panel States
  const [adminAccessMap, setAdminAccessMap] = useState<Record<string, string[]>>({});
  const [adminTargetEmail, setAdminTargetEmail] = useState<string>('');
  const [adminSelectedDbId, setAdminSelectedDbId] = useState<string>('');
  const [isUpdatingAccess, setIsUpdatingAccess] = useState<boolean>(false);

  // Conversion States
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionMode, setExtractionMode] = useState<'direct' | 'free'>('free');
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [extractionStep, setExtractionStep] = useState<string>('');
  const [extractionLogs, setExtractionLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Pause/Resume & Custom Starting Page States
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const [startPageInput, setStartPageInput] = useState<number>(1);
  const [currentExtractionQueue, setCurrentExtractionQueue] = useState<{
    chunks: any[];
    mode: 'free' | 'direct';
    filename: string;
    nextIndex: number;
    chunkSize: number;
    startPageOffset: number;
  } | null>(null);
  const [showWorkspaceSearch, setShowWorkspaceSearch] = useState<boolean>(false);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState<string>('');

  // Workspace States
  const [diaries, setDiaries] = useState<CaseDiary[]>([]);
  const [selectedDiaryId, setSelectedDiaryId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBulkExporting, setIsBulkExporting] = useState<boolean>(false);

  // Saved Databases / History States
  const [savedDatabases, setSavedDatabases] = useState<SavedDatabase[]>([]);
  const [isLoadingDbs, setIsLoadingDbs] = useState<boolean>(false);
  const [dbNameInput, setDbNameInput] = useState<string>('');
  const [selectedSavedDbId, setSelectedSavedDbId] = useState<string | null>(null);
  const [showSaveDbPrompt, setShowSaveDbPrompt] = useState<boolean>(false);
  const [saveDbStatus, setSaveDbStatus] = useState<{ type: 'success' | 'error' | 'loading' | null; message: string | null }>({ type: null, message: null });
  const [sidebarTab, setSidebarTab] = useState<'workspace' | 'history'>('workspace');
  const [showSupaSetup, setShowSupaSetup] = useState<boolean>(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    isConfigured: boolean;
    connectionTest: boolean;
    tableExists: boolean;
    testError: string;
    supabaseUrl: string;
    sqlSetup: string;
  } | null>(null);
  const [isLoadingSupaStatus, setIsLoadingSupaStatus] = useState<boolean>(false);

  const fetchSupabaseStatus = async (retryCount = 0) => {
    setIsLoadingSupaStatus(true);
    try {
      const res = await fetch('/api/db/status');
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success) {
            setSupabaseStatus(data);
          }
        } else {
          console.warn('Expected JSON response for database status, but received non-JSON:', contentType);
        }
      } else {
        console.warn(`Server status endpoint returned non-ok status: ${res.status}`);
      }
    } catch (err) {
      console.warn(`Attempt ${retryCount + 1} to fetch Supabase status failed:`, err);
      if (retryCount < 3) {
        setTimeout(() => {
          fetchSupabaseStatus(retryCount + 1);
        }, 1500);
      } else {
        console.error('Max retries reached. Error fetching Supabase status:', err);
      }
    } finally {
      setIsLoadingSupaStatus(false);
    }
  };

  useEffect(() => {
    fetchSupabaseStatus();
  }, []);

  // Auto-scroll execution log terminal to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [extractionLogs]);

  const [loadedDbId, setLoadedDbId] = useState<string | null>(null);
  const [loadedDbName, setLoadedDbName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile active tab state
  const [activeTab, setActiveTab] = useState<'gateway' | 'records' | 'editor' | 'dashboard'>('gateway');

  // Tamil/English Voice Typing States
  const [listeningField, setListeningField] = useState<keyof CaseDiary | null>(null);
  const [voiceTypingSupported, setVoiceTypingSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceTypingSupported(false);
    }
  }, []);

  const toggleVoiceTyping = async (field: keyof CaseDiary) => {
    if (!voiceTypingSupported) {
      alert("Voice typing is not supported in this browser. Please try using Google Chrome or Safari.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (listeningField === field) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setListeningField(null);
      return;
    }

    if (listeningField) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }

    try {
      // Explicitly request microphone access first to trigger permissions dialog in browser/iframe
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'ta-IN'; // Tamil (India)

      recognition.onstart = () => {
        setListeningField(field);
      };

      recognition.onresult = (event: any) => {
        const resultIndex = event.resultIndex;
        const transcript = event.results[resultIndex][0].transcript;

        setDiaries((prev) =>
          prev.map((d) => {
            if (d.id === selectedDiaryId) {
              const currentVal = (d[field] as string) || '';
              const separator = currentVal ? ' ' : '';
              return { ...d, [field]: currentVal + separator + transcript };
            }
            return d;
          })
        );
        setIsSaved(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          alert("Microphone permission denied. Please allow microphone access in your browser settings to use voice typing.");
        }
        setListeningField(null);
      };

      recognition.onend = () => {
        setListeningField(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition or get microphone permission:", err);
      alert("Microphone access is required for Voice Typing. Please allow microphone permissions or open this application in a new tab.");
      setListeningField(null);
    }
  };

  const isListeningRemarks = listeningField === 'remarks';
  const toggleRemarksVoiceTyping = () => toggleVoiceTyping('remarks');


  // Initialize Auth state on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        if (currentUser && currentUser.email) {
          const lowerEmail = currentUser.email.toLowerCase().trim();
          if (!ALLOWED_EMAILS.includes(lowerEmail)) {
            setAuthError(`Access Denied: ${currentUser.email} is not authorized to access this workspace. Please contact the administrator.`);
            logout();
            setUser(null);
            setToken(null);
            setNeedsAuth(true);
            return;
          }
        }
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result && result.user && result.user.email) {
        const lowerEmail = result.user.email.toLowerCase().trim();
        if (!ALLOWED_EMAILS.includes(lowerEmail)) {
          setAuthError(`Access Denied: ${result.user.email} is not authorized to access this workspace. Please contact the administrator.`);
          await logout();
          setUser(null);
          setToken(null);
          setNeedsAuth(true);
          return;
        }
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setAuthError(err.message || 'Failed to authenticate with Google. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out? Your session history will be cleared.')) {
      try {
        localStorage.removeItem("guest_session_active");
        await logout();
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setDiaries([]);
        setSelectedDiaryId(null);
        setSavedDatabases([]);
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
  };

  // Load saved databases when the user loads or changes
  useEffect(() => {
    if (user?.uid) {
      loadDatabases(user.uid, user.email || undefined);
    } else {
      setSavedDatabases([]);
    }
  }, [user]);

  const loadDatabases = async (uid: string, email?: string) => {
    setIsLoadingDbs(true);
    try {
      const dbs = await getSavedDatabases(uid, email);
      setSavedDatabases(dbs);
    } catch (err) {
      console.error('Error loading databases:', err);
    } finally {
      setIsLoadingDbs(false);
    }
  };

  const fetchAccessMap = async () => {
    if (user?.email !== 'dhilipeee4211@gmail.com') return;
    try {
      const response = await fetch(`/api/db/access?email=${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAdminAccessMap(data.accessMap || {});
        }
      }
    } catch (err) {
      console.error('Error fetching database access map:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard' && user?.email === 'dhilipeee4211@gmail.com') {
      fetchAccessMap();
    }
  }, [activeTab, user]);

  const handleUpdateAccess = async (targetEmail: string, dbId: string, action: 'grant' | 'revoke') => {
    if (!user?.email || user.email !== 'dhilipeee4211@gmail.com') return;
    if (!targetEmail.trim() || !dbId) {
      alert('Please select both a target email and a database.');
      return;
    }
    setIsUpdatingAccess(true);
    try {
      const response = await fetch('/api/db/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: user.email,
          targetEmail: targetEmail.toLowerCase().trim(),
          dbId,
          action
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAdminAccessMap(data.accessMap || {});
          if (action === 'grant') {
            setAdminTargetEmail('');
            setAdminSelectedDbId('');
            alert('Access successfully granted.');
          } else {
            alert('Access successfully revoked.');
          }
        } else {
          alert('Failed to update access: ' + data.error);
        }
      } else {
        const data = await response.json();
        alert('Failed to update access: ' + (data.error || 'Server error'));
      }
    } catch (err: any) {
      alert('Network error updating access: ' + err.message);
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  // Debounced Auto-Save back to Local / Server / Cloud Database when editing an active session
  useEffect(() => {
    if (!user || isSaved || diaries.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        let currentDbId = loadedDbId;
        let currentDbName = loadedDbName;

        if (!currentDbId) {
          // Auto-initialize a new database session
          const firstDiary = diaries[0];
          const crimeNo = (firstDiary.crNoAndSecOfLaw || 'Diary').split(',')[0].replace(/[\/\\?%*:|"<>]/g, '-').trim();
          const station = firstDiary.policeStation || 'Record';
          currentDbName = `Database - CR No ${crimeNo} - ${station}`;
          currentDbId = `db-${Date.now()}`;

          setLoadedDbId(currentDbId);
          setLoadedDbName(currentDbName);
          setDbNameInput(currentDbName);
        }

        const saved = await saveSavedDatabase(currentDbName || "Database", diaries, user.uid, currentDbId);
        setSavedDatabases((prev) => {
          const filtered = prev.filter(db => db.id !== saved.id);
          return [saved, ...filtered];
        });
        setIsSaved(true);
        console.log("Background Auto-Save successful for database:", saved.id);
      } catch (err) {
        console.error("Background Auto-Save failed:", err);
      }
    }, 2000); // 2 second debounce of field edits

    return () => clearTimeout(timer);
  }, [diaries, loadedDbId, isSaved, user, loadedDbName]);

  const handleSaveToDatabase = async () => {
    if (!user) {
      alert("Please log in or enter Guest Mode to save.");
      return;
    }
    if (diaries.length === 0) {
      alert("No diaries are currently loaded in the workspace to save.");
      return;
    }
    const name = dbNameInput.trim();
    if (!name) {
      alert("Please provide a database name.");
      return;
    }

    setSaveDbStatus({ type: 'loading', message: 'Saving to your secure database library...' });
    try {
      // Find if there is an existing database under the same Crime Number and Police Station head
      const existingDb = savedDatabases.find((db) => {
        if (db.name.trim().toLowerCase() === name.toLowerCase()) return true;
        return db.diaries.some((d) => 
          diaries.some((newD) => {
            const dCrime = (d.crNoAndSecOfLaw || '').split(',')[0].trim().toLowerCase();
            const newCrime = (newD.crNoAndSecOfLaw || '').split(',')[0].trim().toLowerCase();
            const dStation = (d.policeStation || '').trim().toLowerCase();
            const newStation = (newD.policeStation || '').trim().toLowerCase();
            return dCrime && newCrime && dCrime === newCrime && dStation === newStation;
          })
        );
      });

      let saved;
      if (existingDb) {
        // Merge diaries: replace matching ones (same Cr No & Date), append others
        const mergedDiaries = [...existingDb.diaries];
        diaries.forEach((newD) => {
          const idx = mergedDiaries.findIndex((d) => 
            d.id === newD.id || 
            ((d.crNoAndSecOfLaw || '').trim().toLowerCase() === (newD.crNoAndSecOfLaw || '').trim().toLowerCase() &&
             (d.dateOfCd || '').trim().toLowerCase() === (newD.dateOfCd || '').trim().toLowerCase())
          );
          if (idx >= 0) {
            mergedDiaries[idx] = newD; // Update/Overwrite
          } else {
            mergedDiaries.push(newD);  // Append
          }
        });
        
        saved = await saveSavedDatabase(existingDb.name, mergedDiaries, user.uid, existingDb.id);
        setSavedDatabases((prev) => prev.map(db => db.id === existingDb.id ? saved : db));
        setSaveDbStatus({ type: 'success', message: `Updated matching Case Head: "${existingDb.name}"` });
        setSelectedSavedDbId(existingDb.id);
        setLoadedDbId(existingDb.id);
        setLoadedDbName(existingDb.name);
      } else {
        saved = await saveSavedDatabase(name, diaries, user.uid);
        setSavedDatabases((prev) => [saved, ...prev]);
        setSaveDbStatus({ type: 'success', message: `Successfully saved as "${name}"!` });
        setSelectedSavedDbId(saved.id);
        setLoadedDbId(saved.id);
        setLoadedDbName(saved.name);
      }
      setShowSaveDbPrompt(false);
      setSidebarTab('history');
      setTimeout(() => {
        setSaveDbStatus({ type: null, message: null });
      }, 3500);
    } catch (err: any) {
      console.error('Save to database error:', err);
      setSaveDbStatus({ type: 'error', message: err.message || 'Failed to save to database.' });
    }
  };

  const handleViewDatabaseDraft = (dbItem: SavedDatabase) => {
    if (dbItem.diaries && dbItem.diaries.length > 0) {
      setDiaries(dbItem.diaries);
      setSelectedDiaryId(dbItem.diaries[0].id);
      setLoadedDbId(dbItem.id);
      setLoadedDbName(dbItem.name);
      setIsSaved(true);
      setSidebarTab('workspace');
      setActiveTab('editor');
    } else {
      alert("This saved database contains no diary entries.");
    }
  };

  const handleUpdateDatabase = async () => {
    if (!user || !loadedDbId) return;
    setSaveDbStatus({ type: 'loading', message: 'Updating your database library...' });
    try {
      const saved = await saveSavedDatabase(loadedDbName || "Database", diaries, user.uid, loadedDbId);
      setSavedDatabases((prev) => prev.map(db => db.id === loadedDbId ? saved : db));
      setSaveDbStatus({ type: 'success', message: 'Database updated successfully!' });
      setIsSaved(true);
      setTimeout(() => {
        setSaveDbStatus({ type: null, message: null });
      }, 3000);
    } catch (err: any) {
      console.error('Update database error:', err);
      setSaveDbStatus({ type: 'error', message: err.message || 'Failed to update database.' });
    }
  };

  const handleDeleteDatabase = async (id: string) => {
    if (!user) return;
    const confirmMsg = "Are you sure you want to permanently delete this database from BOTH local server disk storage and Supabase Cloud? This action is permanent and cannot be undone.";
    if (window.confirm(confirmMsg)) {
      try {
        await deleteSavedDatabase(id, user.uid);
        setSavedDatabases((prev) => prev.filter((dbItem) => dbItem.id !== id));
        if (selectedSavedDbId === id) {
          setSelectedSavedDbId(null);
        }
        if (loadedDbId === id) {
          setLoadedDbId(null);
          setLoadedDbName(null);
          setDiaries([]);
          setSelectedDiaryId(null);
        }
      } catch (err) {
        console.error("Delete database error:", err);
        alert("Failed to delete the database.");
      }
    }
  };

  const handleDeleteDiaryFromDatabase = async (dbId: string, diaryId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) return;
    if (window.confirm("Are you sure you want to delete this specific case record from this saved database?")) {
      try {
        const targetDb = savedDatabases.find(db => db.id === dbId);
        if (!targetDb) return;
        
        const updatedDiaries = targetDb.diaries.filter(d => d.id !== diaryId);
        
        if (updatedDiaries.length === 0) {
          await deleteSavedDatabase(dbId, user.uid);
          setSavedDatabases(prev => prev.filter(db => db.id !== dbId));
          if (loadedDbId === dbId) {
            setLoadedDbId(null);
            setLoadedDbName(null);
            setDiaries([]);
            setSelectedDiaryId(null);
          }
          alert("The database became empty and has been deleted completely.");
        } else {
          const updatedDb = await saveSavedDatabase(targetDb.name, updatedDiaries, user.uid, dbId);
          setSavedDatabases(prev => prev.map(db => db.id === dbId ? updatedDb : db));
          if (loadedDbId === dbId) {
            setDiaries(updatedDiaries);
            setSelectedDiaryId(updatedDiaries[0]?.id || null);
          }
        }
      } catch (err) {
        console.error("Error deleting individual diary from DB:", err);
        alert("Failed to delete this case record.");
      }
    }
  };

  const handleEditDiaryFromDatabase = (dbItem: SavedDatabase, diaryId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDiaries(dbItem.diaries);
    setSelectedDiaryId(diaryId);
    setLoadedDbId(dbItem.id);
    setLoadedDbName(dbItem.name);
    setIsSaved(true);
    setSidebarTab('workspace');
    setActiveTab('editor');
  };

  const handleDeleteWorkspaceDiary = (diaryId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (window.confirm("Are you sure you want to delete this case record from your active workspace?")) {
      const updated = diaries.filter(d => d.id !== diaryId);
      setDiaries(updated);
      if (selectedDiaryId === diaryId) {
        setSelectedDiaryId(updated[0]?.id || null);
      }
    }
  };

  const handleDownloadAllDocx = async (diariesList: CaseDiary[], fileNamePrefix: string) => {
    if (diariesList.length === 0) return;
    try {
      const blob = await generateMultipleCaseDiariesDocx(diariesList);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = fileNamePrefix.replace(/[\/\\?%*:|"<>]/g, '-');
      link.download = `${safeName || 'Bulk_Case_Diaries'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Could not compile combined Word document: ${err.message}`);
    }
  };

  // Drag-and-drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setSelectedFile(file);
        setConversionError(null);
        setActiveTab('editor');
      } else {
        setConversionError('Please upload a valid PDF document.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setSelectedFile(file);
        setConversionError(null);
        setActiveTab('editor');
      } else {
        setConversionError('Please upload a valid PDF document.');
      }
    }
  };

  const triggerBrowse = () => {
    fileInputRef.current?.click();
  };

  const addLocalLog = (message: string, type: 'INFO' | 'OCR' | 'AI' | 'RECONSTRUCT' | 'SUCCESS' | 'ERROR' | 'SYSTEM' = 'INFO') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const logString = `[${time}] [${type}] ${message}`;
    setExtractionLogs(prev => [...prev, logString]);
  };

  const appendChunkDiaries = (data: any[]) => {
    const rawDiaries: CaseDiary[] = data.map((diary: any, idx: number) => ({
      ...diary,
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      policeStation: diary.policeStation || 'VIKKIRAMANGALAM',
      district: diary.district || 'ARIYALUR',
      crNoAndSecOfLaw: diary.crNoAndSecOfLaw || '0288/2018',
      dateTimeAndPlaceOfOccurrence: diary.dateTimeAndPlaceOfOccurrence || '',
      dateOfCd: diary.dateOfCd || '',
      dateOfReportTime: diary.dateOfReportTime || '',
      complainant: diary.complainant || '',
      accusedList: Array.isArray(diary.accusedList) ? diary.accusedList : [],
      propertyLostDetails: diary.propertyLostDetails || '',
      recoveredPropertyDetails: diary.recoveredPropertyDetails || '',
      dateOfPreviousCaseDiary: diary.dateOfPreviousCaseDiary || '',
      stageOfTheCase: diary.stageOfTheCase || 'PENDING TRIAL',
      courtRefNo: diary.courtRefNo || '',
      hearingNo: diary.hearingNo || '',
      courtNameAndPlace: diary.courtNameAndPlace || '',
      whetherMagistratePresent: diary.whetherMagistratePresent || 'YES',
      whetherAppPpPresent: diary.whetherAppPpPresent || 'YES',
      whetherDefenceCounselPresent: diary.whetherDefenceCounselPresent || 'NO',
      noOfPwsCited: diary.noOfPwsCited || '0',
      noOfPwsExaminedSoFar: diary.noOfPwsExaminedSoFar || '0',
      noOfPwsExaminedToday: diary.noOfPwsExaminedToday || '0',
      totalNoOfAccusedCharged: diary.totalNoOfAccusedCharged || '0',
      noOfAccusedPresent: diary.noOfAccusedPresent || '0',
      noOfAccusedAbsent: diary.noOfAccusedAbsent || '0',
      remarks: diary.remarks || '',
      postedFor: diary.postedFor || '',
      nextHearingDate: diary.nextHearingDate || '',
      attendedBy: diary.attendedBy || '',
    }));

    setDiaries((prev) => {
      const combined = [...prev, ...rawDiaries];
      const seenKeys = new Set<string>();
      const filtered: CaseDiary[] = [];
      
      combined.forEach((diary) => {
        const key = `${(diary.crNoAndSecOfLaw || '').trim().toLowerCase()}_${(diary.policeStation || '').trim().toLowerCase()}_${(diary.dateOfCd || '').trim().toLowerCase()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          filtered.push(diary);
        }
      });
      
      return filtered;
    });
    
    setIsSaved(false);
  };

  const handlePause = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    addLocalLog('Reconstruction paused. You can resume later.', 'SYSTEM');
  };

  const handleResume = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    if (currentExtractionQueue) {
      processQueue(currentExtractionQueue);
    }
  };

  const processQueue = async (queue: {
    chunks: any[];
    mode: 'free' | 'direct';
    filename: string;
    nextIndex: number;
    chunkSize: number;
    startPageOffset: number;
  }) => {
    setIsExtracting(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setConversionError(null);

    const { chunks, mode, filename, nextIndex, chunkSize, startPageOffset } = queue;

    try {
      for (let cIdx = nextIndex; cIdx < chunks.length; cIdx++) {
        if (isPausedRef.current) {
          setCurrentExtractionQueue({
            chunks,
            mode,
            filename,
            nextIndex: cIdx,
            chunkSize,
            startPageOffset
          });
          setIsExtracting(false);
          return;
        }

        const chunk = chunks[cIdx];
        const startPage = startPageOffset + cIdx * chunkSize + 1;
        const endPage = startPageOffset + Math.min((cIdx + 1) * chunkSize, chunks.length * chunkSize);

        const apiEndpoint = mode === 'free' ? '/api/extract-text' : '/api/extract';
        const requestBody = mode === 'free' 
          ? { text: chunk, filename }
          : { file: chunk, filename: `batch-${cIdx + 1}.pdf` };

        addLocalLog(`Processing batch ${cIdx + 1} of ${chunks.length} (Pages ${startPage} to ${endPage})...`, 'AI');
        setExtractionStep(`Structuring batch ${cIdx + 1}/${chunks.length} (Pages ${startPage}-${endPage})...`);
        
        const baseProgress = Math.floor((cIdx / chunks.length) * 100);
        setExtractionProgress(baseProgress);

        let response: Response;
        let retriesLeft = 4;
        let delayMs = 3000;
        
        while (true) {
          if (isPausedRef.current) {
            setCurrentExtractionQueue({
              chunks,
              mode,
              filename,
              nextIndex: cIdx,
              chunkSize,
              startPageOffset
            });
            setIsExtracting(false);
            return;
          }

          response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
          
          if (response.ok) {
            break;
          }
          
          const isRateLimited = response.status === 429;
          const isServerError = response.status >= 500;
          
          if (retriesLeft > 0 && (isRateLimited || isServerError)) {
            const reason = isRateLimited ? "Rate limit (429)" : `Server status (${response.status})`;
            addLocalLog(`${reason} encountered. Retrying batch ${cIdx + 1} in ${delayMs / 1000}s... (${retriesLeft} retries left)`, 'SYSTEM');
            await new Promise(resolve => setTimeout(resolve, delayMs));
            retriesLeft--;
            delayMs *= 2;
          } else {
            const errorText = await response.text();
            throw new Error(errorText || `Extraction failed for batch ${cIdx + 1} (${response.status})`);
          }
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const responseText = await response.text();
          if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
            throw new Error('The backend server returned HTML instead of JSON.');
          }
          throw new Error(`Expected JSON response, but received content-type "${contentType}" for batch ${cIdx + 1}`);
        }

        const chunkResult = await response.json();
        if (chunkResult && chunkResult.success && Array.isArray(chunkResult.data)) {
          appendChunkDiaries(chunkResult.data);
          addLocalLog(`Successfully structured batch ${cIdx + 1} of ${chunks.length}.`, 'SUCCESS');
        } else {
          throw new Error(`Invalid structured data format returned for batch ${cIdx + 1}.`);
        }

        if (cIdx < chunks.length - 1) {
          addLocalLog(`Pacing request flow... Waiting 2.5s before next batch...`, 'SYSTEM');
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
      }

      setExtractionProgress(100);
      setExtractionStep('Reconstruction completed successfully!');
      addLocalLog('Pipeline complete. Rendering data schemas in Workspace...', 'SUCCESS');
      setCurrentExtractionQueue(null);
      setIsExtracting(false);
    } catch (err: any) {
      console.error('Queue processing error:', err);
      addLocalLog(err.message || 'Unknown processing exception occurred.', 'ERROR');
      setConversionError(err.message || 'Failed to complete formatting reconstruction. Please retry.');
      setIsExtracting(false);
      
      setCurrentExtractionQueue({
        chunks,
        mode,
        filename,
        nextIndex: nextIndex,
        chunkSize,
        startPageOffset
      });
    }
  };

  const runExtraction = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setConversionError(null);
    setExtractionProgress(5);
    setExtractionLogs([]);

    addLocalLog('Starting case diary reconstruction pipeline...', 'SYSTEM');
    addLocalLog(`Target file: "${selectedFile.name}" (${(selectedFile.size / 1024).toFixed(1)} KB)`, 'SYSTEM');
    addLocalLog(`Extraction mode: ${extractionMode === 'free' ? 'Unlimited Free (Local Browser OCR)' : 'Cloud Upload (Direct multi-modal)'}`, 'SYSTEM');
    addLocalLog(`Start Page configuration: page ${startPageInput}`, 'SYSTEM');

    try {
      let numPages = 0;
      try {
        const pdfjsLib = await loadPdfJs();
        const precheckBuffer = await selectedFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: precheckBuffer }).promise;
        numPages = pdf.numPages;
        addLocalLog(`Verified PDF structure: ${numPages} page(s) found.`, 'SYSTEM');
      } catch (err: any) {
        console.warn("Failed to precheck page count client-side:", err);
      }

      if (extractionMode === 'free') {
        setExtractionStep('Initializing high-fidelity Client-Side PDF Engine...');
        addLocalLog('Bootstrapping local client-side PDF renderer...', 'INFO');
        
        const extractedText = await extractTextFromPdfClientSide(selectedFile, (percent, step) => {
          const scaledPercent = Math.floor(5 + (percent / 100) * 80);
          setExtractionProgress(scaledPercent);
          setExtractionStep(step);
          addLocalLog(step, 'INFO');
        }, startPageInput);

        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('Could not extract any readable text or OCR characters from this PDF file locally.');
        }

        addLocalLog(`Successfully extracted ${extractedText.length} characters of raw text.`, 'SUCCESS');
        addLocalLog('Preparing structured content layout formatting rules...', 'SYSTEM');

        const parts = extractedText.split(/--- PAGE \d+(?: \(SCANNED OCR\))? ---/);
        const pages = parts.slice(1).map(p => p.trim());
        
        const chunkSize = 2;
        const chunks: string[] = [];
        for (let i = 0; i < pages.length; i += chunkSize) {
          const chunkPages = pages.slice(i, i + chunkSize);
          let chunkText = "";
          for (let j = 0; j < chunkPages.length; j++) {
            const globalPageNum = (startPageInput - 1) + i + j + 1;
            chunkText += `\n\n--- PAGE ${globalPageNum} ---\n\n` + chunkPages[j];
          }
          chunks.push(chunkText);
        }

        addLocalLog(`Segmented document into ${chunks.length} processing batch(es).`, 'SYSTEM');
        
        const queue = {
          chunks,
          mode: 'free' as const,
          filename: selectedFile.name,
          nextIndex: 0,
          chunkSize,
          startPageOffset: startPageInput - 1
        };
        
        setCurrentExtractionQueue(queue);
        await processQueue(queue);

      } else {
        setExtractionStep('Initializing Direct Document Gateway...');
        addLocalLog('Reading file structure into memory buffer...', 'INFO');
        
        const fileBufferVal = await selectedFile.arrayBuffer();
        
        const { PDFDocument } = await import('pdf-lib');
        addLocalLog('Parsing PDF pages into direct multi-modal processing gateway...', 'SYSTEM');
        const srcDoc = await PDFDocument.load(fileBufferVal);
        const pageCount = srcDoc.getPageCount();
        
        const chunkSize = 2;
        const chunks: string[] = [];
        
        for (let i = startPageInput - 1; i < pageCount; i += chunkSize) {
          const newDoc = await PDFDocument.create();
          const pagesToCopy = Array.from(
            { length: Math.min(chunkSize, pageCount - i) },
            (_, idx) => i + idx
          );
          const copiedPages = await newDoc.copyPages(srcDoc, pagesToCopy);
          copiedPages.forEach(page => newDoc.addPage(page));
          const newPdfBytes = await newDoc.save();
          
          let binary = '';
          const len = newPdfBytes.byteLength;
          for (let k = 0; k < len; k++) {
            binary += String.fromCharCode(newPdfBytes[k]);
          }
          const base64 = window.btoa(binary);
          chunks.push(base64);
        }

        addLocalLog(`Segmented document into ${chunks.length} upload batch(es).`, 'SYSTEM');

        const queue = {
          chunks,
          mode: 'direct' as const,
          filename: selectedFile.name,
          nextIndex: 0,
          chunkSize,
          startPageOffset: startPageInput - 1
        };

        setCurrentExtractionQueue(queue);
        await processQueue(queue);
      }
    } catch (err: any) {
      console.error('Reconstruction setup error:', err);
      addLocalLog(err.message || 'Error initializing extraction.', 'ERROR');
      setConversionError(err.message || 'Failed to initialize formatting reconstruction.');
      setIsExtracting(false);
    }
  };

  const activeDiary = diaries.find((d) => d.id === selectedDiaryId);

  // Form updates for active case diary
  const handleFieldChange = (field: keyof CaseDiary, value: any) => {
    if (!selectedDiaryId) return;
    setDiaries((prev) =>
      prev.map((d) => (d.id === selectedDiaryId ? { ...d, [field]: value } : d))
    );
    setIsSaved(false);
  };

  const handleAccusedChange = (index: number, field: keyof Accused, value: string) => {
    if (!activeDiary) return;
    const updatedAccused = [...activeDiary.accusedList];
    updatedAccused[index] = { ...updatedAccused[index], [field]: value };
    handleFieldChange('accusedList', updatedAccused);
  };

  const addAccusedRow = () => {
    if (!activeDiary) return;
    const newSNo = (activeDiary.accusedList.length + 1).toString();
    const updatedAccused = [...activeDiary.accusedList, { sNo: newSNo, nameAndAddress: '' }];
    handleFieldChange('accusedList', updatedAccused);
  };

  const removeAccusedRow = (index: number) => {
    if (!activeDiary) return;
    const updatedAccused = activeDiary.accusedList.filter((_, idx) => idx !== index).map((acc, idx) => ({
      ...acc,
      sNo: (idx + 1).toString(),
    }));
    handleFieldChange('accusedList', updatedAccused);
  };

  const handleDownloadDocx = async (diary: CaseDiary) => {
    try {
      const blob = await generateCaseDiaryDocx(diary);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Sanitize file name
      const safeName = diary.crNoAndSecOfLaw.replace(/[\/\\?%*:|"<>]/g, '-');
      link.download = `Case_Diary_${safeName || 'Record'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Could not compile Word document: ${err.message}`);
    }
  };

  const saveWorkspaceChanges = async () => {
    if (!selectedDiaryId) return;
    const updatedDiaries = diaries.map((d) => (d.id === selectedDiaryId ? { ...d, isSavedDraft: true } : d));
    setDiaries(updatedDiaries);
    setIsSaved(true);
    
    // If inside a loaded database session, sync immediately to keep all tiers in absolute sync
    if (user && loadedDbId) {
      try {
        const saved = await saveSavedDatabase(loadedDbName || "Database", updatedDiaries, user.uid, loadedDbId);
        setSavedDatabases((prev) => prev.map(db => db.id === loadedDbId ? saved : db));
      } catch (err) {
        console.error("Instant save failed during workspace manual save:", err);
      }
    }
    
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleToggleSavedDraft = (diaryId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDiaries((prev) =>
      prev.map((d) => (d.id === diaryId ? { ...d, isSavedDraft: !d.isSavedDraft } : d))
    );
  };

  const handleMarkAllAsSaved = () => {
    setDiaries((prev) =>
      prev.map((d) => ({ ...d, isSavedDraft: true }))
    );
  };

  const handleBulkExportZip = async () => {
    const savedDrafts = diaries.filter(d => d.isSavedDraft);
    if (savedDrafts.length === 0) {
      alert("No saved drafts found! Please click 'Save Draft' on case diaries to mark them for bulk export, or use the 'Mark All Saved' button.");
      return;
    }

    setIsBulkExporting(true);
    try {
      const blob = await exportDiariesToZip(savedDrafts);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bulk_Case_Diaries_Saved_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Could not compile bulk export ZIP: ${err.message}`);
    } finally {
      setIsBulkExporting(false);
    }
  };
  const roleInfo = getUserRole(user?.email);

  return (
    <div className="min-h-screen bg-slate-50/40 flex flex-col antialiased relative pb-20 lg:pb-0">
      {/* Ambient shifting background gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-200/30 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-purple-200/25 rounded-full blur-[120px] animate-float-reverse" />
      </div>

      {/* Header Bar */}
      <header className="border-b border-gray-200/80 bg-white/75 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-sm sm:text-base text-gray-950 tracking-tight truncate">AI Case Diary Reconstruction Workspace</h1>
              <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-medium tracking-tight truncate">Reconstruct, Form and Format Scanned Case Diaries with Pixel Precision</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8.5 h-8.5 rounded-full border-2 border-indigo-500/20 shadow-xs" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-650 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="hidden sm:block text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <p className="text-xs font-bold text-gray-900 leading-tight">{user.displayName}</p>
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase border ${
                      roleInfo.level === 'admin'
                        ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                        : roleInfo.level === 'officer'
                        ? 'bg-sky-500/10 text-sky-700 border-sky-500/30'
                        : 'bg-slate-500/10 text-slate-700 border-slate-500/30'
                    }`}>
                      {roleInfo.badge}
                    </span>
                  </div>
                  <p className="text-[9px] text-gray-400 font-medium leading-none">{user.email}</p>
                </div>
              </div>
              <button 
                id="sign-out-btn"
                onClick={handleLogout} 
                className="p-1.5 text-gray-450 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border border-gray-150/50 bg-white/70 backdrop-blur-xs shadow-xs"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Desktop Horizontal Tabs bar */}
      {user && (
        <div className="hidden lg:block bg-white/70 backdrop-blur-md border-b border-gray-200/80 sticky top-[61px] z-40">
          <div className="max-w-7xl mx-auto px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('gateway')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'gateway'
                    ? 'bg-indigo-50 text-indigo-750 shadow-xs border border-indigo-100/50'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                Gateway Terminal
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'records'
                    ? 'bg-indigo-50 text-indigo-750 shadow-xs border border-indigo-100/50'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                Case Files & Databases
              </button>
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-indigo-50 text-indigo-750 shadow-xs border border-indigo-100/50'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                Form Workspace
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-50 text-indigo-750 shadow-xs border border-indigo-100/50'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Shield className="w-4 h-4" />
                {roleInfo.level === 'admin' ? 'SP Control Center' : 'System Dashboard'}
              </button>
            </div>
            
            {/* Quick overview */}
            <div className="flex items-center gap-3 text-xs text-gray-400 font-semibold">
              <span className="flex items-center gap-1 text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded-lg">
                <Database className="w-3.5 h-3.5" />
                {diaries.length} Diaries Loaded
              </span>
              {loadedDbName && (
                <span className="text-gray-450">
                  Active DB: <strong className="text-gray-650 font-bold">{loadedDbName}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
        <AnimatePresence mode="wait">
          {needsAuth ? (
            /* SIGN IN SCREEN */
            <motion.div 
              key="auth-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="max-w-xl w-full mx-auto my-auto py-12 flex flex-col items-center z-10"
            >
              <div className="w-full glass-panel rounded-3xl p-8 shadow-sm border border-white/20">
                <div className="text-center mb-8">
                  <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100/30">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <h2 className="font-display font-semibold text-2xl text-gray-950 tracking-tight">Connect Workspace Profile</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    To reconstruct scanned documents or export to Google Drive seamlessly, authenticate securely using Google.
                  </p>
                </div>

                {/* Features Checklist */}
                <div className="space-y-4 mb-8 bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-650 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Advanced Visual Document Extraction</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium leading-relaxed">Gemini 2.5 Flash analyzes columns, structures, and handwritten remarks instantly.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-650 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Bilingual Translation Engine</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium leading-relaxed">Transcribe typewriter and Tamil text inputs directly into readable multi-column outputs.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-650 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Pixel Perfect Word Output</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium leading-relaxed">Download editable .docx files perfectly matching the official Case Diary layout guidelines.</p>
                    </div>
                  </div>
                </div>

                {authError && (
                  <div className="mb-6 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                 <div className="flex flex-col items-center justify-center gap-3">
                  <button 
                    id="gsi-login-btn"
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-2xl bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isLoggingIn ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                    )}
                    <span>{isLoggingIn ? 'Connecting...' : 'Connect to Google Workspace'}</span>
                  </button>

                  <p className="text-[10px] text-gray-400 mt-2 text-center leading-relaxed font-medium">
                    Please sign in using an authorized Google Workspace account. Access to other roles requires admin permission.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* SINGLE-PANE TABBED WORKSPACE */
            <motion.div 
              key="workspace-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="w-full z-10 flex flex-col gap-6"
            >
              {activeTab === 'gateway' && (
                <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
                  {/* Uploader Card */}
                  <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <h3 className="font-display font-semibold text-gray-950 text-base mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Reconstruct Scanned PDF
                    </h3>
                    
                    <div
                      id="drop-zone"
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={triggerBrowse}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[160px] ${
                        dragActive 
                          ? 'border-indigo-600 bg-indigo-50/50' 
                          : 'border-gray-200 hover:border-indigo-400 hover:bg-gray-50/50'
                      }`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".pdf"
                      />
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full mb-3 shadow-xs">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-gray-800">
                        {selectedFile ? 'Change scanned PDF' : 'Select Case Diary PDF'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">
                        {selectedFile ? selectedFile.name : 'Drag & drop or click to browse'}
                      </p>
                    </div>

                    {/* Extraction Method Toggle */}
                    <div className="mt-4 bg-gray-50/50 border border-gray-150 rounded-2xl p-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Extraction Mode</span>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setExtractionMode('free')}
                          className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                            extractionMode === 'free'
                              ? 'bg-white text-indigo-600 shadow-xs border-indigo-100'
                              : 'text-gray-500 hover:text-gray-800 border-transparent bg-transparent'
                          }`}
                        >
                          <p className="text-xs font-bold flex items-center gap-1">
                            <Check className={`w-3.5 h-3.5 ${extractionMode === 'free' ? 'text-indigo-650 font-bold' : 'text-transparent'}`} />
                            Unlimited Free
                          </p>
                          <p className="text-[9px] text-gray-400 mt-1 ml-4 leading-normal font-medium">Local Browser OCR. Perfect for huge files.</p>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setExtractionMode('direct')}
                          className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                            extractionMode === 'direct'
                              ? 'bg-white text-indigo-600 shadow-xs border-indigo-100'
                              : 'text-gray-500 hover:text-gray-800 border-transparent bg-transparent'
                          }`}
                        >
                          <p className="text-xs font-bold flex items-center gap-1">
                            <Check className={`w-3.5 h-3.5 ${extractionMode === 'direct' ? 'text-indigo-650 font-bold' : 'text-transparent'}`} />
                            Cloud Upload
                          </p>
                          <p className="text-[9px] text-gray-400 mt-1 ml-4 leading-normal font-medium">Direct Gemini. Max 4.5MB on Vercel.</p>
                        </button>
                      </div>
                    </div>

                    {/* Run Analysis Action */}
                    {selectedFile && !isExtracting && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4"
                      >
                        <button
                          id="start-convert-btn"
                          onClick={runExtraction}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-2xl text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          AI Reconstruct & Format layout
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    )}

                    {conversionError && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{conversionError}</span>
                      </div>
                    )}

                    {/* Active Reconstructing Indicator with State-of-the-art Progress Bar */}
                    {isExtracting && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-4 p-5 border border-indigo-100 bg-indigo-50/15 rounded-2xl shadow-[0_4px_20px_rgba(79,70,229,0.05)] flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                            <span className="text-xs font-bold text-gray-950">AI Reconstruction Pipeline</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            {extractionProgress}%
                          </span>
                        </div>

                        {/* Animated Progress Bar Track */}
                        <div className="w-full h-2.5 bg-gray-150 rounded-full overflow-hidden relative border border-gray-200/50">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full relative"
                            initial={{ width: '0%' }}
                            animate={{ width: `${extractionProgress}%` }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                          >
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_1s_linear_infinite]" />
                          </motion.div>
                        </div>

                        {/* Current Step Description */}
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-gray-800 transition-all duration-300">
                            {extractionStep}
                          </p>
                          <p className="text-[9px] text-gray-400 mt-1 leading-normal font-medium">
                            Analyzing layouts, handwritings, and formatting police case diaries securely.
                          </p>
                        </div>

                        {/* Live Terminal Log Stream (Coding Flow Style) */}
                        {extractionLogs.length > 0 && (
                          <div className="mt-1 flex flex-col">
                            <div className="flex items-center justify-between px-1.5 pb-1 text-[8.5px] font-bold text-gray-400 uppercase tracking-wider">
                              <span>Live Execution Terminal</span>
                              <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                                Active Stream
                              </span>
                            </div>
                            <div 
                              ref={logsEndRef}
                              className="bg-slate-950 rounded-2xl p-4 border border-slate-900 font-mono text-[9px] leading-relaxed text-slate-300 max-h-[140px] overflow-y-auto shadow-inner flex flex-col gap-1 select-none"
                              style={{ scrollBehavior: 'smooth' }}
                            >
                              {extractionLogs.map((log, index) => {
                                let colorClass = 'text-slate-300';
                                if (log.includes('[SYSTEM]')) colorClass = 'text-sky-400';
                                else if (log.includes('[OCR]')) colorClass = 'text-fuchsia-400';
                                else if (log.includes('[AI]')) colorClass = 'text-amber-400';
                                else if (log.includes('[RECONSTRUCT]')) colorClass = 'text-indigo-400';
                                else if (log.includes('[SUCCESS]')) colorClass = 'text-emerald-400 font-semibold';
                                else if (log.includes('[ERROR]')) colorClass = 'text-rose-400 font-semibold';

                                return (
                                  <div key={index} className={`whitespace-pre-wrap break-all ${colorClass}`}>
                                    {log}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'records' && (
                <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
                  {/* Tabbed Record Selector & Database Library */}
                  <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-3xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.02)] flex-1 flex flex-col min-h-[420px]">
                    {/* Tab Headers */}
                    <div className="flex items-center border-b border-gray-150 mb-4 bg-gray-50/60 p-1.5 rounded-xl gap-0.5">
                      <button
                        onClick={() => setSidebarTab('workspace')}
                        className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          sidebarTab === 'workspace'
                            ? 'bg-white text-indigo-700 shadow-xs border border-gray-200/40'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Workspace ({diaries.length})
                      </button>
                      <button
                        onClick={() => setSidebarTab('history')}
                        className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer relative ${
                          sidebarTab === 'history'
                            ? 'bg-white text-indigo-700 shadow-xs border border-gray-200/40'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        Supabase Cloud DB ({savedDatabases.length})
                        {supabaseStatus?.isConfigured && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        )}
                      </button>
                    </div>

                    {sidebarTab === 'workspace' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-3.5">
                          <h3 className="font-display font-semibold text-gray-900 text-xs flex items-center gap-1.5">
                            <ListFilter className="w-3.5 h-3.5 text-indigo-600" />
                            Reconstructed Records
                          </h3>
                          
                          {diaries.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={handleMarkAllAsSaved}
                                className="text-[9px] text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/80 font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer"
                                title="Mark all current cases as saved drafts"
                              >
                                Mark Saved
                              </button>
                              <button
                                onClick={() => {
                                  const firstDiary = diaries[0];
                                  const crimeNo = (firstDiary.crNoAndSecOfLaw || 'Diary').split(',')[0].replace(/[\/\\?%*:|"<>]/g, '-').trim();
                                  const station = firstDiary.policeStation || 'Record';
                                  setDbNameInput(`Database - CR No ${crimeNo} - ${station}`);
                                  setShowSaveDbPrompt(true);
                                }}
                                className="text-[9px] text-purple-605 hover:text-purple-800 bg-purple-50/70 hover:bg-purple-100/80 font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-0.5"
                                title="Save this entire set to Database"
                              >
                                <Save className="w-2.5 h-2.5" />
                                Save DB
                              </button>
                            </div>
                          )}
                        </div>

                        {diaries.length > 0 && (
                          <div className="relative mb-3.5">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                              <Search className="w-3.5 h-3.5" />
                            </div>
                            <input
                              type="text"
                              placeholder="Search by Crime No. or Station..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-4 py-1.5 bg-gray-55 hover:bg-gray-100/50 focus:bg-white border border-gray-200/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs text-gray-900 placeholder-gray-400 font-medium transition-all"
                            />
                            {searchQuery && (
                              <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600 font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}

                        {diaries.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50 rounded-2xl border border-gray-100 min-h-[250px]">
                            <FileText className="w-8 h-8 text-gray-300 mb-2" />
                            <p className="text-xs font-semibold text-gray-500">No documents loaded</p>
                            <p className="text-[10px] text-gray-400 mt-1 max-w-[190px] leading-relaxed">
                              Upload your scanned police case diary PDF under <strong>Gateway Terminal</strong> tab to begin reconstruction.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Filtered list based on searchQuery */}
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 flex-1">
                              {diaries
                                .filter((diary) => {
                                  const query = searchQuery.toLowerCase().trim();
                                  if (!query) return true;
                                  return (
                                    (diary.crNoAndSecOfLaw || '').toLowerCase().includes(query) ||
                                    (diary.policeStation || '').toLowerCase().includes(query) ||
                                    (diary.district || '').toLowerCase().includes(query) ||
                                    (diary.dateOfCd || '').toLowerCase().includes(query)
                                  );
                                })
                                .map((diary) => {
                                  const isSelected = selectedDiaryId === diary.id;
                                  const isChecked = selectedWorkspaceCaseIds.includes(diary.id);
                                  return (
                                    <div
                                      key={diary.id}
                                      className={`w-full rounded-2xl border transition-all flex items-center p-3 gap-2.5 cursor-pointer ${
                                        isSelected 
                                          ? 'border-indigo-300 bg-indigo-50/30 shadow-xs' 
                                          : 'border-gray-100 bg-gray-55/10 hover:bg-gray-50/50'
                                      }`}
                                      onClick={() => {
                                        setSelectedDiaryId(diary.id);
                                        setActiveTab('editor');
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setSelectedWorkspaceCaseIds(prev => {
                                            if (prev.includes(diary.id)) {
                                              return prev.filter(id => id !== diary.id);
                                            } else {
                                              return [...prev, diary.id];
                                            }
                                          });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-3.5 h-3.5 rounded text-indigo-655 focus:ring-indigo-500 border-gray-300 cursor-pointer shrink-0"
                                      />
                                      <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100/85 text-gray-400'}`}>
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 justify-between">
                                          <p className="text-xs font-semibold text-gray-900 truncate">
                                            {diary.crNoAndSecOfLaw || 'Case Diary Entry'}
                                          </p>
                                          
                                          <div className="flex items-center gap-1 shrink-0">
                                            {/* Delete record from workspace */}
                                            <button
                                              onClick={(e) => handleDeleteWorkspaceDiary(diary.id, e)}
                                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                              title="Delete record from active workspace"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Small circle checkbox indicator for Saved status */}
                                            <button
                                              onClick={(e) => handleToggleSavedDraft(diary.id, e)}
                                              className={`p-1 rounded-full border transition-all ${
                                                diary.isSavedDraft
                                                  ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200'
                                                  : 'bg-white border-gray-200 text-gray-300 hover:border-indigo-350 hover:text-indigo-650'
                                              }`}
                                              title={diary.isSavedDraft ? "Saved Draft (Click to toggle)" : "Unsaved Draft (Click to save)"}
                                            >
                                              <Check className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400">
                                          <span className="font-medium truncate">{diary.policeStation}</span>
                                          <span>•</span>
                                          <span className="font-semibold text-indigo-600">{diary.dateOfCd}</span>
                                        </div>
                                      </div>
                                      <ChevronRight className={`w-4 h-4 transition-transform shrink-0 ${isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-gray-300'}`} />
                                    </div>
                                  );
                                })}
                                
                              {diaries.filter((diary) => {
                                const query = searchQuery.toLowerCase().trim();
                                if (!query) return true;
                                return (
                                  (diary.crNoAndSecOfLaw || '').toLowerCase().includes(query) ||
                                  (diary.policeStation || '').toLowerCase().includes(query) ||
                                  (diary.district || '').toLowerCase().includes(query) ||
                                  (diary.dateOfCd || '').toLowerCase().includes(query)
                                );
                              }).length === 0 && (
                                <p className="text-center text-xs text-gray-400 py-6 font-medium italic">No matches for "{searchQuery}"</p>
                              )}
                            </div>

                            {/* Bulk Export Section */}
                            <div className="mt-4 pt-3.5 border-t border-gray-100 bg-indigo-50/15 p-3.5 rounded-2xl border border-indigo-100/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Bulk Export Status</span>
                                <span className="px-2.5 py-0.5 bg-green-105 text-green-700 border border-green-200/55 text-[10px] font-bold rounded-full">
                                  {diaries.filter(d => d.isSavedDraft).length} / {diaries.length} Saved
                                </span>
                              </div>
                              
                              {selectedWorkspaceCaseIds.length > 0 ? (
                                <div className="flex flex-col sm:flex-row gap-2.5">
                                  <button
                                    onClick={() => {
                                      const loaded = diaries.filter(d => selectedWorkspaceCaseIds.includes(d.id));
                                      if (loaded.length > 0) {
                                        setDiaries(loaded);
                                        setSelectedDiaryId(loaded[0].id);
                                        setSelectedWorkspaceCaseIds([]);
                                        setActiveTab('editor');
                                        addLocalLog(`Loaded ${loaded.length} selected cases into workspace`, 'SYSTEM');
                                      }
                                    }}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse-ripple"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                    Load Data ({selectedWorkspaceCaseIds.length})
                                  </button>
                                  <button
                                    onClick={handleBulkExportZip}
                                    disabled={isBulkExporting}
                                    className="flex-1 bg-purple-605 hover:bg-purple-700 disabled:bg-gray-200 text-white disabled:text-gray-400 py-2.5 px-4 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    {isBulkExporting ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <FileDown className="w-3.5 h-3.5" />
                                    )}
                                    Bulk Export Saved Drafts (.ZIP)
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={handleBulkExportZip}
                                  disabled={isBulkExporting}
                                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white disabled:text-gray-400 py-2.5 px-4 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  {isBulkExporting ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <FileDown className="w-3.5 h-3.5" />
                                  )}
                                  Bulk Export Saved Drafts (.ZIP)
                                </button>
                              )}
                              <p className="text-[9px] text-gray-400 mt-1.5 text-center leading-normal">
                                Only case diaries with completed draft saves will be included in the exported ZIP archive.
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {sidebarTab === 'history' && (
                      <div className="flex-1 flex flex-col">
                        {/* Connection Status Indicator */}
                        <div className="flex items-center justify-between mb-3 bg-gray-55/75 p-2.5 rounded-xl border border-gray-150">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="text-[10px] font-bold text-gray-700 truncate">
                              {supabaseStatus?.isConfigured ? 'Supabase Connected' : 'Supabase Offline'}
                            </span>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${supabaseStatus?.isConfigured ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setActiveTab('dashboard')}
                              className="text-[9.5px] font-bold text-indigo-650 hover:text-indigo-850 px-1.5 py-0.5 rounded transition-all cursor-pointer hover:bg-white"
                            >
                              Show Setup
                            </button>
                            <button
                              onClick={fetchSupabaseStatus}
                              disabled={isLoadingSupaStatus}
                              className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500 hover:text-gray-800 disabled:opacity-50 cursor-pointer"
                              title="Refresh connection status"
                            >
                              <RefreshCw className={`w-3 h-3 ${isLoadingSupaStatus ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {isLoadingDbs ? (
                          <div className="flex-1 flex flex-col items-center justify-center py-10">
                            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                            <p className="text-xs font-semibold text-gray-500">Loading your database library...</p>
                          </div>
                        ) : !supabaseStatus?.isConfigured ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-amber-50/20 rounded-2xl border border-amber-100/50 min-h-[255px]">
                            <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse mb-2" />
                            <p className="text-xs font-bold text-indigo-950">Cloud Database Unconfigured</p>
                            <p className="text-[10px] text-indigo-700/80 mt-1 max-w-[210px] leading-relaxed font-medium">
                              Define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your settings to unlock persistent cloud storage.
                            </p>
                            <button
                              onClick={() => setActiveTab('dashboard')}
                              className="mt-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                            >
                              Configure Database
                            </button>
                          </div>
                        ) : savedDatabases.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50 rounded-2xl border border-gray-100 min-h-[250px]">
                            <Database className="w-8 h-8 text-gray-300 mb-2" />
                            <p className="text-xs font-semibold text-gray-500">No Databases Stored on Cloud</p>
                            <p className="text-[10px] text-gray-400 mt-1 max-w-[210px] leading-relaxed">
                              Once you load and reconstruct a scanned PDF in the workspace, click <strong>"Save DB"</strong> to persist it.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 flex-1">
                            {savedDatabases.map((dbItem) => {
                              const isExpanded = selectedSavedDbId === dbItem.id;
                              const formattedDate = new Date(dbItem.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                              
                              return (
                                <div 
                                  key={dbItem.id} 
                                  className={`border rounded-xl transition-all ${
                                    isExpanded 
                                      ? 'border-indigo-200 bg-indigo-50/15 shadow-xs' 
                                      : 'border-gray-100 bg-white hover:bg-gray-50/30'
                                  }`}
                                >
                                  {/* Database Header (Clickable to toggle expand) */}
                                  <div 
                                    onClick={() => setSelectedSavedDbId(isExpanded ? null : dbItem.id)}
                                    className="p-3 flex items-center justify-between cursor-pointer gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-xs font-bold text-gray-955 truncate flex items-center gap-1.5">
                                        <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                        {dbItem.name}
                                      </h4>
                                      <p className="text-[9px] text-gray-400 mt-0.5 font-medium">{formattedDate} • {dbItem.diaries.length} records</p>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                                  </div>

                                  {/* Expanded content */}
                                  {isExpanded && (
                                    <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50/20 pt-2.5 rounded-b-xl">
                                      {/* Action row */}
                                      <div className="grid grid-cols-2 gap-2 mb-3">
                                        <button
                                          onClick={() => handleViewDatabaseDraft(dbItem)}
                                          className="bg-indigo-650 hover:bg-indigo-755 text-white text-[10px] font-bold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-all"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          View Draft
                                        </button>
                                        <button
                                          onClick={() => handleDownloadAllDocx(dbItem.diaries, dbItem.name)}
                                          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-[10px] font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-all"
                                        >
                                          <FileDown className="w-3.5 h-3.5 text-gray-400" />
                                          Export Word
                                        </button>
                                      </div>

                                      {/* Cases List */}
                                      <div className="space-y-1.5">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Extracted Case Numbers</p>
                                        {dbItem.diaries.map((diary) => (
                                          <div 
                                            key={diary.id} 
                                            className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg gap-2 hover:border-indigo-100 transition-all"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <p className="text-[10px] font-bold text-gray-800 truncate">{diary.crNoAndSecOfLaw || 'Case Record'}</p>
                                              <p className="text-[8px] text-gray-400 truncate">{diary.policeStation}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50/50 px-1.5 py-0.5 rounded-md">{diary.dateOfCd}</span>
                                              
                                              {/* Edit individual record button */}
                                              <button
                                                onClick={(e) => handleEditDiaryFromDatabase(dbItem, diary.id, e)}
                                                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                                title="Edit individual case record in workspace"
                                              >
                                                <Edit3 className="w-3 h-3" />
                                              </button>

                                              {/* Delete individual record button */}
                                              <button
                                                onClick={(e) => handleDeleteDiaryFromDatabase(dbItem.id, diary.id, e)}
                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                                title="Delete individual case record from database"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Danger Zone */}
                                      <div className="mt-3.5 pt-2 border-t border-gray-100 flex justify-end">
                                        <button
                                          onClick={() => handleDeleteDatabase(dbItem.id)}
                                          className="text-[9px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          Delete DB
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'editor' && (
                <div className="w-full flex flex-col gap-6">
                  {/* Extraction Control Panel inside Workspace */}
                  {selectedFile && (
                    <div className="bg-white/85 backdrop-blur-md border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-150">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-indigo-50 text-indigo-650 rounded-xl">
                            <Layers className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-955">Extraction Gateway Terminal</h4>
                            <p className="text-[11px] text-gray-400 font-medium">Reconstruct selected PDF: <strong className="text-gray-600 font-bold">{selectedFile.name}</strong></p>
                          </div>
                        </div>
                        {isExtracting && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md animate-pulse">
                              {extractionProgress}%
                            </span>
                            {isPaused ? (
                              <button
                                onClick={handleResume}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <Play className="w-3 h-3" />
                                Resume
                              </button>
                            ) : (
                              <button
                                onClick={handlePause}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <Pause className="w-3 h-3" />
                                Pause
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {!isExtracting && !currentExtractionQueue && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-2">Start Page</label>
                            <input
                              type="number"
                              min={1}
                              value={startPageInput}
                              onChange={(e) => setStartPageInput(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-2">Extraction Mode</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setExtractionMode('free')}
                                className={`py-1.5 px-2 rounded-xl text-center text-xs font-bold border transition-all cursor-pointer ${
                                  extractionMode === 'free'
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs'
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                Free OCR
                              </button>
                              <button
                                type="button"
                                onClick={() => setExtractionMode('direct')}
                                className={`py-1.5 px-2 rounded-xl text-center text-xs font-bold border transition-all cursor-pointer ${
                                  extractionMode === 'direct'
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs'
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                Direct Cloud
                              </button>
                            </div>
                          </div>
                          <div className="flex items-end">
                            <button
                              onClick={runExtraction}
                              className="w-full bg-indigo-650 hover:bg-indigo-700 text-white py-2 px-4 rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              AI Reconstruct & Format
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Active reconstruction progress bar */}
                      {(isExtracting || currentExtractionQueue) && (
                        <div className="space-y-3 mt-2">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-800">
                            <span className="truncate max-w-[80%]">{extractionStep}</span>
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {extractionProgress}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-150 rounded-full overflow-hidden relative border border-gray-200/50">
                            <div 
                              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300"
                              style={{ width: `${extractionProgress}%` }}
                            />
                          </div>
                          {extractionLogs.length > 0 && (
                            <div 
                              className="bg-slate-950 rounded-2xl p-4 border border-slate-900 font-mono text-[9px] leading-relaxed text-slate-300 max-h-[120px] overflow-y-auto shadow-inner flex flex-col gap-1 select-none"
                              style={{ scrollBehavior: 'smooth' }}
                            >
                              {extractionLogs.map((log, index) => {
                                let colorClass = 'text-slate-300';
                                if (log.includes('[SYSTEM]')) colorClass = 'text-sky-400';
                                else if (log.includes('[OCR]')) colorClass = 'text-fuchsia-400';
                                else if (log.includes('[AI]')) colorClass = 'text-amber-400';
                                else if (log.includes('[RECONSTRUCT]')) colorClass = 'text-indigo-400';
                                else if (log.includes('[SUCCESS]')) colorClass = 'text-emerald-400 font-semibold';
                                else if (log.includes('[ERROR]')) colorClass = 'text-rose-400 font-semibold';
                                return (
                                  <div key={index} className={colorClass}>
                                    {log}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Case Navigation and Search bar inside Workspace */}
                  {diaries.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-gray-450 uppercase tracking-wider block mb-2">
                          Select Case Number to Edit ({diaries.length} cases in workspace)
                        </span>
                        <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
                          {diaries.map((diary) => {
                            const isSelected = selectedDiaryId === diary.id;
                            return (
                              <button
                                key={diary.id}
                                onClick={() => setSelectedDiaryId(diary.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[150px]">
                                  {diary.crNoAndSecOfLaw.split(' ')[0] || diary.crNoAndSecOfLaw || 'Case Record'}
                                </span>
                                <span className="text-[9.5px] opacity-75 font-normal">({diary.dateOfCd || 'No Date'})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Dropdown Workspace Search Widget */}
                      <div className="relative shrink-0 w-full md:w-auto self-end md:self-center">
                        <button
                          onClick={() => setShowWorkspaceSearch(!showWorkspaceSearch)}
                          className="w-full md:w-auto px-4 py-2 border border-gray-250 bg-white hover:bg-gray-50 text-gray-605 hover:text-indigo-650 rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 font-bold text-xs"
                          title="Search and load a saved database or case"
                        >
                          <Search className="w-4 h-4 text-indigo-500" />
                          Load/Search Case
                        </button>
                                           {showWorkspaceSearch && (() => {
                          const query = workspaceSearchQuery.toLowerCase().trim();
                          const matches: { db: SavedDatabase; diary: CaseDiary; matchText: string }[] = [];
                          
                          savedDatabases.forEach((db) => {
                            db.diaries.forEach((diary) => {
                              const crNo = diary.crNoAndSecOfLaw || '';
                              const station = diary.policeStation || '';
                              const dateOfCd = diary.dateOfCd || '';
                              
                              if (!query || 
                                  db.name.toLowerCase().includes(query) ||
                                  crNo.toLowerCase().includes(query) ||
                                  station.toLowerCase().includes(query) ||
                                  dateOfCd.toLowerCase().includes(query)
                              ) {
                                matches.push({
                                  db,
                                  diary,
                                  matchText: `${crNo} (${dateOfCd}) - ${station}`
                                });
                              }
                            });
                          });
                          
                          return (
                            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl p-3.5 z-50 animate-fade-in">
                              <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                                <span className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">Search Case Library</span>
                                <button 
                                  onClick={() => {
                                    setShowWorkspaceSearch(false);
                                    setSelectedSearchCaseIds([]);
                                  }}
                                  className="text-gray-400 hover:text-gray-600 font-bold text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                              <input
                                type="text"
                                placeholder="Search past case no, station, or DB..."
                                value={workspaceSearchQuery}
                                onChange={(e) => setWorkspaceSearchQuery(e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-900 shadow-sm focus:outline-none"
                                autoFocus
                              />
                              <div className="mt-2.5 max-h-60 overflow-y-auto space-y-1.5 pr-1">
                                {matches.length === 0 ? (
                                  <p className="text-[10px] text-gray-400 text-center py-4 font-semibold">No matching cases found</p>
                                ) : (
                                  matches.map(({ db, diary }, idx) => {
                                    const isChecked = selectedSearchCaseIds.some(
                                      (item) => item.dbId === db.id && item.diaryId === diary.id
                                    );
                                    return (
                                      <div
                                        key={`${db.id}-${diary.id}-${idx}`}
                                        onClick={() => {
                                          setDiaries([diary]);
                                          setSelectedDiaryId(diary.id);
                                          setLoadedDbId(db.id);
                                          setLoadedDbName(db.name);
                                          setIsSaved(true);
                                          setShowWorkspaceSearch(false);
                                          setWorkspaceSearchQuery('');
                                          setSelectedSearchCaseIds([]);
                                          addLocalLog(`Loaded case "${diary.crNoAndSecOfLaw}" inline from database "${db.name}"`, 'SYSTEM');
                                        }}
                                        className="w-full text-left p-2 rounded-xl hover:bg-indigo-50/50 hover:text-indigo-950 transition-all text-[11px] font-semibold text-gray-700 flex items-center gap-2.5 border border-transparent hover:border-indigo-100 cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            setSelectedSearchCaseIds(prev => {
                                              const exists = prev.some(item => item.dbId === db.id && item.diaryId === diary.id);
                                              if (exists) {
                                                return prev.filter(item => !(item.dbId === db.id && item.diaryId === diary.id));
                                              } else {
                                                return [...prev, { dbId: db.id, diaryId: diary.id }];
                                              }
                                            });
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-3.5 h-3.5 rounded text-indigo-650 focus:ring-indigo-500 border-gray-300 cursor-pointer shrink-0"
                                        />
                                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                          <span className="text-indigo-955 truncate font-bold">{diary.crNoAndSecOfLaw}</span>
                                          <span className="text-[9.5px] text-gray-400 truncate">Station: {diary.policeStation} • DB: {db.name}</span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              
                              {matches.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center">
                                  <span className="text-[10.5px] font-bold text-gray-500">
                                    {selectedSearchCaseIds.length} Selected
                                  </span>
                                  <button
                                    onClick={() => {
                                      const selectedDiaries = matches
                                        .filter(m => selectedSearchCaseIds.some(s => s.dbId === m.db.id && s.diaryId === m.diary.id))
                                        .map(m => m.diary);
                                      
                                      if (selectedDiaries.length > 0) {
                                        setDiaries(selectedDiaries);
                                        setSelectedDiaryId(selectedDiaries[0].id);
                                        
                                        const firstMatch = matches.find(m => selectedSearchCaseIds.some(s => s.dbId === m.db.id && s.diaryId === m.diary.id));
                                        if (firstMatch) {
                                          setLoadedDbId(firstMatch.db.id);
                                          setLoadedDbName(firstMatch.db.name);
                                        }
                                        
                                        setIsSaved(true);
                                        setShowWorkspaceSearch(false);
                                        setWorkspaceSearchQuery('');
                                        setSelectedSearchCaseIds([]);
                                        addLocalLog(`Loaded ${selectedDiaries.length} selected cases inline`, 'SYSTEM');
                                      } else {
                                        alert("Please check at least one case to load.");
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-[10.5px] font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                                  >
                                    Load Selected Cases
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Save to Database Banner Prompt */}
                  {showSaveDbPrompt && diaries.length > 0 && (
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                          <Database className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-gray-955 uppercase tracking-wide">Save Extracted Diaries as a Database</h4>
                          <p className="text-[11px] text-gray-500 mt-0.5 font-medium leading-relaxed">Give this dataset a name to persist these case records securely in your Cloud library.</p>
                          
                          <div className="mt-3 max-w-md">
                            <input
                              type="text"
                              value={dbNameInput}
                              onChange={(e) => setDbNameInput(e.target.value)}
                              placeholder="e.g. Case Diary - Vikiramangalam PS - 2026"
                              className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                        <button
                          onClick={() => setShowSaveDbPrompt(false)}
                          className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={handleSaveToDatabase}
                          className="px-4 py-1.5 text-xs text-white bg-indigo-650 hover:bg-indigo-700 font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save Database
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Database Save Status Feedback Notification */}
                  {saveDbStatus.message && (
                    <div className={`p-4 border rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-xs ${
                      saveDbStatus.type === 'success' 
                        ? 'bg-green-50 border-green-100 text-green-700' 
                        : saveDbStatus.type === 'error'
                        ? 'bg-red-50 border-red-100 text-red-700'
                        : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                    }`}>
                      {saveDbStatus.type === 'loading' ? (
                        <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-indigo-600" />
                      ) : saveDbStatus.type === 'success' ? (
                        <Check className="w-4 h-4 shrink-0 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      )}
                      <span>{saveDbStatus.message}</span>
                    </div>
                  )}

                  {activeDiary ? (
                    <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col h-full min-h-[600px]">
                      
                      {/* Database active session indicator banner */}
                      {loadedDbId && (
                        <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-indigo-950">Active Database Session: <span className="underline">{loadedDbName}</span></p>
                              <p className="text-[10px] text-indigo-700/80 font-medium">Any changes you make here can be synced directly back to your database library.</p>
                            </div>
                          </div>
                          <button
                            onClick={handleUpdateDatabase}
                            className="bg-indigo-650 hover:bg-indigo-755 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Sync Updates to DB
                          </button>
                        </div>
                      )}
                      
                      {/* Workspace Header Actions */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-md border border-green-200/50">VERIFIED PREVIEW</span>
                            <span className="text-[10px] text-gray-400 font-semibold">{activeDiary.dateOfCd}</span>
                          </div>
                          <h2 className="font-display font-bold text-gray-955 text-lg mt-1">{activeDiary.crNoAndSecOfLaw}</h2>
                          <p className="text-xs text-gray-400 font-medium">Reconstructed Case Diary • Station: {activeDiary.policeStation}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-end">
                          <button
                            id="save-draft-btn"
                            onClick={saveWorkspaceChanges}
                            className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer bg-white transition-all shadow-xs"
                          >
                            {isSaved ? (
                              <>
                                <Check className="w-4 h-4 text-green-600" />
                                <span className="text-green-700">Changes Saved!</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 text-gray-400" />
                                Save Draft
                              </>
                            )}
                          </button>

                          <button
                            id="export-docx-btn"
                            onClick={() => handleDownloadDocx(activeDiary)}
                            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                            title="Export the currently viewed case diary to Word"
                          >
                            <FileDown className="w-4 h-4 text-gray-400" />
                            Export Case Word
                          </button>

                          {diaries.length > 1 && (
                            <button
                              id="export-all-docx-btn"
                              onClick={() => handleDownloadAllDocx(diaries, `Combined-Case-Diaries-${Date.now()}`)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm hover:shadow transition-all"
                              title="Export all loaded case diaries combined into a single Word document"
                            >
                              <FileDown className="w-4 h-4" />
                              Export Combined Word ({diaries.length})
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Interactive Case Diary Document Form */}
                      <div className="space-y-6 mt-6 max-h-[680px] overflow-y-auto pr-1">
                        
                        {/* Section 1: Headers */}
                        <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-xl space-y-4">
                          <h4 className="text-xs font-bold text-indigo-705 uppercase tracking-wider">I. Administration & Registry</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <OutlinedInput
                              label="Police Station"
                              value={activeDiary.policeStation}
                              onChange={(e) => handleFieldChange('policeStation', e.target.value)}
                              onClear={() => handleFieldChange('policeStation', '')}
                            />
                            <OutlinedInput
                              label="District"
                              value={activeDiary.district}
                              onChange={(e) => handleFieldChange('district', e.target.value)}
                              onClear={() => handleFieldChange('district', '')}
                            />
                            <OutlinedInput
                              label="CR. No. & Sec of Law"
                              value={activeDiary.crNoAndSecOfLaw}
                              onChange={(e) => handleFieldChange('crNoAndSecOfLaw', e.target.value)}
                              onClear={() => handleFieldChange('crNoAndSecOfLaw', '')}
                            />
                            <OutlinedInput
                              label="Date of CD"
                              value={activeDiary.dateOfCd}
                              onChange={(e) => handleFieldChange('dateOfCd', e.target.value)}
                              onClear={() => handleFieldChange('dateOfCd', '')}
                            />
                          </div>
                        </div>

                        {/* Section 2: General parameters */}
                        <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-xl space-y-4">
                          <h4 className="text-xs font-bold text-indigo-705 uppercase tracking-wider">II. Occurrence & Complainant Details</h4>
                          <div className="space-y-4">
                            <OutlinedTextarea
                              label="Date, Time & Place of Occurrence"
                              value={activeDiary.dateTimeAndPlaceOfOccurrence}
                              onChange={(e) => handleFieldChange('dateTimeAndPlaceOfOccurrence', e.target.value)}
                              rows={2}
                            />
                            <OutlinedInput
                              label="Date of Report / Time"
                              value={activeDiary.dateOfReportTime}
                              onChange={(e) => handleFieldChange('dateOfReportTime', e.target.value)}
                              onClear={() => handleFieldChange('dateOfReportTime', '')}
                            />
                            <OutlinedTextarea
                              label="II. Complainant"
                              value={activeDiary.complainant}
                              onChange={(e) => handleFieldChange('complainant', e.target.value)}
                              rows={2}
                            />
                          </div>
                        </div>

                        {/* Section 3: Accused List Table */}
                        <div className="p-4 border border-gray-200 rounded-xl space-y-3.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-indigo-705 uppercase tracking-wider">III. Accused Details</h4>
                            <button
                              onClick={addAccusedRow}
                              className="text-[10px] bg-indigo-50 text-indigo-650 hover:bg-indigo-100 font-bold px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Accused
                            </button>
                          </div>

                          {/* List representation of accused for seamless editing */}
                          <div className="space-y-3">
                            {activeDiary.accusedList.map((acc, index) => (
                              <div key={index} className="flex gap-2 items-center bg-gray-50/30 p-2.5 rounded-xl border border-gray-150">
                                <span className="text-[11px] font-bold text-gray-400 w-6 text-center">{acc.sNo}</span>
                                <OutlinedInput
                                  label={`Accused ${acc.sNo} Name & Address`}
                                  value={acc.nameAndAddress}
                                  onChange={(e) => handleAccusedChange(index, 'nameAndAddress', e.target.value)}
                                  className="flex-1"
                                />
                                <button
                                  onClick={() => removeAccusedRow(index)}
                                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                  title="Delete Accused Row"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {activeDiary.accusedList.length === 0 && (
                              <p className="text-[10px] text-gray-450 text-center py-2 italic bg-gray-50/50 rounded-lg">No accused registered. Click "Add Accused" to define.</p>
                            )}
                          </div>
                        </div>

                        {/* Section 4: Property Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 border border-gray-200 rounded-xl">
                            <OutlinedTextarea
                              label="IV. Property Lost Details"
                              value={activeDiary.propertyLostDetails}
                              onChange={(e) => handleFieldChange('propertyLostDetails', e.target.value)}
                              onVoiceClick={() => toggleVoiceTyping('propertyLostDetails')}
                              isListening={listeningField === 'propertyLostDetails'}
                              rows={2}
                            />
                          </div>
                          <div className="p-4 border border-gray-200 rounded-xl">
                            <OutlinedTextarea
                              label="V. Recovered Property Details"
                              value={activeDiary.recoveredPropertyDetails}
                              onChange={(e) => handleFieldChange('recoveredPropertyDetails', e.target.value)}
                              onVoiceClick={() => toggleVoiceTyping('recoveredPropertyDetails')}
                              isListening={listeningField === 'recoveredPropertyDetails'}
                              rows={2}
                            />
                          </div>
                        </div>

                        {/* Section 5: Stage of Case and Court specifics */}
                        <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-xl space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-indigo-705 uppercase tracking-wider">VI. Stage & Court Administration</h4>
                            <button
                              type="button"
                              onClick={() => {
                                const targetVal = activeDiary.stageOfTheCase === 'CASE DISPOSED' ? 'PENDING TRIAL' : 'CASE DISPOSED';
                                handleFieldChange('stageOfTheCase', targetVal);
                                if (targetVal === 'CASE DISPOSED') {
                                  handleFieldChange('nextHearingDate', '');
                                }
                              }}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                activeDiary.stageOfTheCase === 'CASE DISPOSED'
                                  ? 'bg-red-500 text-white border-red-600 shadow-xs'
                                  : 'bg-red-55 text-red-750 border-red-200 hover:bg-red-100'
                              }`}
                              title="Click to dispose of this case immediately"
                            >
                              {activeDiary.stageOfTheCase === 'CASE DISPOSED' ? '✓ Case Disposed' : 'Case Disposed'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <OutlinedInput
                              label="Stage of the Case"
                              value={activeDiary.stageOfTheCase}
                              onChange={(e) => handleFieldChange('stageOfTheCase', e.target.value)}
                              onClear={() => handleFieldChange('stageOfTheCase', '')}
                            />
                            <OutlinedInput
                              label="Court Ref. No."
                              value={activeDiary.courtRefNo}
                              onChange={(e) => handleFieldChange('courtRefNo', e.target.value)}
                              onClear={() => handleFieldChange('courtRefNo', '')}
                            />
                            <OutlinedInput
                              label="Hearing No."
                              value={activeDiary.hearingNo}
                              onChange={(e) => handleFieldChange('hearingNo', e.target.value)}
                              onClear={() => handleFieldChange('hearingNo', '')}
                            />
                            <OutlinedInput
                              label="Court Name & Place"
                              value={activeDiary.courtNameAndPlace}
                              onChange={(e) => handleFieldChange('courtNameAndPlace', e.target.value)}
                              onClear={() => handleFieldChange('courtNameAndPlace', '')}
                            />
                          </div>
                        </div>

                        {/* Section 6: Specific Hearing Checks (Boolean YES/NO switches) */}
                        <div className="p-4 border border-gray-200 rounded-xl space-y-4">
                          <h4 className="text-xs font-bold text-indigo-705 uppercase tracking-wider">Hearing Parameters & Checks</h4>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Magistrate Present?</label>
                              <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-205">
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange('whetherMagistratePresent', 'YES')}
                                  className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeDiary.whetherMagistratePresent === 'YES'
                                      ? 'bg-indigo-650 text-white shadow-xs'
                                      : 'text-gray-500 hover:text-gray-800'
                                  }`}
                                >
                                  YES
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange('whetherMagistratePresent', 'NO')}
                                  className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeDiary.whetherMagistratePresent === 'NO'
                                      ? 'bg-indigo-650 text-white shadow-xs'
                                      : 'text-gray-500 hover:text-gray-800'
                                  }`}
                                >
                                  NO
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">APP / PP Present?</label>
                              <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-205">
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange('whetherAppPpPresent', 'YES')}
                                  className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeDiary.whetherAppPpPresent === 'YES'
                                      ? 'bg-indigo-650 text-white shadow-xs'
                                      : 'text-gray-500 hover:text-gray-800'
                                  }`}
                                >
                                  YES
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange('whetherAppPpPresent', 'NO')}
                                  className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeDiary.whetherAppPpPresent === 'NO'
                                      ? 'bg-indigo-650 text-white shadow-xs'
                                      : 'text-gray-500 hover:text-gray-800'
                                  }`}
                                >
                                  NO
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Defence Counsel Present?</label>
                              <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-205">
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange('whetherDefenceCounselPresent', 'YES')}
                                  className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeDiary.whetherDefenceCounselPresent === 'YES'
                                      ? 'bg-indigo-650 text-white shadow-xs'
                                      : 'text-gray-500 hover:text-gray-800'
                                  }`}
                                >
                                  YES
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange('whetherDefenceCounselPresent', 'NO')}
                                  className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeDiary.whetherDefenceCounselPresent === 'NO'
                                      ? 'bg-indigo-650 text-white shadow-xs'
                                      : 'text-gray-500 hover:text-gray-800'
                                  }`}
                                >
                                  NO
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Numeric stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                            <OutlinedInput
                              label="PWs Cited"
                              value={activeDiary.noOfPwsCited}
                              onChange={(e) => handleFieldChange('noOfPwsCited', e.target.value)}
                            />
                            <OutlinedInput
                              label="PWs Examined So Far"
                              value={activeDiary.noOfPwsExaminedSoFar}
                              onChange={(e) => handleFieldChange('noOfPwsExaminedSoFar', e.target.value)}
                            />
                            <OutlinedInput
                              label="Accused Charged"
                              value={activeDiary.totalNoOfAccusedCharged}
                              onChange={(e) => handleFieldChange('totalNoOfAccusedCharged', e.target.value)}
                            />
                            <OutlinedInput
                              label="Accused Present"
                              value={activeDiary.noOfAccusedPresent}
                              onChange={(e) => handleFieldChange('noOfAccusedPresent', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Section 7: Case Remarks Multi-line */}
                        <div className="p-4 border border-indigo-200 bg-indigo-50/10 rounded-xl space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <label className="block text-[10px] font-bold text-indigo-705 uppercase tracking-wider">
                              REMARKS & TAMIL TRANSCRIPTION
                            </label>
                            <button
                              type="button"
                              onClick={toggleRemarksVoiceTyping}
                              className={`flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer border ${
                                isListeningRemarks 
                                  ? 'bg-red-500 hover:bg-red-650 text-white border-red-600 animate-pulse'
                                  : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-300 shadow-xs'
                              }`}
                              title="Tamil Voice Typing"
                            >
                              {isListeningRemarks ? (
                                <>
                                  <MicOff className="w-3.5 h-3.5" />
                                  Stop Listening
                                </>
                              ) : (
                                <>
                                  <Mic className="w-3.5 h-3.5 text-indigo-500" />
                                  Tamil Voice Typing (பேசவும்)
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-[9.5px] text-gray-400 font-medium">
                            Preserve typewriter records, signatures, and fine payments clearly. Supports complete line breaks.
                          </p>
                          <textarea
                            rows={8}
                            value={activeDiary.remarks}
                            onChange={(e) => handleFieldChange('remarks', e.target.value)}
                            className="mt-2 w-full bg-white border border-gray-200 rounded-xl p-3.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed"
                            placeholder="Insert case diary remarks, typewriter transcripts, or hand-written summaries"
                          />
                        </div>

                        {/* Section 8: Posted & Future Hearing parameters */}
                        <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-xl space-y-4">
                          <h4 className="text-xs font-bold text-indigo-705 uppercase tracking-wider">Posted Parameters & Next Hearing</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <OutlinedInput
                              label="Posted For"
                              value={activeDiary.postedFor}
                              onChange={(e) => handleFieldChange('postedFor', e.target.value)}
                              onClear={() => handleFieldChange('postedFor', '')}
                            />
                            <OutlinedInput
                              label="Next Hearing Date"
                              value={activeDiary.nextHearingDate}
                              onChange={(e) => handleFieldChange('nextHearingDate', e.target.value)}
                              onClear={() => handleFieldChange('nextHearingDate', '')}
                            />
                            <OutlinedInput
                              label="Attended By"
                              value={activeDiary.attendedBy}
                              onChange={(e) => handleFieldChange('attendedBy', e.target.value)}
                              onClear={() => handleFieldChange('attendedBy', '')}
                            />
                          </div>
                        </div>

                      </div>

                      {/* Pinned Bottom Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2.5 shrink-0 justify-end pt-5 border-t border-gray-150 mt-5">
                        {loadedDbId ? (
                          <button
                            onClick={handleUpdateDatabase}
                            className="bg-indigo-650 hover:bg-indigo-755 text-white text-xs font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Sync Updates to DB
                          </button>
                        ) : (
                          <button
                            onClick={handleSaveToDatabase}
                            className="bg-indigo-650 hover:bg-indigo-755 text-white text-xs font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save to Database
                          </button>
                        )}
                        <button
                          id="save-draft-btn-bottom"
                          onClick={saveWorkspaceChanges}
                          className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer bg-white transition-all shadow-xs"
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="text-green-700">Changes Saved!</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 text-gray-400" />
                              Save Draft
                            </>
                          )}
                        </button>

                        <button
                          id="export-docx-btn-bottom"
                          onClick={() => handleDownloadDocx(activeDiary)}
                          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                          title="Export the currently viewed case diary to Word"
                        >
                          <FileDown className="w-4 h-4 text-gray-400" />
                          Export Case Word
                        </button>

                        {diaries.length > 1 && (
                          <button
                            id="export-all-docx-btn-bottom"
                            onClick={() => handleDownloadAllDocx(diaries, `Combined-Case-Diaries-${Date.now()}`)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm hover:shadow transition-all"
                            title="Export all loaded case diaries combined into a single Word document"
                          >
                            <FileDown className="w-4 h-4" />
                            Export Combined Word ({diaries.length})
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* WORKSPACE PLACEHOLDER */
                    <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[600px] my-auto">
                      <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-2xl flex items-center justify-center mb-4 border border-gray-100 shadow-xs">
                        <FileCheck2 className="w-8 h-8 text-indigo-500 animate-pulse" />
                      </div>
                      <h3 className="font-display font-bold text-gray-950 text-lg">Layout Preservation Document Workspace</h3>
                      <p className="text-xs text-gray-400 mt-2 max-w-md leading-relaxed">
                        Transform scanned police case diaries into pristine editable Word forms. Adjust margins, add/remove accused rows, and generate formatted docx files.
                      </p>
                      
                      <div className="mt-8 flex flex-col sm:flex-row gap-4 text-left max-w-lg bg-gray-55/50 border border-gray-100 p-5 rounded-2xl">
                        <div className="flex-1">
                          <span className="text-xs font-semibold text-gray-800">1. Reconstruct Layout</span>
                          <p className="text-[10px] text-gray-550 mt-1 leading-normal font-medium">
                            Upload your Case Diary PDF in the <strong>Gateway Terminal</strong>. The system parses structural grids, accused lists, and remarks.
                          </p>
                        </div>
                        <div className="w-px bg-gray-200 hidden sm:block"></div>
                        <div className="flex-1">
                          <span className="text-xs font-semibold text-gray-800">2. Interactive Word Compilation</span>
                          <p className="text-[10px] text-gray-550 mt-1 leading-normal font-medium">
                            Edit parameters right inside your browser workspace. Export high-fidelity Microsoft Word documents instantly.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'dashboard' && (
                <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
                  {/* Officer Control Center Dashboard */}
                  <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-3xl p-6 shadow-sm border border-white/20">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-150">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                          <Shield className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-gray-955 text-base">Officer Control Center</h3>
                          <p className="text-xs text-gray-400 font-medium">Verify credentials, database states, and background system health</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          roleInfo.level === 'admin'
                            ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                            : roleInfo.level === 'officer'
                            ? 'bg-sky-500/10 text-sky-700 border-sky-500/30'
                            : 'bg-slate-500/10 text-slate-700 border-slate-500/30'
                        }`}>
                          {roleInfo.badge} Verified
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      {/* Profile Card */}
                      <div className="bg-gray-50/50 border border-gray-100 p-5 rounded-2xl flex items-center gap-4">
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName || 'User'} className="w-16 h-16 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-650 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                            {user?.displayName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{user?.displayName || 'Guest Officer'}</h4>
                          <p className="text-xs text-indigo-650 font-bold mt-0.5">{roleInfo.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{user?.email}</p>
                        </div>
                      </div>

                      {/* Stats Card */}
                      <div className="bg-gray-50/50 border border-gray-100 p-5 rounded-2xl grid grid-cols-2 gap-4">
                        <div className="text-center bg-white p-3 rounded-xl border border-gray-200/50 shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Stored DBs</p>
                          <p className="text-2xl font-display font-bold text-gray-900 mt-1">{savedDatabases.length}</p>
                        </div>
                        <div className="text-center bg-white p-3 rounded-xl border border-gray-200/50 shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Loaded cases</p>
                          <p className="text-2xl font-display font-bold text-indigo-750 mt-1">{diaries.length}</p>
                        </div>
                      </div>
                    </div>

                    {/* System Health / Cloud DB section */}
                    <div className="mt-6 p-5 bg-indigo-50/15 border border-indigo-100/50 rounded-2xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
                          <h4 className="text-xs font-bold text-indigo-955 uppercase tracking-wider">Cloud Sync Telemetry</h4>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                          supabaseStatus?.isConfigured 
                            ? 'bg-green-500/10 text-green-700 border-green-500/30'
                            : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${supabaseStatus?.isConfigured ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                          {supabaseStatus?.isConfigured ? 'CONNECTED' : 'DISCONNECTED'}
                        </span>
                      </div>

                      <div className="space-y-2.5 text-xs font-medium text-gray-600">
                        <div className="flex justify-between py-1.5 border-b border-gray-200/40">
                          <span>Database Client</span>
                          <span className="font-mono text-[10px] font-bold text-gray-900">Supabase JS client v2</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-200/40">
                          <span>Connection Endpoint</span>
                          <span className="font-mono text-[10px] text-gray-500">{supabaseStatus?.supabaseUrl ? `${supabaseStatus.supabaseUrl}` : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-200/40">
                          <span>Database Tables Verified</span>
                          <span className={`font-bold ${supabaseStatus?.tableExists ? 'text-green-600' : 'text-amber-600'}`}>
                            {supabaseStatus?.tableExists ? 'Verified (case_databases active)' : 'Unverified'}
                          </span>
                        </div>
                        {supabaseStatus?.testError && (
                          <div className="p-3 bg-red-50 text-red-700 rounded-xl mt-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed border border-red-100">
                            {supabaseStatus.testError}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-200/40">
                        <button
                          onClick={() => setShowSupaSetup(!showSupaSetup)}
                          className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {showSupaSetup ? 'Hide SQL Script' : 'Reveal SQL Script'}
                        </button>
                        <button
                          onClick={() => fetchSupabaseStatus()}
                          disabled={isLoadingSupaStatus}
                          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSupaStatus ? 'animate-spin' : ''}`} />
                          Verify Telemetry
                        </button>
                      </div>

                      {showSupaSetup && (
                        <div className="mt-4 space-y-2">
                          <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                            Run this SQL query inside your Supabase dashboard SQL Editor to create the correct table structure and enable secure workspace synchronization:
                          </p>
                          <div className="p-4 bg-slate-950 text-gray-200 rounded-xl font-mono text-[9px] leading-relaxed select-all overflow-x-auto max-h-[180px] border border-slate-900 shadow-inner">
                            {supabaseStatus?.sqlSetup}
                          </div>
                        </div>
                      )}
                    </div>

                    {user?.email === 'dhilipeee4211@gmail.com' && (
                      <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                          <Lock className="w-5 h-5 text-indigo-650" />
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                            Database Access Permissions Manager (Admin)
                          </h4>
                        </div>
                        
                        {/* Grant Access form */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-white p-4 rounded-xl border border-gray-200/60 shadow-xs mb-6">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                              User Email
                            </label>
                            <input
                              type="email"
                              placeholder="e.g. dhileepank2@gmail.com"
                              value={adminTargetEmail}
                              onChange={(e) => setAdminTargetEmail(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50/50 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:outline-none rounded-xl text-xs font-semibold text-gray-900 shadow-sm transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                              Select Database
                            </label>
                            <select
                              value={adminSelectedDbId}
                              onChange={(e) => setAdminSelectedDbId(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50/50 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:outline-none rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all cursor-pointer"
                            >
                              <option value="">-- Choose Database --</option>
                              {savedDatabases.map((db) => (
                                <option key={db.id} value={db.id}>
                                  {db.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <button
                              onClick={() => handleUpdateAccess(adminTargetEmail, adminSelectedDbId, 'grant')}
                              disabled={isUpdatingAccess || !adminTargetEmail || !adminSelectedDbId}
                              className="w-full bg-indigo-650 hover:bg-indigo-755 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer z-10"
                            >
                              {isUpdatingAccess ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              Grant Access
                            </button>
                          </div>
                        </div>

                        {/* Assignments List */}
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">
                            Active Share Permissions
                          </span>
                          
                          {Object.keys(adminAccessMap).length === 0 || 
                           Object.values(adminAccessMap).every(list => list.length === 0) ? (
                            <p className="text-xs text-gray-400 font-medium italic bg-white py-4 text-center rounded-xl border border-gray-200/50">
                              No sharing permissions assigned. Use the form above to grant access.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1">
                              {Object.entries(adminAccessMap).map(([email, dbIds]) => {
                                if (!dbIds || dbIds.length === 0) return null;
                                return (
                                  <div
                                    key={email}
                                    className="bg-white p-3.5 rounded-xl border border-gray-200/70 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <span className="text-xs font-bold text-indigo-950 font-mono">
                                        {email}
                                      </span>
                                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {dbIds.map((dbId) => {
                                          const db = savedDatabases.find((d) => d.id === dbId);
                                          return (
                                            <span
                                              key={dbId}
                                              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50/70 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-100"
                                            >
                                              <Database className="w-2.5 h-2.5 shrink-0" />
                                              {db ? db.name : `DB ID: ${dbId}`}
                                              
                                              <button
                                                onClick={() => handleUpdateAccess(email, dbId, 'revoke')}
                                                className="ml-1 text-red-400 hover:text-red-600 font-bold hover:bg-red-50 p-0.5 rounded cursor-pointer z-10"
                                                title="Revoke access"
                                              >
                                                ✕
                                              </button>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {user && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200/80 px-4 py-2 z-50 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setActiveTab('gateway')}
            className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer ${
              activeTab === 'gateway' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-655'
            }`}
          >
            <UploadCloud className="w-5 h-5" />
            Gateway
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer relative ${
              activeTab === 'records' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-655'
            }`}
          >
            <FileText className="w-5 h-5" />
            Case Files
            {savedDatabases.length > 0 && (
              <span className="absolute top-0 right-3 px-1 py-0.5 bg-indigo-650 text-white text-[7px] font-bold rounded-full leading-none">
                {savedDatabases.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer relative ${
              activeTab === 'editor' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-655'
            }`}
          >
            <Edit3 className="w-5 h-5" />
            Workspace
            {diaries.length > 0 && (
              <span className="absolute top-0 right-3 px-1 py-0.5 bg-emerald-600 text-white text-[7px] font-bold rounded-full leading-none">
                {diaries.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-655'
            }`}
          >
            <Shield className="w-5 h-5" />
            Dashboard
          </button>
        </div>
      )}

      {/* Footer bar */}
      <footer className="border-t border-gray-200 bg-white py-6 px-6 text-center text-[10px] text-gray-400 font-medium z-10 relative">
        <p>DocuForge Case Diary Reconstruction Workspace • Powered securely by Google Cloud Platform & Gemini</p>
      </footer>
    </div>
  );
}
