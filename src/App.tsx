/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FileText, 
  UploadCloud, 
  CheckCircle, 
  ArrowLeft,
  ArrowRight, 
  Lock, 
  RefreshCw, 
  FileDown, 
  FileUp,
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
  Pause,
  Sun,
  Moon,
  PackageOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { initAuth, googleSignIn, logout } from './firebase';
import { uploadAndConvertPdf, exportToDocx } from './converter';
import { generateCaseDiaryDocx, generateMultipleCaseDiariesDocx } from './exportDocx';
import { exportDiariesToZip } from './exportZip';
import { User } from 'firebase/auth';
import { CaseDiary, Accused, SavedDatabase } from './types';
import { saveSavedDatabase, getSavedDatabases, deleteSavedDatabase, getSavedDatabaseById } from './dbHelper';
import { extractTextFromPdfClientSide, loadPdfJs } from './clientOcr';

// Helper functions for IndexedDB storage to bypass localStorage 5MB quota limit on large datasets/PDF chunks
function saveToIndexedDB(key: string, value: any): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('GatewayRecoveryDB', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('states')) {
          db.createObjectStore('states');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('states')) {
          db.close();
          resolve();
          return;
        }
        const transaction = db.transaction('states', 'readwrite');
        const store = transaction.objectStore('states');
        store.put(value, key);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          resolve();
        };
      };
      request.onerror = () => {
        resolve();
      };
    } catch (e) {
      console.warn("IndexedDB save failed:", e);
      resolve();
    }
  });
}

function getFromIndexedDB(key: string): Promise<any> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('GatewayRecoveryDB', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('states')) {
          db.createObjectStore('states');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('states')) {
          db.close();
          resolve(null);
          return;
        }
        const transaction = db.transaction('states', 'readonly');
        const store = transaction.objectStore('states');
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          db.close();
          resolve(getReq.result);
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };
      request.onerror = () => {
        resolve(null);
      };
    } catch (e) {
      console.warn("IndexedDB read failed:", e);
      resolve(null);
    }
  });
}

function removeFromIndexedDB(key: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('GatewayRecoveryDB', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('states')) {
          db.createObjectStore('states');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('states')) {
          db.close();
          resolve();
          return;
        }
        const transaction = db.transaction('states', 'readwrite');
        const store = transaction.objectStore('states');
        store.delete(key);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          resolve();
        };
      };
      request.onerror = () => {
        resolve();
      };
    } catch (e) {
      console.warn("IndexedDB delete failed:", e);
      resolve();
    }
  });
}

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
        className={`peer w-full pt-5 pb-1.5 px-3.5 border rounded-2xl text-xs font-semibold focus:outline-none transition-all placeholder-transparent shadow-sm ${className}`}
        style={{
          background: 'var(--th-input-bg)',
          borderColor: 'var(--th-input-border)',
          color: 'var(--th-text)',
        }}
        onFocus={e => {
          e.currentTarget.style.background = 'var(--th-input-focus-bg)';
          e.currentTarget.style.borderColor = 'var(--th-input-focus-border)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--th-input-focus-ring)';
        }}
        onBlur={e => {
          e.currentTarget.style.background = 'var(--th-input-bg)';
          e.currentTarget.style.borderColor = 'var(--th-input-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...props}
      />
      <label
        className="absolute left-3.5 top-3.5 text-xs font-bold peer-placeholder-shown:text-xs peer-placeholder-shown:top-3.5 peer-placeholder-shown:left-3.5 peer-focus:top-1.5 peer-focus:left-3 peer-focus:text-[9px] transition-all pointer-events-none uppercase tracking-wider scale-100 peer-focus:scale-90 origin-top-left peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-[9px] peer-[:not(:placeholder-shown)]:scale-90"
        style={{ color: 'var(--th-input-label)' }}
      >
        {label}
      </label>
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3.5 top-3.5 text-xs font-bold transition-all cursor-pointer z-10"
          style={{ color: 'var(--th-text4)' }}
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
        className={`peer w-full pt-5 pb-1.5 pl-3.5 pr-12 border rounded-2xl text-xs font-medium focus:outline-none transition-all placeholder-transparent shadow-sm ${className}`}
        style={{
          background: 'var(--th-input-bg)',
          borderColor: 'var(--th-input-border)',
          color: 'var(--th-text)',
        }}
        onFocus={e => {
          e.currentTarget.style.background = 'var(--th-input-focus-bg)';
          e.currentTarget.style.borderColor = 'var(--th-input-focus-border)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--th-input-focus-ring)';
        }}
        onBlur={e => {
          e.currentTarget.style.background = 'var(--th-input-bg)';
          e.currentTarget.style.borderColor = 'var(--th-input-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...props}
      />
      <label
        className="absolute left-3.5 top-3.5 text-xs font-bold peer-placeholder-shown:text-xs peer-placeholder-shown:top-3.5 peer-placeholder-shown:left-3.5 peer-focus:top-1.5 peer-focus:left-3 peer-focus:text-[9px] transition-all pointer-events-none uppercase tracking-wider scale-100 peer-focus:scale-90 origin-top-left peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-[9px] peer-[:not(:placeholder-shown)]:scale-90"
        style={{ color: 'var(--th-input-label)' }}
      >
        {label}
      </label>
      {onVoiceClick && (
        <button
          type="button"
          onClick={onVoiceClick}
          className={`absolute right-3.5 top-3 p-1.5 rounded-lg border transition-all cursor-pointer z-10 ${
            isListening
              ? 'bg-red-500 hover:bg-red-650 text-white border-red-600 animate-pulse-ripple'
              : 'hover:bg-sky-50 border-sky-200 hover:border-sky-300 shadow-sm'
          }`}
          style={isListening ? {} : { color: 'var(--th-primary)', background: 'var(--th-surface)' }}
          title="Voice Typing (Tamil/English)"
        >
          {isListening ? (
            <MicOff className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
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
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(null);
  
  // Custom Selection Checkbox States
  const [selectedSearchCaseIds, setSelectedSearchCaseIds] = useState<{ dbId: string; diaryId: string }[]>([]);
  const [selectedDatabaseCaseIds, setSelectedDatabaseCaseIds] = useState<string[]>([]);

  // Day / Night Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem('theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  // Admin Access Panel States
  const [adminAccessMap, setAdminAccessMap] = useState<Record<string, string[]>>({});
  const [adminGrantEmails, setAdminGrantEmails] = useState<string>('');
  const [adminTargetEmail, setAdminTargetEmail] = useState<string>('');
  const [adminSelectedDbId, setAdminSelectedDbId] = useState<string>('');
  const [isUpdatingAccess, setIsUpdatingAccess] = useState<boolean>(false);
  const [showMobileEditor, setShowMobileEditor] = useState<boolean>(false);

  // Conversion States
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionMode, setExtractionMode] = useState<'direct' | 'free'>('direct');
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [extractionStep, setExtractionStep] = useState<string>('');
  const [extractionLogs, setExtractionLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Pause/Resume & Custom Starting Page States
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);
  const [startPageInput, setStartPageInput] = useState<number>(1);
  const [currentExtractionQueue, setCurrentExtractionQueue] = useState<{
    chunks: any[];
    mode: 'free' | 'direct';
    filename: string;
    nextIndex: number;
    chunkSize: number;
    startPageOffset: number;
  } | null>(null);

  // Workspace States
  const [diaries, setDiaries] = useState<CaseDiary[]>([]);
  const [lastExtractedDiaries, setLastExtractedDiaries] = useState<CaseDiary[]>([]);
  const [gatewayDbName, setGatewayDbName] = useState<string>('');
  const [selectedDiaryId, setSelectedDiaryId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBulkExporting, setIsBulkExporting] = useState<boolean>(false);
  const [bulkSearchQuery, setBulkSearchQuery] = useState<string>('');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

  // Saved Databases / History States
  const [savedDatabases, setSavedDatabases] = useState<SavedDatabase[]>([]);
  const [isLoadingDbs, setIsLoadingDbs] = useState<boolean>(false);
  const [dbNameInput, setDbNameInput] = useState<string>('');
  const [selectedSavedDbId, setSelectedSavedDbId] = useState<string | null>(null);
  const [loadingDbDiariesId, setLoadingDbDiariesId] = useState<string | null>(null);

  const ensureDatabaseDiariesLoaded = async (dbId: string): Promise<SavedDatabase | null> => {
    const db = savedDatabases.find(d => d.id === dbId);
    if (!db) return null;

    // Already loaded diaries?
    if (db.diaries && db.diaries.length > 0) {
      return db;
    }

    setLoadingDbDiariesId(dbId);
    try {
      const fullDb = await getSavedDatabaseById(dbId, user?.uid || '', user?.email || undefined);
      if (fullDb) {
        setSavedDatabases(prev => prev.map(d => d.id === dbId ? fullDb : d));
        return fullDb;
      }
    } catch (err) {
      console.error("Failed to load diaries for database:", dbId, err);
    } finally {
      setLoadingDbDiariesId(null);
    }
    return db;
  };

  const [showSaveDbPrompt, setShowSaveDbPrompt] = useState<boolean>(false);
  const [saveDbStatus, setSaveDbStatus] = useState<{ type: 'success' | 'error' | 'loading' | null; message: string | null }>({ type: null, message: null });
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
  const [gatewayDbId, setGatewayDbId] = useState<string | null>(null);
  const [recoveryQueue, setRecoveryQueue] = useState<any | null>(null);

  const [importConflictData, setImportConflictData] = useState<{
    dbName: string;
    diaries: CaseDiary[];
    existingDb: SavedDatabase;
  } | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getFromIndexedDB('gateway_extraction_queue')
      .then((parsed) => {
        if (parsed && parsed.chunks && parsed.nextIndex < parsed.chunks.length) {
          setRecoveryQueue(parsed);
        }
      })
      .catch((err) => {
        console.warn("Failed to read recovery queue on mount from IndexedDB:", err);
      });
  }, []);

  const handleDismissRecovery = () => {
    removeFromIndexedDB('gateway_extracted_diaries');
    removeFromIndexedDB('gateway_extraction_queue');
    setRecoveryQueue(null);
  };

  const handleResumeRecovery = async () => {
    if (!recoveryQueue) return;
    
    let savedDiaries: CaseDiary[] = [];
    try {
      const cached = await getFromIndexedDB('gateway_extracted_diaries');
      if (cached) {
        savedDiaries = cached;
      }
    } catch (err) {
      console.warn("Failed to load cached diaries on resume:", err);
    }

    setLastExtractedDiaries(savedDiaries);
    setGatewayDbName(recoveryQueue.gatewayDbName || '');
    setGatewayDbId(recoveryQueue.gatewayDbId || null);
    
    const dummyFile = new File([], recoveryQueue.filename, { type: 'application/pdf' });
    setSelectedFile(dummyFile);
    
    const queueToProcess = {
      chunks: recoveryQueue.chunks,
      mode: recoveryQueue.mode,
      filename: recoveryQueue.filename,
      nextIndex: recoveryQueue.nextIndex,
      chunkSize: recoveryQueue.chunkSize,
      startPageOffset: recoveryQueue.startPageOffset,
      gatewayDbName: recoveryQueue.gatewayDbName,
      gatewayDbId: recoveryQueue.gatewayDbId
    };

    setRecoveryQueue(null);
    setCurrentExtractionQueue(queueToProcess);
    await processQueue(queueToProcess);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile active tab state
  const [activeTab, setActiveTab] = useState<'gateway' | 'records' | 'editor' | 'dashboard' | 'bulkexport'>('gateway');

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


  // 10-minute Inactivity Timer logic
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (!user) return;
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    inactivityTimeoutRef.current = setTimeout(async () => {
      try {
        localStorage.removeItem("guest_session_active");
        localStorage.removeItem("login_timestamp");
        await logout();
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setDiaries([]);
        setSelectedDiaryId(null);
        setSavedDatabases([]);
        setSessionExpiredMsg("Session expired due to inactivity");
      } catch (err) {
        console.error("Auto logout error:", err);
      }
    }, 10 * 60 * 1000); // 10 minutes
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      return;
    }

    resetInactivityTimer();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];
    const handleActivity = () => resetInactivityTimer();

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [user, resetInactivityTimer]);

  // 7-day Max Session Lifetime check
  useEffect(() => {
    const checkMaxSession = async () => {
      const loginTimeStr = localStorage.getItem("login_timestamp");
      if (loginTimeStr) {
        const loginTime = parseInt(loginTimeStr, 10);
        if (Date.now() - loginTime > 7 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem("login_timestamp");
          localStorage.removeItem("guest_session_active");
          await logout();
          setUser(null);
          setToken(null);
          setNeedsAuth(true);
          setDiaries([]);
          setSelectedDiaryId(null);
          setSavedDatabases([]);
          setSessionExpiredMsg("Session expired (7-day maximum lifetime reached). Please sign in again.");
        }
      }
    };
    checkMaxSession();
  }, []);

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
        setSessionExpiredMsg(null);
        if (!localStorage.getItem("login_timestamp")) {
          localStorage.setItem("login_timestamp", Date.now().toString());
        }
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
    setSessionExpiredMsg(null);
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
        localStorage.setItem("login_timestamp", Date.now().toString());
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setAuthError(err.message || 'Failed to authenticate with Google. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("guest_session_active");
      localStorage.removeItem("login_timestamp");
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setDiaries([]);
      setSelectedDiaryId(null);
      setSavedDatabases([]);
      setSessionExpiredMsg(null);
    } catch (err) {
      console.error('Logout error:', err);
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

      // Automatically load all cases from all saved databases into workspace
      const allDiaries: CaseDiary[] = [];
      dbs.forEach(db => {
        if (db.diaries && Array.isArray(db.diaries)) {
          db.diaries.forEach(diary => {
            allDiaries.push({
              ...diary,
              dbId: db.id
            });
          });
        }
      });
      setDiaries(allDiaries);
      
      if (allDiaries.length > 0) {
        setSelectedDiaryId(allDiaries[0].id);
      } else {
        setSelectedDiaryId(null);
      }
    } catch (err) {
      console.error('Error loading databases:', err);
    } finally {
      setIsLoadingDbs(false);
    }
  };

  // Synchronize active database session indicators with selected diary's dbId
  useEffect(() => {
    if (!selectedDiaryId || diaries.length === 0) {
      setLoadedDbId(null);
      setLoadedDbName(null);
      return;
    }
    const active = diaries.find((d) => d.id === selectedDiaryId);
    if (active && active.dbId) {
      const dbItem = savedDatabases.find((db) => db.id === active.dbId);
      if (dbItem) {
        setLoadedDbId(dbItem.id);
        setLoadedDbName(dbItem.name);
      } else {
        setLoadedDbId(active.dbId);
        setLoadedDbName("Database");
      }
    } else {
      setLoadedDbId(null);
      setLoadedDbName(null);
    }
  }, [selectedDiaryId, diaries, savedDatabases]);

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

  const handleGrantMultipleAccess = async () => {
    if (!adminGrantEmails.trim() || !adminSelectedDbId) {
      alert('Please enter at least one email and select a database.');
      return;
    }
    const emails = adminGrantEmails
      .split(/[,;\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0 && e.includes('@'));
    if (emails.length === 0) {
      alert('No valid emails found. Separate multiple emails with commas.');
      return;
    }
    setIsUpdatingAccess(true);
    let successCount = 0;
    for (const email of emails) {
      try {
        const response = await fetch('/api/db/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterEmail: user!.email,
            targetEmail: email,
            dbId: adminSelectedDbId,
            action: 'grant'
          })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setAdminAccessMap(data.accessMap || {});
            successCount++;
          }
        }
      } catch (_) {}
    }
    setIsUpdatingAccess(false);
    setAdminGrantEmails('');
    setAdminSelectedDbId('');
    alert(`Access granted to ${successCount} of ${emails.length} email(s).`);
  };

  // Debounced Auto-Save back to Local / Server / Cloud Database when editing an active session
  useEffect(() => {
    if (!user || isSaved || diaries.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        let currentDbId = loadedDbId;
        let currentDbName = loadedDbName;
        const activeDiary = diaries.find(d => d.id === selectedDiaryId);

        if (!currentDbId && activeDiary) {
          // Auto-initialize a new database session
          const crimeNo = (activeDiary.crNoAndSecOfLaw || 'Diary').split(',')[0].replace(/[\/\\?%*:|"<>]/g, '-').trim();
          const station = activeDiary.policeStation || 'Record';
          currentDbName = `Database - CR No ${crimeNo} - ${station}`;
          currentDbId = `db-${Date.now()}`;

          setLoadedDbId(currentDbId);
          setLoadedDbName(currentDbName);
          setDbNameInput(currentDbName);

          // Tag this diary with dbId in diaries state
          setDiaries(prev => prev.map(d => d.id === activeDiary.id ? { ...d, dbId: currentDbId } : d));
        }

        const targetDbId = currentDbId;
        if (!targetDbId) return;

        // Filter diaries belonging to this database session
        const dbDiaries = diaries.map(d => {
          if (d.id === activeDiary?.id && !d.dbId) {
            return { ...d, dbId: targetDbId };
          }
          return d;
        }).filter(d => d.dbId === targetDbId);

        const saved = await saveSavedDatabase(currentDbName || "Database", dbDiaries, user.uid, targetDbId);
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
  }, [diaries, loadedDbId, isSaved, user, loadedDbName, selectedDiaryId]);

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
      // Filter out diaries that do NOT have a dbId, fall back to all if all/none have it
      const unsavedDiaries = diaries.filter(d => !d.dbId);
      const diariesToSave = unsavedDiaries.length > 0 ? unsavedDiaries : diaries;

      // Find if there is an existing database under the same Crime Number and Police Station head
      const existingDb = savedDatabases.find((db) => {
        if (db.name.trim().toLowerCase() === name.toLowerCase()) return true;
        return db.diaries.some((d) => 
          diariesToSave.some((newD) => {
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
        diariesToSave.forEach((newD) => {
          const idx = mergedDiaries.findIndex((d) => 
            d.id === newD.id || 
            ((d.crNoAndSecOfLaw || '').trim().toLowerCase() === (newD.crNoAndSecOfLaw || '').trim().toLowerCase() &&
             (d.dateOfCd || '').trim().toLowerCase() === (newD.dateOfCd || '').trim().toLowerCase())
          );
          if (idx >= 0) {
            mergedDiaries[idx] = { ...newD, dbId: existingDb.id };
          } else {
            mergedDiaries.push({ ...newD, dbId: existingDb.id });
          }
        });
        
        saved = await saveSavedDatabase(existingDb.name, mergedDiaries, user.uid, existingDb.id);
        setSavedDatabases((prev) => prev.map(db => db.id === existingDb.id ? saved : db));
        setSaveDbStatus({ type: 'success', message: `Updated matching Case Head: "${existingDb.name}"` });
        setSelectedSavedDbId(existingDb.id);
        
        // Update tagged diaries in the workspace
        setDiaries(prev => prev.map(d => {
          const match = mergedDiaries.find(md => md.id === d.id);
          return match ? { ...d, dbId: existingDb.id } : d;
        }));
      } else {
        const generatedDbId = `db-${Date.now()}`;
        const taggedDiaries = diariesToSave.map(d => ({ ...d, dbId: generatedDbId }));
        saved = await saveSavedDatabase(name, taggedDiaries, user.uid, generatedDbId);
        setSavedDatabases((prev) => [saved, ...prev]);
        setSaveDbStatus({ type: 'success', message: `Successfully saved as "${name}"!` });
        setSelectedSavedDbId(saved.id);

        // Update tagged diaries in the workspace
        setDiaries(prev => prev.map(d => {
          const match = taggedDiaries.find(td => td.id === d.id);
          return match ? { ...d, dbId: generatedDbId } : d;
        }));
      }
      setShowSaveDbPrompt(false);
      setTimeout(() => {
        setSaveDbStatus({ type: null, message: null });
      }, 3500);
    } catch (err: any) {
      console.error('Save to database error:', err);
      setSaveDbStatus({ type: 'error', message: err.message || 'Failed to save to database.' });
    }
  };

  const handleSaveGatewayToDatabase = async () => {
    if (!user) return;
    const dbName = gatewayDbName.trim() || `Database - Extracted ${Date.now()}`;
    setSaveDbStatus({ type: 'loading', message: 'Saving extracted database to Cloud...' });
    try {
      const generatedDbId = gatewayDbId || `db-${Date.now()}`;
      const taggedDiaries = lastExtractedDiaries.map(d => ({ ...d, dbId: generatedDbId }));
      const saved = await saveSavedDatabase(dbName, taggedDiaries, user.uid, generatedDbId);
      setSavedDatabases((prev) => {
        const filtered = prev.filter(db => db.id !== saved.id);
        return [saved, ...filtered];
      });
      setGatewayDbId(saved.id);

      // Merge newly extracted tagged diaries into workspace
      setDiaries(prev => {
        const otherDiaries = prev.filter(d => !taggedDiaries.some(td => td.id === d.id));
        return [...otherDiaries, ...taggedDiaries];
      });

      setSaveDbStatus({ type: 'success', message: `Successfully saved as "${dbName}"!` });
      setTimeout(() => {
        setSaveDbStatus({ type: null, message: null });
      }, 3500);
    } catch (err: any) {
      console.error('Save to database error:', err);
      setSaveDbStatus({ type: 'error', message: err.message || 'Failed to save to database.' });
    }
  };

  const handleExportDatabase = async (dbItem: SavedDatabase) => {
    try {
      const loadedDb = await ensureDatabaseDiariesLoaded(dbItem.id);
      if (!loadedDb) return;
      const backupData = {
        name: loadedDb.name,
        diaries: loadedDb.diaries || []
      };
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = loadedDb.name.replace(/[\/\\?%*:|"<>]/g, '_');
      link.download = `${safeName || 'Database'}_backup.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export database error:", err);
      alert("Failed to export database: " + err.message);
    }
  };

  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      alert("Please log in to import databases.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.name || !Array.isArray(parsed.diaries)) {
          alert("Invalid backup file format. Must contain a database name and case diary list.");
          return;
        }

        const dbName = parsed.name.trim();
        const importedDiaries = parsed.diaries;

        // Check for duplicate name
        const existingDb = savedDatabases.find(db => db.name.toLowerCase() === dbName.toLowerCase());

        if (existingDb) {
          // Open custom conflict resolution dialog modal
          setImportConflictData({
            dbName,
            diaries: importedDiaries,
            existingDb
          });
        } else {
          // No conflict, save directly
          setSaveDbStatus({ type: 'loading', message: `Importing database "${dbName}"...` });
          const generatedDbId = `db-${Date.now()}`;
          const taggedDiaries = importedDiaries.map((d: CaseDiary) => ({ ...d, dbId: generatedDbId }));
          const saved = await saveSavedDatabase(dbName, taggedDiaries, user.uid, generatedDbId);
          setSavedDatabases((prev) => [saved, ...prev]);
          setDiaries(prev => {
            const combined = [...prev, ...taggedDiaries];
            const seen = new Set<string>();
            return combined.filter(d => {
              const key = `${(d.crNoAndSecOfLaw || '').trim().toLowerCase()}_${(d.policeStation || '').trim().toLowerCase()}_${(d.dateOfCd || '').trim().toLowerCase()}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          });
          setSelectedDiaryId(taggedDiaries[0]?.id || null);
          setSaveDbStatus({ type: 'success', message: `Successfully imported "${dbName}"!` });
          setTimeout(() => setSaveDbStatus({ type: null, message: null }), 3000);
        }
      } catch (err: any) {
        console.error("Import database parse error:", err);
        alert("Failed to import database file: " + err.message);
      } finally {
        // Reset file input value so same file can be imported again if needed
        if (importFileInputRef.current) {
          importFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResolveConflictMerge = async () => {
    if (!importConflictData || !user) return;
    const { dbName, diaries: importedDiaries, existingDb } = importConflictData;
    setImportConflictData(null);
    setSaveDbStatus({ type: 'loading', message: `Merging case records into "${dbName}"...` });
    try {
      const loadedDb = await ensureDatabaseDiariesLoaded(existingDb.id);
      const mergedDiaries = [...(loadedDb?.diaries || [])];
      importedDiaries.forEach((newD: CaseDiary) => {
        const idx = mergedDiaries.findIndex((d) => 
          d.id === newD.id || 
          ((d.crNoAndSecOfLaw || '').trim().toLowerCase() === (newD.crNoAndSecOfLaw || '').trim().toLowerCase() &&
           (d.dateOfCd || '').trim().toLowerCase() === (newD.dateOfCd || '').trim().toLowerCase())
        );
        if (idx >= 0) {
          // Merge keeping any custom modifications/fields if needed, or simply overwrite with imported values
          mergedDiaries[idx] = { ...mergedDiaries[idx], ...newD, dbId: existingDb.id };
        } else {
          mergedDiaries.push({ ...newD, dbId: existingDb.id });
        }
      });

      const taggedDiaries = mergedDiaries.map(d => ({ ...d, dbId: existingDb.id }));
      const saved = await saveSavedDatabase(existingDb.name, taggedDiaries, user.uid, existingDb.id);
      setSavedDatabases((prev) => prev.map(db => db.id === existingDb.id ? saved : db));
      
      setDiaries(prev => {
        const otherDiaries = prev.filter(d => d.dbId !== existingDb.id);
        const combined = [...otherDiaries, ...taggedDiaries];
        const seen = new Set<string>();
        return combined.filter(d => {
          const key = `${(d.crNoAndSecOfLaw || '').trim().toLowerCase()}_${(d.policeStation || '').trim().toLowerCase()}_${(d.dateOfCd || '').trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      setSelectedDiaryId(taggedDiaries[0]?.id || null);

      setSaveDbStatus({ type: 'success', message: `Successfully merged imported records into "${dbName}"!` });
      setTimeout(() => setSaveDbStatus({ type: null, message: null }), 3500);
    } catch (err: any) {
      console.error("Conflict merge error:", err);
      setSaveDbStatus({ type: 'error', message: err.message || 'Failed to merge database.' });
    }
  };

  const handleResolveConflictKeepBoth = async () => {
    if (!importConflictData || !user) return;
    const { dbName, diaries: importedDiaries } = importConflictData;
    setImportConflictData(null);
    
    let uniqueName = `Copy of ${dbName}`;
    let copyCounter = 1;
    while (savedDatabases.some(db => db.name.toLowerCase() === uniqueName.toLowerCase())) {
      copyCounter++;
      uniqueName = `Copy of ${dbName} (${copyCounter})`;
    }

    setSaveDbStatus({ type: 'loading', message: `Saving imported database as "${uniqueName}"...` });
    try {
      const generatedDbId = `db-${Date.now()}`;
      const taggedDiaries = importedDiaries.map((d: CaseDiary) => ({ ...d, dbId: generatedDbId }));
      const saved = await saveSavedDatabase(uniqueName, taggedDiaries, user.uid, generatedDbId);
      setSavedDatabases((prev) => [saved, ...prev]);
      
      setDiaries(prev => {
        const combined = [...prev, ...taggedDiaries];
        const seen = new Set<string>();
        return combined.filter(d => {
          const key = `${(d.crNoAndSecOfLaw || '').trim().toLowerCase()}_${(d.policeStation || '').trim().toLowerCase()}_${(d.dateOfCd || '').trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      setSelectedDiaryId(taggedDiaries[0]?.id || null);

      setSaveDbStatus({ type: 'success', message: `Successfully saved as "${uniqueName}"!` });
      setTimeout(() => setSaveDbStatus({ type: null, message: null }), 3500);
    } catch (err: any) {
      console.error("Conflict keep both error:", err);
      setSaveDbStatus({ type: 'error', message: err.message || 'Failed to import as new database.' });
    }
  };

  const handleViewGatewayInWorkspace = () => {
    if (lastExtractedDiaries.length > 0) {
      setDiaries((prev) => {
        const diariesWithDbId = lastExtractedDiaries.map(d => ({ ...d, dbId: gatewayDbId || undefined }));
        const combined = [...prev, ...diariesWithDbId];
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
      setSelectedDiaryId(lastExtractedDiaries[0].id);
      
      // Bind workspace session to the auto-saved cloud database record
      setLoadedDbId(gatewayDbId);
      setLoadedDbName(gatewayDbName);
      setDbNameInput(gatewayDbName);
      setIsSaved(true);

      setActiveTab('editor');
    }
  };

  const handleLoadSelectedCases = async (dbItem: SavedDatabase) => {
    const loadedDb = await ensureDatabaseDiariesLoaded(dbItem.id);
    if (!loadedDb || !loadedDb.diaries) return;
    const selectedDiaries = loadedDb.diaries.filter(d => selectedDatabaseCaseIds.includes(d.id));
    if (selectedDiaries.length > 0) {
      setDiaries(prev => {
        const combined = [...prev];
        selectedDiaries.forEach(diary => {
          if (!combined.some(d => d.id === diary.id)) {
            combined.push({ ...diary, dbId: dbItem.id });
          }
        });
        return combined;
      });
      setSelectedDiaryId(selectedDiaries[0].id);
      setSelectedDatabaseCaseIds([]);
      setActiveTab('editor');
    }
  };

  const handleViewDatabaseDraft = async (dbItem: SavedDatabase) => {
    const loadedDb = await ensureDatabaseDiariesLoaded(dbItem.id);
    if (loadedDb && loadedDb.diaries && loadedDb.diaries.length > 0) {
      const firstDiary = diaries.find(d => d.dbId === dbItem.id);
      if (firstDiary) {
        setSelectedDiaryId(firstDiary.id);
      } else {
        const mapped = loadedDb.diaries.map(d => ({ ...d, dbId: dbItem.id }));
        setDiaries(prev => {
          const combined = [...prev, ...mapped];
          const seen = new Set<string>();
          return combined.filter(d => {
            const key = `${(d.crNoAndSecOfLaw || '').trim().toLowerCase()}_${(d.policeStation || '').trim().toLowerCase()}_${(d.dateOfCd || '').trim().toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
        setSelectedDiaryId(loadedDb.diaries[0].id);
      }
      setActiveTab('editor');
    } else {
      alert("This saved database contains no diary entries.");
    }
  };

  const handleUpdateDatabase = async () => {
    if (!user || !loadedDbId) return;
    setSaveDbStatus({ type: 'loading', message: 'Updating your database library...' });
    try {
      const dbDiaries = diaries.filter(d => d.dbId === loadedDbId);
      const saved = await saveSavedDatabase(loadedDbName || "Database", dbDiaries, user.uid, loadedDbId);
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
        await deleteSavedDatabase(id, user.uid, user.email || undefined);
        setSavedDatabases((prev) => prev.filter((dbItem) => dbItem.id !== id));
        setDiaries((prev) => {
          const filtered = prev.filter((d) => d.dbId !== id);
          if (selectedDiaryId && prev.find((d) => d.id === selectedDiaryId)?.dbId === id) {
            setSelectedDiaryId(filtered[0]?.id || null);
          }
          return filtered;
        });
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
        
        const updatedDiaries = (targetDb.diaries || []).filter(d => d.id !== diaryId);
        
        if (updatedDiaries.length === 0) {
          await deleteSavedDatabase(dbId, user.uid, user.email || undefined);
          setSavedDatabases(prev => prev.filter(db => db.id !== dbId));
          setDiaries(prev => {
            const filtered = prev.filter(d => d.dbId !== dbId);
            if (selectedDiaryId && prev.find(d => d.id === selectedDiaryId)?.dbId === dbId) {
              setSelectedDiaryId(filtered[0]?.id || null);
            }
            return filtered;
          });
          alert("The database became empty and has been deleted completely.");
        } else {
          const updatedDb = await saveSavedDatabase(targetDb.name, updatedDiaries, user.uid, dbId);
          setSavedDatabases(prev => prev.map(db => db.id === dbId ? updatedDb : db));
          setDiaries(prev => {
            const updated = prev.map(d => {
              if (d.dbId === dbId) {
                if (d.id === diaryId) return null;
                const match = updatedDiaries.find(ud => ud.id === d.id);
                return match ? { ...match, dbId } : d;
              }
              return d;
            }).filter(Boolean) as CaseDiary[];
            if (selectedDiaryId === diaryId) {
              setSelectedDiaryId(updated.find(u => u.dbId === dbId)?.id || updated[0]?.id || null);
            }
            return updated;
          });
        }
      } catch (err) {
        console.error("Error deleting individual diary from DB:", err);
        alert("Failed to delete this case record.");
      }
    }
  };

  const handleEditDiaryFromDatabase = async (dbItem: SavedDatabase, diaryId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const loadedDb = await ensureDatabaseDiariesLoaded(dbItem.id);
    if (loadedDb && loadedDb.diaries) {
      const exists = diaries.some(d => d.id === diaryId);
      if (!exists) {
        const targetDiary = loadedDb.diaries.find(d => d.id === diaryId);
        if (targetDiary) {
          setDiaries(prev => [...prev, { ...targetDiary, dbId: dbItem.id }]);
        }
      }
      setSelectedDiaryId(diaryId);
      setActiveTab('editor');
      setShowMobileEditor(true);
    }
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
        setGatewayDbName(file.name.replace(/\.[^/.]+$/, '') + ' - CD');
        setConversionError(null);
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
        setGatewayDbName(file.name.replace(/\.[^/.]+$/, '') + ' - CD');
        setConversionError(null);
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


    setLastExtractedDiaries(prev => {
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
    isCancelledRef.current = false;
    setIsPaused(false);
    if (currentExtractionQueue) {
      processQueue(currentExtractionQueue);
    }
  };

  const handleCancel = async () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    setIsExtracting(false);
    setExtractionProgress(0);
    setExtractionStep('');
    setCurrentExtractionQueue(null);
    addLocalLog('Reconstruction cancelled by user.', 'SYSTEM');
    try {
      await removeFromIndexedDB('gateway_extraction_queue');
      await removeFromIndexedDB('gateway_extracted_diaries');
    } catch (_) {}
  };

  const processQueue = async (queue: {
    chunks: any[];
    mode: 'free' | 'direct';
    filename: string;
    nextIndex: number;
    chunkSize: number;
    startPageOffset: number;
    gatewayDbName?: string;
    gatewayDbId?: string | null;
  }) => {
    setIsExtracting(true);
    setIsPaused(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;
    setConversionError(null);

    const { chunks, mode, filename, nextIndex, chunkSize, startPageOffset } = queue;
    const dbName = queue.gatewayDbName || gatewayDbName || `Database - Extracted ${Date.now()}`;
    let activeDbId = queue.gatewayDbId || gatewayDbId;

    // Load initial accumulated diaries for chunk merging
    let accumulatedDiaries: CaseDiary[] = [];
    if (nextIndex > 0) {
      try {
        const cached = await getFromIndexedDB('gateway_extracted_diaries');
        if (cached) {
          accumulatedDiaries = cached;
        }
      } catch (e) {
        console.warn("Failed to load cached diaries from IndexedDB", e);
      }
    }

    let currentProcessingIdx = nextIndex;

    try {
      for (let cIdx = nextIndex; cIdx < chunks.length; cIdx++) {
        currentProcessingIdx = cIdx;
        // Cancel check
        if (isCancelledRef.current) {
          addLocalLog('Reconstruction cancelled.', 'SYSTEM');
          setIsExtracting(false);
          return;
        }
        if (isPausedRef.current) {
          setCurrentExtractionQueue({
            chunks,
            mode,
            filename,
            nextIndex: cIdx,
            chunkSize,
            startPageOffset,
            gatewayDbName: dbName,
            gatewayDbId: activeDbId
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
          // Cancel check inside retry loop
          if (isCancelledRef.current) {
            setIsExtracting(false);
            return;
          }
          if (isPausedRef.current) {
            setCurrentExtractionQueue({
              chunks,
              mode,
              filename,
              nextIndex: cIdx,
              chunkSize,
              startPageOffset,
              gatewayDbName: dbName,
              gatewayDbId: activeDbId
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
          
          if (isRateLimited && retriesLeft === 0) {
            // All retries exhausted — save accumulated data FIRST, then raise quota error
            if (accumulatedDiaries.length > 0 && user) {
              try {
                addLocalLog(`Gemini quota hit at batch ${cIdx + 1}. Saving ${accumulatedDiaries.length} already-extracted record(s) before stopping...`, 'SYSTEM');
                const saved = await saveSavedDatabase(dbName, accumulatedDiaries, user.uid, activeDbId || undefined);
                activeDbId = saved.id;
                setGatewayDbId(saved.id);
                setSavedDatabases(prev => {
                  const filtered = prev.filter(db => db.id !== saved.id);
                  return [saved, ...filtered];
                });
                addLocalLog(`✅ ${accumulatedDiaries.length} record(s) saved to database successfully.`, 'SUCCESS');
              } catch (saveErr: any) {
                addLocalLog(`Failed to save partial data: ${saveErr.message}`, 'ERROR');
              }
            }
            const savedCount = accumulatedDiaries.length;
            const quotaErr = new Error(
              `⚠️ Gemini API quota exceeded (429) at batch ${cIdx + 1} of ${chunks.length}. ${
                savedCount > 0
                  ? `${savedCount} record(s) from completed batches have been saved to your database.`
                  : 'No records were extracted before the quota was hit.'
              } Please wait and try again later, or switch to 'Unlimited Free' mode.`
            );
            (quotaErr as any).isQuotaError = true;
            throw quotaErr;
          }
          
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
        
        // If server used its Gemini-exhausted fallback, treat as quota error — save accumulated data first, then stop
        if (chunkResult && chunkResult.fallbackUsed) {
          if (accumulatedDiaries.length > 0 && user) {
            try {
              addLocalLog(`Gemini API exhausted at batch ${cIdx + 1}. Saving ${accumulatedDiaries.length} already-extracted record(s) before stopping...`, 'SYSTEM');
              const saved = await saveSavedDatabase(dbName, accumulatedDiaries, user.uid, activeDbId || undefined);
              activeDbId = saved.id;
              setGatewayDbId(saved.id);
              setSavedDatabases(prev => {
                const filtered = prev.filter(db => db.id !== saved.id);
                return [saved, ...filtered];
              });
              addLocalLog(`✅ ${accumulatedDiaries.length} record(s) saved to database successfully.`, 'SUCCESS');
            } catch (saveErr: any) {
              addLocalLog(`Failed to save partial data: ${saveErr.message}`, 'ERROR');
            }
          }
          const savedCount = accumulatedDiaries.length;
          const quotaErr = new Error(
            `⚠️ Gemini API quota exceeded — all API keys exhausted at batch ${cIdx + 1} of ${chunks.length}. ${
              savedCount > 0
                ? `${savedCount} record(s) from completed batches have been saved to your database.`
                : 'No records were extracted before the quota was hit.'
            } Please wait and retry, or switch to 'Unlimited Free' mode.`
          );
          (quotaErr as any).isQuotaError = true;
          throw quotaErr;
        }
        
        if (chunkResult && chunkResult.success && Array.isArray(chunkResult.data)) {
          // Process and map chunkResult.data to CaseDiary format
          const rawDiaries: CaseDiary[] = chunkResult.data.map((diary: any, idx: number) => ({
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

          const combined = [...accumulatedDiaries, ...rawDiaries];
          const seenKeys = new Set<string>();
          const filteredAccumulated: CaseDiary[] = [];
          combined.forEach((diary) => {
            const key = `${(diary.crNoAndSecOfLaw || '').trim().toLowerCase()}_${(diary.policeStation || '').trim().toLowerCase()}_${(diary.dateOfCd || '').trim().toLowerCase()}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              filteredAccumulated.push(diary);
            }
          });
          accumulatedDiaries = filteredAccumulated;

          appendChunkDiaries(chunkResult.data);
          addLocalLog(`Successfully structured batch ${cIdx + 1} of ${chunks.length}.`, 'SUCCESS');

          // Cache current extraction state in IndexedDB for sudden disconnect recovery
          await saveToIndexedDB('gateway_extracted_diaries', accumulatedDiaries);
          const updatedQueueState = {
            chunks,
            mode,
            filename,
            nextIndex: cIdx + 1,
            chunkSize,
            startPageOffset,
            gatewayDbName: dbName,
            gatewayDbId: activeDbId
          };
          await saveToIndexedDB('gateway_extraction_queue', updatedQueueState);

          // Auto-save parsed results to database in the background as they are fetched
          if (user) {
            addLocalLog(`Auto-saving ${accumulatedDiaries.length} records to Cloud database...`, 'SYSTEM');
            try {
              const saved = await saveSavedDatabase(dbName, accumulatedDiaries, user.uid, activeDbId || undefined);
              activeDbId = saved.id;
              setGatewayDbId(saved.id);
              
              // Update state list
              setSavedDatabases((prev) => {
                const filtered = prev.filter(db => db.id !== saved.id);
                return [saved, ...filtered];
              });
              
              // Re-save queue to IndexedDB to record the persistent database ID
              updatedQueueState.gatewayDbId = saved.id;
              await saveToIndexedDB('gateway_extraction_queue', updatedQueueState);
              addLocalLog(`Cloud Auto-save successful (DB ID: ${saved.id}).`, 'SUCCESS');
            } catch (dbErr: any) {
              console.error("Cloud Auto-save failed:", dbErr);
              addLocalLog(`Cloud Auto-save failed: ${dbErr.message || dbErr}. Data is cached in browser.`, 'ERROR');
            }
          }
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
      
      // Clean up IndexedDB caches since pipeline is fully complete
      await removeFromIndexedDB('gateway_extraction_queue');
      await removeFromIndexedDB('gateway_extracted_diaries');
      
      setCurrentExtractionQueue(null);
      setIsExtracting(false);
    } catch (err: any) {
      console.error('Queue processing error:', err);
      const isQuotaError = !!(err as any).isQuotaError;
      addLocalLog(err.message || 'Unknown processing exception occurred.', 'ERROR');
      setConversionError(err.message || 'Failed to complete formatting reconstruction. Please retry.');
      setIsExtracting(false);
      
      if (!isQuotaError) {
        // Only allow resume from a normal error — not a quota error
        setCurrentExtractionQueue({
          chunks,
          mode,
          filename,
          nextIndex: currentProcessingIdx,
          chunkSize,
          startPageOffset,
          gatewayDbName: dbName,
          gatewayDbId: activeDbId
        });
      } else {
        // Quota error: already saved partial data before throwing — just clear queue state
        setCurrentExtractionQueue(null);
        await removeFromIndexedDB('gateway_extraction_queue');
        await removeFromIndexedDB('gateway_extracted_diaries');
        addLocalLog('Queue cleared. Any successfully extracted records before the quota limit have been saved to your database.', 'SYSTEM');
      }
    }
  };

  const runExtraction = async () => {
    if (!selectedFile) return;

    if (!gatewayDbName.trim()) {
      alert("Please enter a database name before starting the reconstruction.");
      return;
    }

    setIsExtracting(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setConversionError(null);
    setExtractionProgress(5);
    setExtractionLogs([]);
    setLastExtractedDiaries([]);
    setGatewayDbId(null);
    await removeFromIndexedDB('gateway_extraction_queue');
    await removeFromIndexedDB('gateway_extracted_diaries');

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
          startPageOffset: startPageInput - 1,
          gatewayDbName: gatewayDbName.trim(),
          gatewayDbId: null
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
          startPageOffset: startPageInput - 1,
          gatewayDbName: gatewayDbName.trim(),
          gatewayDbId: null
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
      setShowMobileEditor(false);
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
        const dbDiaries = updatedDiaries.filter(d => d.dbId === loadedDbId);
        const saved = await saveSavedDatabase(loadedDbName || "Database", dbDiaries, user.uid, loadedDbId);
        setSavedDatabases((prev) => prev.map(db => db.id === loadedDbId ? saved : db));
      } catch (err) {
        console.error("Instant save failed during workspace manual save:", err);
      }
    }
    
    setTimeout(() => setIsSaved(false), 2000);
    setShowMobileEditor(false);
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

  const handleExportAllToZip = async () => {
    if (diaries.length === 0) {
      alert("No case diaries loaded in the workspace to export.");
      return;
    }

    setIsBulkExporting(true);
    try {
      const blob = await exportDiariesToZip(diaries);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Workspace_Case_Diaries_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Could not compile ZIP export: ${err.message}`);
    } finally {
      setIsBulkExporting(false);
    }
  };
  const roleInfo = getUserRole(user?.email);

  return (
    <div className="min-h-screen flex flex-col antialiased relative pb-20 lg:pb-0" style={{ background: 'var(--th-bg)', color: 'var(--th-text)' }}>
      {/* Ambient shifting background gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] amb-blob-1 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] amb-blob-2 rounded-full blur-[120px] animate-float-reverse" />
      </div>

      {/* Header Bar */}
      <header className="border-b sticky top-0 z-50 px-4 sm:px-6 py-3.5 shadow-sm backdrop-blur-xl" style={{ background: 'var(--th-header-bg)', borderColor: 'var(--th-header-border)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 rounded-xl shrink-0 shadow-xs" style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)' }}>
              <Sparkles className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-sm sm:text-base tracking-tight truncate" style={{ color: 'var(--th-text)' }}>AI Case Diary Reconstruction Workspace</h1>
              <p className="text-[9.5px] sm:text-[10px] font-medium tracking-tight truncate" style={{ color: 'var(--th-text4)' }}>Reconstruct, Form and Format Scanned Case Diaries with Pixel Precision</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Day / Night Theme Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="theme-toggle-pill"
              title={isDarkMode ? 'Switch to Day Mode' : 'Switch to Night Mode'}
            >
              <span className={`theme-toggle-icon ${!isDarkMode ? 'active' : 'inactive'}`}>
                <Sun className="w-3.5 h-3.5" />
              </span>
              <span className={`theme-toggle-icon ${isDarkMode ? 'active' : 'inactive'}`}>
                <Moon className="w-3.5 h-3.5" />
              </span>
            </button>

            {user && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8.5 h-8.5 rounded-full border-2 shadow-xs" style={{ borderColor: 'var(--th-border)' }} referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-sky-500 to-cyan-400 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {user.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="hidden sm:block text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <p className="text-xs font-bold leading-tight" style={{ color: 'var(--th-text)' }}>{user.displayName}</p>
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
                    <p className="text-[9px] font-medium leading-none" style={{ color: 'var(--th-text4)' }}>{user.email}</p>
                  </div>
                </div>
                <button 
                  id="sign-out-btn"
                  onClick={handleLogout} 
                  className="p-1.5 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border shadow-xs backdrop-blur-xs"
                  style={{ color: 'var(--th-text3)', borderColor: 'var(--th-border)', background: 'var(--th-surface)' }}
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Desktop Horizontal Tabs bar */}
      {user && (
        <div className="hidden lg:block backdrop-blur-xl border-b sticky top-[61px] z-40" style={{ background: 'var(--th-header-bg)', borderColor: 'var(--th-header-border)' }}>
          <div className="max-w-7xl mx-auto px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {(['gateway', 'records', 'editor', 'bulkexport', 'dashboard'] as const).map((tab) => {
                const isActive = activeTab === tab;
                const labels: Record<string, React.ReactNode> = {
                  gateway: 'Gateway Terminal',
                  records: 'Case Files & Databases',
                  editor: 'Form Workspace',
                  bulkexport: (
                    <span className="flex items-center gap-1.5">
                      Bulk Export
                      {bulkSelectedIds.size > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full text-white leading-none" style={{ background: 'var(--th-primary)' }}>
                          {bulkSelectedIds.size}
                        </span>
                      )}
                    </span>
                  ),
                  dashboard: 'Admin'
                };
                const icons: Record<string, React.ReactNode> = {
                  gateway: <UploadCloud className="w-4 h-4" />,
                  records: <FileText className="w-4 h-4" />,
                  editor: <Edit3 className="w-4 h-4" />,
                  bulkexport: <PackageOpen className="w-4 h-4" />,
                  dashboard: <Shield className="w-4 h-4" />
                };
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      if (tab === 'bulkexport') { setActiveTab('bulkexport'); setBulkSelectedIds(new Set()); }
                      else setActiveTab(tab);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer`}
                    style={isActive ? {
                      background: 'var(--th-tab-active-bg)',
                      color: 'var(--th-tab-active-text)',
                      border: '1px solid var(--th-border)',
                    } : {
                      color: 'var(--th-text4)',
                      border: '1px solid transparent',
                    }}
                  >
                    {icons[tab]}
                    {labels[tab]}
                  </button>
                );
              })}
            </div>
            
            {/* Quick overview */}
            <div className="flex items-center gap-3 text-xs font-semibold" style={{ color: 'var(--th-text4)' }}>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold" style={{ color: 'var(--th-primary)', background: 'var(--th-primary-xlight)' }}>
                <Database className="w-3.5 h-3.5" />
                {diaries.length} Diaries Loaded
              </span>
              {loadedDbName && (
                <span style={{ color: 'var(--th-text3)' }}>
                  Active DB: <strong style={{ color: 'var(--th-text2)' }}>{loadedDbName}</strong>
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
              <div className="w-full rounded-3xl p-8 shadow-2xl border" style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)', boxShadow: 'var(--th-card-shadow)' }}>
                <div className="text-center mb-8">
                  <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border" style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)', borderColor: 'var(--th-border)' }}>
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <h2 className="font-display font-semibold text-2xl tracking-tight" style={{ color: 'var(--th-text)' }}>Connect Workspace Profile</h2>
                  <p className="text-sm mt-2" style={{ color: 'var(--th-text3)' }}>
                    To reconstruct scanned documents or export to Google Drive seamlessly, authenticate securely using Google.
                  </p>
                </div>

                {/* Features Checklist */}
                <div className="space-y-4 mb-8 p-5 rounded-2xl border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)' }}>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--th-primary)' }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--th-text2)' }}>Advanced Visual Document Extraction</p>
                      <p className="text-[11px] mt-0.5 font-medium leading-relaxed" style={{ color: 'var(--th-text3)' }}>Gemini 2.5 Flash analyzes columns, structures, and handwritten remarks instantly.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--th-primary)' }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--th-text2)' }}>Bilingual Translation Engine</p>
                      <p className="text-[11px] mt-0.5 font-medium leading-relaxed" style={{ color: 'var(--th-text3)' }}>Transcribe typewriter and Tamil text inputs directly into readable multi-column outputs.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--th-primary)' }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--th-text2)' }}>Pixel Perfect Word Output</p>
                      <p className="text-[11px] mt-0.5 font-medium leading-relaxed" style={{ color: 'var(--th-text3)' }}>Download editable .docx files perfectly matching the official Case Diary layout guidelines.</p>
                    </div>
                  </div>
                </div>

                {sessionExpiredMsg && (
                  <div className="mb-6 p-3 rounded-xl flex items-start gap-2.5 text-xs" style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)', border: '1px solid var(--th-border)' }}>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{sessionExpiredMsg}</span>
                  </div>
                )}

                {authError && (
                  <div className="mb-6 p-3 rounded-xl flex items-start gap-2.5 text-xs" style={{ background: 'var(--th-error-bg)', color: 'var(--th-error)', border: '1px solid var(--th-error-border)' }}>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                 <div className="flex flex-col items-center justify-center gap-3">
                  <button 
                    id="gsi-login-btn"
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 border rounded-2xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60"
                    style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)', color: 'var(--th-text2)' }}
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

                  <p className="text-[10px] mt-2 text-center leading-relaxed font-medium" style={{ color: 'var(--th-text4)' }}>
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
                  {/* Recovery Banner */}
                  {recoveryQueue && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
                      style={{ background: 'var(--th-primary-xlight)', borderColor: 'var(--th-primary)' }}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--th-primary)' }} />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold" style={{ color: 'var(--th-text)' }}>Unfinished Reconstruction Detected</h4>
                          <p className="text-[10px] mt-0.5 font-medium leading-relaxed" style={{ color: 'var(--th-text3)' }}>
                            We found an incomplete reconstruction for <strong className="font-mono text-[9px]">{recoveryQueue.filename}</strong>. You can resume processing from batch <strong className="font-mono">{recoveryQueue.nextIndex + 1} of {recoveryQueue.chunks.length}</strong>.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          onClick={handleDismissRecovery}
                          className="flex-1 sm:flex-none bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[10.5px] font-bold py-1.5 px-3 rounded-xl transition-all cursor-pointer shadow-2xs"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={handleResumeRecovery}
                          className="flex-1 sm:flex-none text-white text-[10.5px] font-bold py-1.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                          style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-dark))' }}
                        >
                          <Play className="w-3 h-3" />
                          Resume Extraction
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Uploader Card */}
                  <div className="backdrop-blur-md rounded-3xl p-6 shadow-sm border" style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}>
                    <h3 className="font-display font-semibold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--th-text)' }}>
                      <Layers className="w-4 h-4" style={{ color: 'var(--th-primary)' }} />
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
                        dragActive ? 'drag-active' : ''
                      }`}
                      style={dragActive ? {} : { borderColor: 'var(--th-border)', background: 'transparent' }}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".pdf"
                      />
                      <div className="p-3 rounded-full mb-3 shadow-xs" style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)' }}>
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--th-text2)' }}>
                        {selectedFile ? 'Change scanned PDF' : 'Select Case Diary PDF'}
                      </p>
                      <p className="text-[10px] mt-1 font-mono" style={{ color: 'var(--th-text4)' }}>
                        {selectedFile ? selectedFile.name : 'Drag & drop or click to browse'}
                      </p>
                    </div>

                    {/* Extraction Method Toggle */}
                    <div className="mt-4 rounded-2xl p-3 border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--th-text4)' }}>Extraction Mode</span>
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Cloud Upload — PRIMARY / DEFAULT */}
                        <button
                          type="button"
                          onClick={() => setExtractionMode('direct')}
                          className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border relative`}
                          style={extractionMode === 'direct' ? { background: 'var(--th-surface)', color: 'var(--th-primary)', borderColor: 'var(--th-border)' } : { background: 'transparent', borderColor: 'transparent', color: 'var(--th-text3)' }}
                        >
                          <p className="text-xs font-bold flex items-center gap-1">
                            <Check className={`w-3.5 h-3.5`} style={{ color: extractionMode === 'direct' ? 'var(--th-primary)' : 'transparent' }} />
                            Cloud Upload
                          </p>
                          <p className="text-[9px] mt-1 ml-4 leading-normal font-medium" style={{ color: 'var(--th-text4)' }}>Direct Gemini API. Recommended default.</p>
                          <span className="absolute top-1.5 right-1.5 text-[8px] font-bold px-1 rounded" style={{ background: 'var(--th-primary)', color: 'white' }}>DEFAULT</span>
                        </button>
                        
                        {/* Unlimited Free — SECONDARY */}
                        <button
                          type="button"
                          onClick={() => setExtractionMode('free')}
                          className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border`}
                          style={extractionMode === 'free' ? { background: 'var(--th-surface)', color: 'var(--th-primary)', borderColor: 'var(--th-border)' } : { background: 'transparent', borderColor: 'transparent', color: 'var(--th-text3)' }}
                        >
                          <p className="text-xs font-bold flex items-center gap-1">
                            <Check className={`w-3.5 h-3.5`} style={{ color: extractionMode === 'free' ? 'var(--th-primary)' : 'transparent' }} />
                            Unlimited Free
                          </p>
                          <p className="text-[9px] mt-1 ml-4 leading-normal font-medium" style={{ color: 'var(--th-text4)' }}>Local Browser OCR. No quota limits.</p>
                        </button>
                      </div>
                    </div>

                    {/* Run Analysis Action */}
                    {selectedFile && !isExtracting && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 space-y-4"
                      >
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text4)' }}>
                            Database Name for Auto-Save
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Case Files - Vikiramangalam - CD Oct"
                            value={gatewayDbName}
                            onChange={(e) => setGatewayDbName(e.target.value)}
                            className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-900 shadow-sm"
                            style={{ background: 'var(--th-input-bg)', borderColor: 'var(--th-input-border)', color: 'var(--th-text)' }}
                          />
                        </div>

                        <button
                          id="start-convert-btn"
                          onClick={runExtraction}
                          className="w-full text-white py-3 px-4 rounded-2xl text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                          style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-dark))' }}
                        >
                          <Sparkles className="w-4 h-4" />
                          AI Reconstruct & Format layout
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    )}

                    {conversionError && (
                      <div className="mt-4 p-3 border text-xs rounded-xl flex gap-2.5" style={{ background: 'var(--th-error-bg)', borderColor: 'var(--th-error-border)', color: 'var(--th-error)' }}>
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{conversionError}</span>
                      </div>
                    )}

                    {/* Active Reconstructing Indicator with State-of-the-art Progress Bar */}
                    {isExtracting && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-4 p-5 border rounded-2xl flex flex-col gap-3"
                        style={{ background: 'var(--th-primary-xlight)', borderColor: 'var(--th-border)' }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--th-primary)' }} />
                            <span className="text-xs font-bold" style={{ color: 'var(--th-text)' }}>AI Reconstruction Pipeline</span>
                          </div>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md" style={{ color: 'var(--th-primary)', background: 'var(--th-surface)' }}>
                            {extractionProgress}%
                          </span>
                        </div>

                        {/* Animated Progress Bar Track */}
                        <div className="w-full h-2.5 rounded-full overflow-hidden relative border" style={{ background: 'var(--th-border2)', borderColor: 'var(--th-border)' }}>
                          <motion.div 
                            className="h-full rounded-full relative"
                            style={{ background: 'linear-gradient(90deg, var(--th-primary), var(--th-accent), #0891b2)' }}
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
                        {/* Pause / Resume / Cancel Controls */}
                        <div className="flex items-center gap-2 pt-1">
                          {isPaused ? (
                            <button
                              onClick={handleResume}
                              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white cursor-pointer shadow-sm transition-all"
                              style={{ background: 'var(--th-primary)' }}
                            >
                              <Play className="w-3.5 h-3.5" />
                              Resume
                            </button>
                          ) : (
                            <button
                              onClick={handlePause}
                              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer shadow-xs transition-all border"
                              style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)', color: 'var(--th-text2)' }}
                            >
                              <Pause className="w-3.5 h-3.5" />
                              Pause
                            </button>
                          )}
                          <button
                            onClick={handleCancel}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer shadow-xs transition-all border text-red-600 hover:bg-red-50"
                            style={{ borderColor: '#fca5a5' }}
                          >
                            <Trash className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                          {isPaused && (
                            <span className="text-[10px] font-semibold ml-1" style={{ color: 'var(--th-text3)' }}>Paused — batch progress saved</span>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Paused State Banner (when not actively extracting but queue exists) */}
                    {!isExtracting && isPaused && currentExtractionQueue && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-4 border rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}
                      >
                        <div className="flex items-center gap-2">
                          <Pause className="w-4 h-4 shrink-0" style={{ color: 'var(--th-primary)' }} />
                          <div>
                            <p className="text-xs font-bold" style={{ color: 'var(--th-text)' }}>Reconstruction Paused</p>
                            <p className="text-[10px] font-medium" style={{ color: 'var(--th-text3)' }}>
                              Batch {currentExtractionQueue.nextIndex + 1} of {currentExtractionQueue.chunks.length} — progress saved automatically
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={handleResume}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white cursor-pointer shadow-sm transition-all"
                            style={{ background: 'var(--th-primary)' }}
                          >
                            <Play className="w-3.5 h-3.5" />
                            Resume
                          </button>
                          <button
                            onClick={handleCancel}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all border text-red-600 hover:bg-red-50"
                            style={{ borderColor: '#fca5a5' }}
                          >
                            <Trash className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>

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

                  {/* Read-Only Extracted Data Preview Card */}
                  {lastExtractedDiaries.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="backdrop-blur-md rounded-3xl p-6 shadow-sm border flex flex-col gap-4"
                      style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}
                    >
                      <h3 className="font-display font-semibold text-base flex items-center gap-2" style={{ color: 'var(--th-text)' }}>
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        AI Extraction Preview ({lastExtractedDiaries.length} Cases)
                      </h3>
                      
                      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                        {lastExtractedDiaries.map((diary, idx) => (
                          <div key={diary.id || idx} className="p-4 border rounded-2xl flex flex-col gap-2.5" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                            <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: 'var(--th-border)' }}>
                              <span className="text-xs font-bold" style={{ color: 'var(--th-primary)' }}>
                                Crime No: {diary.crNoAndSecOfLaw || 'N/A'}
                              </span>
                              <span className="text-[10px] font-semibold font-mono" style={{ color: 'var(--th-text4)' }}>
                                Date of CD: {diary.dateOfCd || 'N/A'}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-medium">
                              <div>
                                <span className="text-[9px] uppercase tracking-wider block font-bold" style={{ color: 'var(--th-text4)' }}>Police Station</span>
                                <span style={{ color: 'var(--th-text2)' }}>{diary.policeStation || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase tracking-wider block font-bold" style={{ color: 'var(--th-text4)' }}>District</span>
                                <span style={{ color: 'var(--th-text2)' }}>{diary.district || 'N/A'}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-[9px] uppercase tracking-wider block font-bold" style={{ color: 'var(--th-text4)' }}>Complainant</span>
                                <span style={{ color: 'var(--th-text2)' }}>{diary.complainant || 'N/A'}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-[9px] uppercase tracking-wider block font-bold" style={{ color: 'var(--th-text4)' }}>Accused Persons ({diary.accusedList?.length || 0})</span>
                                <span style={{ color: 'var(--th-text2)' }}>
                                  {diary.accusedList && diary.accusedList.length > 0 
                                    ? diary.accusedList.map((a: any) => a.nameAndAddress).join(', ')
                                    : 'None listed'}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-[9px] uppercase tracking-wider block font-bold" style={{ color: 'var(--th-text4)' }}>Remarks Summary</span>
                                <p className="text-[10.5px] italic line-clamp-3 leading-relaxed mt-0.5" style={{ color: 'var(--th-text3)' }}>
                                  {diary.remarks || 'No remarks transcribed.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Cloud Save & Workspace View Actions */}
                      {!isExtracting && (
                        <div className="border-t pt-4 mt-2 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--th-border)' }}>
                          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-xs font-semibold">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Auto-saved to Cloud DB: <strong className="font-mono text-[11px]">{gatewayDbName || 'Database'}</strong></span>
                          </div>

                          <div className="flex justify-end gap-2.5 w-full sm:w-auto">
                            <button
                              onClick={handleViewGatewayInWorkspace}
                              className="w-full sm:w-auto bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                            >
                              <Eye className="w-4 h-4 text-gray-400" />
                              View in Workspace
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}
              {activeTab === 'records' && (
                <div className="max-w-3xl mx-auto w-full flex flex-col gap-6 animate-fade-in">
                  <div className="backdrop-blur-md rounded-3xl p-6 shadow-sm border flex-1 flex flex-col min-h-[420px]" style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)', boxShadow: 'var(--th-card-shadow)' }}>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b" style={{ borderColor: 'var(--th-border)' }}>
                      <div>
                        <h3 className="font-display font-semibold text-base flex items-center gap-2" style={{ color: 'var(--th-text)' }}>
                          <Database className="w-5 h-5" style={{ color: 'var(--th-primary)' }} />
                          Supabase Cloud Databases
                        </h3>
                        <p className="text-[10px] font-medium" style={{ color: 'var(--th-text4)' }}>
                          Browse, load, and manage your saved police case records.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {supabaseStatus?.isConfigured && (
                          <>
                            <span className="hidden xs:flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              Connected
                            </span>
                            <input
                              type="file"
                              accept=".json"
                              ref={importFileInputRef}
                              className="hidden"
                              onChange={handleImportDatabase}
                            />
                            <button
                              onClick={() => importFileInputRef.current?.click()}
                              className="p-1.5 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-xl transition-all border flex items-center gap-1 cursor-pointer text-[10.5px] font-bold"
                              style={{ color: 'var(--th-primary)', borderColor: 'var(--th-border)', background: 'var(--th-surface)' }}
                              title="Import JSON Database Backup"
                            >
                              <FileUp className="w-3.5 h-3.5" />
                              <span>Import DB</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={fetchSupabaseStatus}
                          disabled={isLoadingSupaStatus}
                          className="p-1.5 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 cursor-pointer border"
                          style={{ color: 'var(--th-text3)', borderColor: 'var(--th-border)', background: 'var(--th-surface)' }}
                          title="Refresh connection status"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSupaStatus ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {isLoadingDbs ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-20">
                        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                        <p className="text-xs font-semibold" style={{ color: 'var(--th-text3)' }}>Loading your database library...</p>
                      </div>
                    ) : !supabaseStatus?.isConfigured ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-3xl border min-h-[300px]" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                        <Sparkles className="w-10 h-10 animate-pulse mb-3" style={{ color: 'var(--th-primary)' }} />
                        <p className="text-sm font-bold" style={{ color: 'var(--th-text2)' }}>Cloud Database Unconfigured</p>
                        <p className="text-xs mt-1.5 max-w-xs leading-relaxed" style={{ color: 'var(--th-text4)' }}>
                          Define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your settings to unlock persistent cloud storage.
                        </p>
                        <button
                          onClick={() => setActiveTab('dashboard')}
                          className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                        >
                          Configure Database
                        </button>
                      </div>
                    ) : savedDatabases.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-3xl border min-h-[300px]" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                        <Database className="w-10 h-10 mb-3" style={{ color: 'var(--th-border)' }} />
                        <p className="text-sm font-semibold" style={{ color: 'var(--th-text3)' }}>No Databases Stored on Cloud</p>
                        <p className="text-xs mt-1.5 max-w-xs leading-relaxed" style={{ color: 'var(--th-text4)' }}>
                          Once you load and reconstruct a scanned PDF in the workspace, click <strong>"Save DB"</strong> to persist it.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {savedDatabases.map((dbItem) => {
                          const isExpanded = selectedSavedDbId === dbItem.id;
                          const formattedDate = new Date(dbItem.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                          
                          // Check if any cases are selected in this specific database
                          const selectedInThisDb = (dbItem.diaries || []).filter(d => selectedDatabaseCaseIds.includes(d.id));

                          return (
                            <div 
                              key={dbItem.id} 
                              className={`border rounded-2xl transition-all ${
                                isExpanded 
                                  ? 'shadow-sm' 
                                  : 'hover:bg-gray-50/20'
                              }`}
                              style={{ 
                                borderColor: isExpanded ? 'var(--th-primary)' : 'var(--th-border2)', 
                                background: isExpanded ? 'var(--th-primary-xlight)' : 'var(--th-surface2)' 
                              }}
                            >
                              {/* Database Header (Clickable to toggle expand) */}
                              <div 
                                onClick={async () => {
                                  const nextExpanded = !isExpanded;
                                  setSelectedSavedDbId(nextExpanded ? dbItem.id : null);
                                  setSelectedDatabaseCaseIds([]); // Clear selection when toggling
                                  if (nextExpanded) {
                                    await ensureDatabaseDiariesLoaded(dbItem.id);
                                  }
                                }}
                                className="p-4 flex items-center justify-between cursor-pointer gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-bold truncate flex items-center gap-1.5" style={{ color: 'var(--th-text)' }}>
                                    <Database className="w-4 h-4 shrink-0" style={{ color: 'var(--th-primary)' }} />
                                    {dbItem.name}
                                  </h4>
                                  <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--th-text4)' }}>
                                    {formattedDate} • {dbItem.diaryCount ?? dbItem.diaries?.length ?? 0} records
                                  </p>
                                </div>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--th-text4)' }} />
                              </div>

                              {/* Expanded content */}
                              {isExpanded && (
                                <div className="px-4 pb-4 border-t pt-3.5 rounded-b-2xl" style={{ borderColor: 'var(--th-border)', background: 'var(--th-surface)' }}>
                                  {loadingDbDiariesId === dbItem.id ? (
                                    <div className="flex flex-col items-center justify-center py-8">
                                      <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--th-primary)' }} />
                                      <p className="text-[11px] mt-2 font-semibold" style={{ color: 'var(--th-text3)' }}>Loading database case records...</p>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Action row */}
                                      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
                                        <button
                                          onClick={() => handleViewDatabaseDraft(dbItem)}
                                          className="flex-1 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                                          style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-dark))' }}
                                        >
                                          <Layers className="w-4 h-4" />
                                          Load Full Database to Workspace
                                        </button>
                                        <button
                                          onClick={() => handleDownloadAllDocx(dbItem.diaries || [], dbItem.name)}
                                          className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all hover:bg-gray-50"
                                        >
                                          <FileDown className="w-4 h-4 text-gray-400" />
                                          Export All to Word
                                        </button>
                                      </div>

                                      {/* Cases List */}
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text4)' }}>Extracted Case Numbers</p>
                                          {selectedInThisDb.length > 0 && (
                                            <button
                                              onClick={() => handleLoadSelectedCases(dbItem)}
                                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                                            >
                                              <Play className="w-3 h-3" />
                                              Load Selected Cases ({selectedInThisDb.length})
                                            </button>
                                          )}
                                        </div>
                                        {(dbItem.diaries || []).map((diary) => {
                                          const isChecked = selectedDatabaseCaseIds.includes(diary.id);
                                          return (
                                            <div 
                                              key={diary.id} 
                                              className="flex items-center justify-between p-3 border rounded-xl gap-3 transition-all cursor-pointer"
                                              style={{ 
                                                borderColor: isChecked ? 'var(--th-primary)' : 'var(--th-border2)', 
                                                background: isChecked ? 'var(--th-primary-xlight)' : 'var(--th-surface2)' 
                                              }}
                                              onClick={() => {
                                                setSelectedDatabaseCaseIds(prev => {
                                                  if (prev.includes(diary.id)) {
                                                    return prev.filter(id => id !== diary.id);
                                                  } else {
                                                    return [...prev, diary.id];
                                                  }
                                                });
                                              }}
                                            >
                                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  readOnly
                                                  className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-xs font-bold truncate" style={{ color: 'var(--th-text)' }}>{diary.crNoAndSecOfLaw || 'Case Record'}</p>
                                                  <p className="text-[10px] truncate" style={{ color: 'var(--th-text4)' }}>{diary.policeStation}</p>
                                                </div>
                                              </div>
                                              
                                              <div className="flex-shrink-0 flex items-center gap-2">
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ color: 'var(--th-primary)', background: 'var(--th-surface)' }}>{diary.dateOfCd}</span>
                                                
                                                {/* Edit individual record button */}
                                                <button
                                                  onClick={(e) => handleEditDiaryFromDatabase(dbItem, diary.id, e)}
                                                  className="p-1.5 rounded-lg transition-colors border shadow-2xs hover:bg-gray-50 bg-white"
                                                  style={{ color: 'var(--th-text3)', borderColor: 'var(--th-border)' }}
                                                  title="Edit individual case record in workspace"
                                                >
                                                  <Edit3 className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Delete individual record button */}
                                                {roleInfo.level === 'admin' && (
                                                  <button
                                                    onClick={(e) => handleDeleteDiaryFromDatabase(dbItem.id, diary.id, e)}
                                                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors border shadow-2xs bg-white"
                                                    style={{ borderColor: 'var(--th-border)' }}
                                                    title="Delete individual case record from database"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Accordion Actions & Danger Zone */}
                                      <div className="mt-4 pt-3 border-t flex justify-between items-center" style={{ borderColor: 'var(--th-border)' }}>
                                        <button
                                          onClick={() => handleExportDatabase(dbItem)}
                                          className="text-[10px] font-bold text-sky-650 hover:text-sky-850 hover:bg-sky-50 dark:hover:bg-slate-800 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer border border-transparent hover:border-sky-200"
                                          title="Export database case records as JSON backup"
                                        >
                                          <FileDown className="w-3.5 h-3.5 text-gray-400" />
                                          Export DB Backup
                                        </button>

                                        {roleInfo.level === 'admin' && (
                                          <button
                                            onClick={() => handleDeleteDatabase(dbItem.id)}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer border border-transparent hover:border-red-200"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete Cloud DB
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}              {activeTab === 'editor' && (
                <div className="w-full flex flex-col gap-6">
                  {diaries.length === 0 ? (
                    /* WORKSPACE PLACEHOLDER */
                    <div className="backdrop-blur-md border rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[600px] my-auto animate-fade-in" style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border shadow-xs" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                        <FileCheck2 className="w-8 h-8 animate-pulse" style={{ color: 'var(--th-primary)' }} />
                      </div>
                      <h3 className="font-display font-bold text-lg" style={{ color: 'var(--th-text)' }}>Layout Preservation Document Workspace</h3>
                      <p className="text-xs mt-2 max-w-md leading-relaxed" style={{ color: 'var(--th-text3)' }}>
                        Transform scanned police case diaries into pristine editable Word forms. Adjust margins, add/remove accused rows, and generate formatted docx files.
                      </p>
                      
                      <div className="mt-8 flex flex-col sm:flex-row gap-4 text-left max-w-lg p-5 rounded-2xl border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                        <div className="flex-1">
                          <span className="text-xs font-semibold" style={{ color: 'var(--th-text2)' }}>1. Reconstruct Layout</span>
                          <p className="text-[10px] mt-1 leading-normal font-medium" style={{ color: 'var(--th-text4)' }}>
                            Upload your Case Diary PDF in the <strong>Gateway Terminal</strong>. The system parses structural grids, accused lists, and remarks.
                          </p>
                        </div>
                        <div className="w-px hidden sm:block" style={{ background: 'var(--th-border)' }}></div>
                        <div className="flex-1">
                          <span className="text-xs font-semibold" style={{ color: 'var(--th-text2)' }}>2. Interactive Word Compilation</span>
                          <p className="text-[10px] mt-1 leading-normal font-medium" style={{ color: 'var(--th-text4)' }}>
                            Edit parameters right inside your browser workspace. Export high-fidelity Microsoft Word documents instantly.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* SPLIT PANEL LAYOUT */
                    <div className="w-full flex flex-col lg:flex-row gap-6 items-start animate-fade-in">
                      {/* Mobile: case list OR editor; Desktop: side-by-side */}
                      {/* Left panel: loaded cases list & search */}
                      <div 
                        className={`w-full lg:w-80 shrink-0 backdrop-blur-md border rounded-3xl p-5 shadow-sm flex flex-col gap-4 sticky top-[130px] lg:max-h-[calc(100vh-160px)] overflow-hidden ${showMobileEditor ? 'hidden lg:flex' : 'flex'}`}
                        style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}
                      >
                        <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text3)' }}>Loaded Case Diaries</h4>
                        
                        {/* Search loaded cases */}
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--th-text4)' }} />
                          <input
                            type="text"
                            placeholder="Search workspace..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2 border rounded-xl text-xs font-semibold focus:outline-none transition-all shadow-xs"
                            style={{
                              background: 'var(--th-input-bg)',
                              borderColor: 'var(--th-input-border)',
                              color: 'var(--th-text)'
                            }}
                          />
                        </div>

                        {/* Scrollable list of loaded cases */}
                        <div className="flex-1 overflow-y-auto max-h-[300px] lg:max-h-[none] flex flex-col gap-2 pr-1">
                          {diaries
                            .filter(diary => {
                              const q = searchQuery.toLowerCase().trim();
                              if (!q) return true;
                              return (diary.crNoAndSecOfLaw || '').toLowerCase().includes(q) ||
                                     (diary.policeStation || '').toLowerCase().includes(q) ||
                                     (diary.district || '').toLowerCase().includes(q) ||
                                     (diary.dateOfCd || '').toLowerCase().includes(q);
                            })
                            .map((diary) => {
                              const isSelected = selectedDiaryId === diary.id;
                              return (
                                <div
                                  key={diary.id}
                                  onClick={() => { setSelectedDiaryId(diary.id); setShowMobileEditor(true); }}
                                  className="group px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer"
                                  style={isSelected ? {
                                    background: 'var(--th-primary)',
                                    color: 'white',
                                    borderColor: 'var(--th-primary)'
                                  } : {
                                    background: 'var(--th-surface)',
                                    color: 'var(--th-text2)',
                                    borderColor: 'var(--th-border)'
                                  }}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FileText className="w-4 h-4 shrink-0" style={{ color: isSelected ? 'white' : 'var(--th-primary)' }} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold truncate">
                                        {diary.crNoAndSecOfLaw.split(' ')[0] || diary.crNoAndSecOfLaw || 'Case Record'}
                                      </p>
                                      <p className="text-[10px] opacity-75 truncate">
                                        {diary.dateOfCd || 'No Date'} • {diary.policeStation || 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <button
                                    onClick={(e) => handleDeleteWorkspaceDiary(diary.id, e)}
                                    className={`p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer ${
                                      isSelected
                                        ? 'text-white/80 hover:text-white hover:bg-white/20'
                                        : 'text-gray-400 hover:text-red-500 hover:bg-red-55'
                                    }`}
                                    title="Remove from Workspace"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          {diaries.filter(diary => {
                            const q = searchQuery.toLowerCase().trim();
                            if (!q) return true;
                            return (diary.crNoAndSecOfLaw || '').toLowerCase().includes(q) ||
                                   (diary.policeStation || '').toLowerCase().includes(q) ||
                                   (diary.district || '').toLowerCase().includes(q) ||
                                   (diary.dateOfCd || '').toLowerCase().includes(q);
                          }).length === 0 && (
                            <p className="text-xs text-center py-4 italic" style={{ color: 'var(--th-text4)' }}>No matching cases.</p>
                          )}
                        </div>

                        {/* Bottom Actions */}
                        <div className="border-t pt-4 flex flex-col gap-2" style={{ borderColor: 'var(--th-border)' }}>
                          <button
                            onClick={handleExportAllToZip}
                            disabled={isBulkExporting}
                            className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
                          >
                            <FileDown className="w-4 h-4 text-gray-400" />
                            {isBulkExporting ? 'Exporting ZIP...' : 'Export Workspace ZIP'}
                          </button>
                          
                          <button
                            onClick={() => handleDownloadAllDocx(diaries, `Combined-Case-Diaries-${Date.now()}`)}
                            className="w-full text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow transition-all"
                            style={{ background: 'var(--th-primary)' }}
                          >
                            <FileDown className="w-4 h-4" />
                            Export Combined Word ({diaries.length})
                          </button>
                        </div>
                      </div>

                      {/* Right Panel: Editor Form */}
                      <div className={`flex-1 w-full flex-col gap-6 ${showMobileEditor ? 'flex' : 'hidden lg:flex'}`}>
                        {activeDiary ? (
                          <div className="backdrop-blur-md border rounded-3xl p-6 shadow-sm flex flex-col h-full min-h-[600px]" style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}>
                            {/* Mobile Back Button */}
                            <button
                              className="lg:hidden mb-3 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                              style={{ color: 'var(--th-primary)' }}
                              onClick={() => setShowMobileEditor(false)}
                            >
                              <ArrowLeft className="w-4 h-4" />
                              Back to Case List
                            </button>
                            {/* Database active session indicator banner */}
                            {loadedDbId && (
                              <div className="mb-4 border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in" style={{ background: 'var(--th-primary-xlight)', borderColor: 'var(--th-border)' }}>
                                <div className="flex items-center gap-2">
                                  <Database className="w-4 h-4 shrink-0" style={{ color: 'var(--th-primary)' }} />
                                  <div>
                                    <p className="text-xs font-bold" style={{ color: 'var(--th-text)' }}>Active Database Session: <span className="underline">{loadedDbName}</span></p>
                                    <p className="text-[10px] font-medium" style={{ color: 'var(--th-text3)' }}>Any changes you make here can be synced directly back to your database library.</p>
                                  </div>
                                </div>
                                <button
                                  onClick={handleUpdateDatabase}
                                  className="text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0"
                                  style={{ background: 'var(--th-primary)' }}
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  Sync Updates to DB
                                </button>
                              </div>
                            )}

                            {/* Database Save Status Feedback Notification */}
                            {saveDbStatus.message && (
                              <div className={`mb-4 p-4 border rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-xs ${
                                saveDbStatus.type === 'success' 
                                  ? 'bg-green-50 border-green-100 text-green-700' 
                                  : saveDbStatus.type === 'error'
                                  ? 'bg-red-55 border-red-100 text-red-750'
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

                            {/* Workspace Header Actions */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--th-border)' }}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-md border border-green-200/50">VERIFIED PREVIEW</span>
                                  <span className="text-[10px] font-semibold" style={{ color: 'var(--th-text4)' }}>{activeDiary.dateOfCd}</span>
                                </div>
                                <h2 className="font-display font-bold text-lg mt-1" style={{ color: 'var(--th-text)' }}>{activeDiary.crNoAndSecOfLaw}</h2>
                                <p className="text-xs font-medium" style={{ color: 'var(--th-text4)' }}>Reconstructed Case Diary • Station: {activeDiary.policeStation}</p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-end">
                                {loadedDbId ? (
                                  <button
                                    onClick={handleUpdateDatabase}
                                    className="text-white text-xs font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0"
                                    style={{ background: 'var(--th-primary)' }}
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    Sync Updates to DB
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <input
                                      type="text"
                                      placeholder="DB Name..."
                                      value={dbNameInput}
                                      onChange={(e) => setDbNameInput(e.target.value)}
                                      className="bg-white border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-900 shadow-sm"
                                      style={{ width: '130px', height: '36px', borderColor: 'var(--th-border)' }}
                                    />
                                    <button
                                      onClick={handleSaveToDatabase}
                                      className="text-white text-xs font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0"
                                      style={{ background: 'var(--th-primary)' }}
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                      Save DB
                                    </button>
                                  </div>
                                )}

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
                              </div>
                            </div>

                            {/* Interactive Case Diary Document Form */}
                            <div className="space-y-6 mt-6 max-h-[680px] overflow-y-auto pr-1">
                              {/* Section 1: Headers */}
                              <div className="p-4 border rounded-xl space-y-4" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--th-primary)' }}>I. Administration & Registry</h4>
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
                              <div className="p-4 border rounded-xl space-y-4" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--th-primary)' }}>II. Occurrence & Complainant Details</h4>
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
                              <div className="p-4 border rounded-xl space-y-3.5" style={{ borderColor: 'var(--th-border)' }}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--th-primary)' }}>III. Accused Details</h4>
                                  <button
                                    onClick={addAccusedRow}
                                    className="text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                                    style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)' }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Accused
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  {activeDiary.accusedList.map((acc, index) => (
                                    <div key={index} className="flex gap-2 items-center p-2.5 rounded-xl border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
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
                              <div className="p-4 border rounded-xl space-y-4" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--th-primary)' }}>VI. Stage & Court Administration</h4>
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
                              <div className="p-4 border rounded-xl space-y-4" style={{ borderColor: 'var(--th-border)' }}>
                                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--th-primary)' }}>Hearing Parameters & Checks</h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: 'var(--th-text3)' }}>Magistrate Present?</label>
                                    <div className="flex p-0.5 rounded-xl border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleFieldChange('whetherMagistratePresent', 'YES')}
                                        className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer`}
                                        style={activeDiary.whetherMagistratePresent === 'YES' ? { background: 'var(--th-primary)', color: 'white' } : { color: 'var(--th-text4)' }}
                                      >
                                        YES
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleFieldChange('whetherMagistratePresent', 'NO')}
                                        className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer`}
                                        style={activeDiary.whetherMagistratePresent === 'NO' ? { background: 'var(--th-primary)', color: 'white' } : { color: 'var(--th-text4)' }}
                                      >
                                        NO
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: 'var(--th-text3)' }}>APP / PP Present?</label>
                                    <div className="flex p-0.5 rounded-xl border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleFieldChange('whetherAppPpPresent', 'YES')}
                                        className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer`}
                                        style={activeDiary.whetherAppPpPresent === 'YES' ? { background: 'var(--th-primary)', color: 'white' } : { color: 'var(--th-text4)' }}
                                      >
                                        YES
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleFieldChange('whetherAppPpPresent', 'NO')}
                                        className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer`}
                                        style={activeDiary.whetherAppPpPresent === 'NO' ? { background: 'var(--th-primary)', color: 'white' } : { color: 'var(--th-text4)' }}
                                      >
                                        NO
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: 'var(--th-text3)' }}>Defence Counsel Present?</label>
                                    <div className="flex p-0.5 rounded-xl border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleFieldChange('whetherDefenceCounselPresent', 'YES')}
                                        className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer`}
                                        style={activeDiary.whetherDefenceCounselPresent === 'YES' ? { background: 'var(--th-primary)', color: 'white' } : { color: 'var(--th-text4)' }}
                                      >
                                        YES
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleFieldChange('whetherDefenceCounselPresent', 'NO')}
                                        className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer`}
                                        style={activeDiary.whetherDefenceCounselPresent === 'NO' ? { background: 'var(--th-primary)', color: 'white' } : { color: 'var(--th-text4)' }}
                                      >
                                        NO
                                      </button>
                                    </div>
                                  </div>
                                </div>

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
                                  className="mt-2 w-full bg-white border border-gray-250 rounded-xl p-3.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed"
                                  style={{ borderColor: 'var(--th-border)' }}
                                  placeholder="Insert case diary remarks, typewriter transcripts, or hand-written summaries"
                                />
                              </div>

                              {/* Section 8: Posted & Future Hearing parameters */}
                              <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-xl space-y-4" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
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
                            <div className="flex flex-wrap items-center gap-2.5 shrink-0 justify-end pt-5 border-t mt-5" style={{ borderColor: 'var(--th-border)' }}>
                              {loadedDbId ? (
                                <button
                                  onClick={handleUpdateDatabase}
                                  className="text-white text-xs font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0"
                                  style={{ background: 'var(--th-primary)' }}
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  Sync Updates to DB
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="text"
                                    placeholder="DB Name..."
                                    value={dbNameInput}
                                    onChange={(e) => setDbNameInput(e.target.value)}
                                    className="bg-white border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-900 shadow-sm"
                                    style={{ width: '130px', height: '36px', borderColor: 'var(--th-border)' }}
                                  />
                                  <button
                                    onClick={handleSaveToDatabase}
                                    className="text-white text-xs font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0"
                                    style={{ background: 'var(--th-primary)' }}
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    Save DB
                                  </button>
                                </div>
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
                            </div>
                          </div>
                        ) : (
                          <div className="backdrop-blur-md border rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center text-center flex-1 animate-fade-in" style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}>
                            <FileText className="w-12 h-12 mb-3" style={{ color: 'var(--th-primary)' }} />
                            <p className="text-sm font-semibold" style={{ color: 'var(--th-text2)' }}>No case selected</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--th-text4)' }}>Select a case record from the left sidebar to start editing.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bulkexport' && (
                <div className="w-full flex flex-col gap-5 animate-fade-in">
                  {/* Bulk Export Header */}
                  <div
                    className="backdrop-blur-md border rounded-3xl p-5 shadow-sm"
                    style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl" style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)' }}>
                          <PackageOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-sm" style={{ color: 'var(--th-text)' }}>Bulk Export</h3>
                          <p className="text-[10px] font-medium" style={{ color: 'var(--th-text3)' }}>
                            {bulkSelectedIds.size > 0 ? `${bulkSelectedIds.size} of ${diaries.length} cases selected` : `${diaries.length} case ${diaries.length === 1 ? 'diary' : 'diaries'} in workspace`}
                          </p>
                        </div>
                      </div>

                      {/* Export Action Buttons */}
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          onClick={async () => {
                            const selected = diaries.filter(d => bulkSelectedIds.has(d.id));
                            if (selected.length === 0) { alert('Please select at least one case diary to export.'); return; }
                            setIsBulkExporting(true);
                            try {
                              await handleDownloadAllDocx(selected, `Bulk_Combined_Cases_${Date.now()}`);
                            } finally { setIsBulkExporting(false); }
                          }}
                          disabled={isBulkExporting || bulkSelectedIds.size === 0}
                          className="text-white text-xs font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow transition-all disabled:opacity-40"
                          style={{ background: 'var(--th-primary)' }}
                          title="Export selected cases as a single combined Word document"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Combined Word ({bulkSelectedIds.size})
                        </button>

                        <button
                          onClick={async () => {
                            const selected = diaries.filter(d => bulkSelectedIds.has(d.id));
                            if (selected.length === 0) { alert('Please select at least one case diary to export.'); return; }
                            setIsBulkExporting(true);
                            try {
                              const blob = await exportDiariesToZip(selected);
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `Bulk_Case_Diaries_ZIP_${Date.now()}.zip`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(url);
                            } catch (err: any) {
                              alert(`ZIP export failed: ${err.message}`);
                            } finally { setIsBulkExporting(false); }
                          }}
                          disabled={isBulkExporting || bulkSelectedIds.size === 0}
                          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-40"
                          title="Export selected cases as individual Word files in a ZIP archive"
                        >
                          <FileDown className="w-3.5 h-3.5 text-gray-400" />
                          {isBulkExporting ? 'Exporting...' : `ZIP Archive (${bulkSelectedIds.size})`}
                        </button>
                      </div>
                    </div>

                    {/* Search + Select All / Deselect All */}
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--th-text4)' }} />
                        <input
                          type="text"
                          placeholder="Search cases by CR No, station, district or date..."
                          value={bulkSearchQuery}
                          onChange={(e) => setBulkSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2 border rounded-xl text-xs font-semibold focus:outline-none transition-all shadow-xs"
                          style={{ background: 'var(--th-input-bg)', borderColor: 'var(--th-input-border)', color: 'var(--th-text)' }}
                        />
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => {
                            const filtered = diaries.filter(d => {
                              const q = bulkSearchQuery.toLowerCase().trim();
                              if (!q) return true;
                              return (d.crNoAndSecOfLaw || '').toLowerCase().includes(q) ||
                                (d.policeStation || '').toLowerCase().includes(q) ||
                                (d.district || '').toLowerCase().includes(q) ||
                                (d.dateOfCd || '').toLowerCase().includes(q);
                            });
                            setBulkSelectedIds(prev => {
                              const next = new Set(prev);
                              filtered.forEach(d => next.add(d.id));
                              return next;
                            });
                          }}
                          className="text-xs font-bold px-3 py-2 rounded-xl border cursor-pointer transition-all"
                          style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)', color: 'var(--th-text2)' }}
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setBulkSelectedIds(new Set())}
                          className="text-xs font-bold px-3 py-2 rounded-xl border cursor-pointer transition-all"
                          style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)', color: 'var(--th-text2)' }}
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Case Diary Checklist */}
                  {diaries.length === 0 ? (
                    <div
                      className="backdrop-blur-md border rounded-3xl p-10 shadow-sm flex flex-col items-center justify-center text-center"
                      style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}
                    >
                      <PackageOpen className="w-10 h-10 mb-3 opacity-30" style={{ color: 'var(--th-text3)' }} />
                      <p className="text-sm font-semibold" style={{ color: 'var(--th-text3)' }}>No case diaries in workspace</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--th-text4)' }}>Load cases via Gateway or Case Files tab first.</p>
                    </div>
                  ) : (
                    <div
                      className="backdrop-blur-md border rounded-3xl p-4 shadow-sm flex flex-col gap-2"
                      style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}
                    >
                      {diaries
                        .filter(d => {
                          const q = bulkSearchQuery.toLowerCase().trim();
                          if (!q) return true;
                          return (d.crNoAndSecOfLaw || '').toLowerCase().includes(q) ||
                            (d.policeStation || '').toLowerCase().includes(q) ||
                            (d.district || '').toLowerCase().includes(q) ||
                            (d.dateOfCd || '').toLowerCase().includes(q);
                        })
                        .map((diary) => {
                          const isChecked = bulkSelectedIds.has(diary.id);
                          return (
                            <label
                              key={diary.id}
                              htmlFor={`bulk-chk-${diary.id}`}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all select-none"
                              style={isChecked ? {
                                background: 'var(--th-primary-xlight)',
                                borderColor: 'var(--th-primary)',
                              } : {
                                background: 'var(--th-surface)',
                                borderColor: 'var(--th-border)',
                              }}
                            >
                              <input
                                id={`bulk-chk-${diary.id}`}
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setBulkSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(diary.id)) next.delete(diary.id);
                                    else next.add(diary.id);
                                    return next;
                                  });
                                }}
                                className="w-4 h-4 rounded shrink-0 accent-[var(--th-primary)] cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate" style={{ color: 'var(--th-text)' }}>
                                  {diary.crNoAndSecOfLaw || 'Untitled Case'}
                                </p>
                                <p className="text-[10px] font-medium truncate" style={{ color: 'var(--th-text3)' }}>
                                  {diary.dateOfCd || '—'} • {diary.policeStation || 'Unknown Station'} • {diary.district || 'Unknown District'}
                                </p>
                              </div>
                              {diary.dbId && (
                                <span
                                  className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                  style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)' }}
                                >
                                  DB
                                </span>
                              )}
                            </label>
                          );
                        })}
                      {diaries.filter(d => {
                        const q = bulkSearchQuery.toLowerCase().trim();
                        if (!q) return true;
                        return (d.crNoAndSecOfLaw || '').toLowerCase().includes(q) ||
                          (d.policeStation || '').toLowerCase().includes(q) ||
                          (d.district || '').toLowerCase().includes(q) ||
                          (d.dateOfCd || '').toLowerCase().includes(q);
                      }).length === 0 && (
                        <p className="text-xs text-center py-6 italic" style={{ color: 'var(--th-text4)' }}>No matching cases found.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'dashboard' && (
                <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
                  {/* Admin Control Center Dashboard */}
                  <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-3xl p-6 shadow-sm border border-white/20">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-150">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                          <Shield className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-gray-955 text-base">Admin Control Center</h3>
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
                      <div
                        className="mt-6 p-6 border rounded-2xl shadow-sm"
                        style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}
                      >
                        <div className="flex items-center gap-2 mb-5">
                          <div className="p-2 rounded-xl" style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)' }}>
                            <Lock className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold" style={{ color: 'var(--th-text)' }}>Database Access Manager</h4>
                            <p className="text-[10px] font-medium" style={{ color: 'var(--th-text3)' }}>Grant or revoke database access for one or multiple users</p>
                          </div>
                        </div>

                        {/* Grant Access Form */}
                        <div
                          className="grid grid-cols-1 gap-4 p-4 rounded-xl mb-5 border"
                          style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Multi-email input */}
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text3)' }}>
                                User Emails <span className="normal-case font-normal">(comma-separated for multiple)</span>
                              </label>
                              <textarea
                                rows={2}
                                placeholder={"e.g. user1@gmail.com, user2@gmail.com"}
                                value={adminGrantEmails}
                                onChange={(e) => setAdminGrantEmails(e.target.value)}
                                className="w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none transition-all resize-none shadow-xs"
                                style={{ background: 'var(--th-input-bg)', borderColor: 'var(--th-input-border)', color: 'var(--th-text)' }}
                              />
                            </div>
                            {/* Database selector */}
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text3)' }}>
                                Select Database
                              </label>
                              <select
                                value={adminSelectedDbId}
                                onChange={(e) => setAdminSelectedDbId(e.target.value)}
                                className="w-full px-3 py-2 border rounded-xl text-xs font-bold focus:outline-none transition-all cursor-pointer shadow-xs"
                                style={{ background: 'var(--th-input-bg)', borderColor: 'var(--th-input-border)', color: 'var(--th-text)' }}
                              >
                                <option value="">-- Choose Database --</option>
                                {savedDatabases.map((db) => (
                                  <option key={db.id} value={db.id}>{db.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <button
                            onClick={handleGrantMultipleAccess}
                            disabled={isUpdatingAccess || !adminGrantEmails.trim() || !adminSelectedDbId}
                            className="w-full text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                            style={{ background: 'var(--th-primary)' }}
                          >
                            {isUpdatingAccess ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                            Grant Access to All Listed Emails
                          </button>
                        </div>

                        {/* Current Access — Grouped by Database */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--th-text3)' }}>Current Access — Grouped by Database</p>
                          {savedDatabases.length === 0 ? (
                            <p className="text-xs italic text-center py-4" style={{ color: 'var(--th-text4)' }}>No databases found.</p>
                          ) : (
                            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                              {savedDatabases.map((db) => {
                                // Collect all emails that have access to this DB
                                const usersWithAccess = (Object.entries(adminAccessMap) as [string, string[]][]).filter(
                                  ([, dbIds]) => dbIds.includes(db.id)
                                ).map(([email]) => email);
                                return (
                                  <div
                                    key={db.id}
                                    className="p-4 rounded-xl border"
                                    style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)' }}
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      <Database className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--th-primary)' }} />
                                      <span className="text-xs font-bold truncate" style={{ color: 'var(--th-text)' }}>{db.name}</span>
                                      <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)' }}>
                                        {usersWithAccess.length} user{usersWithAccess.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    {usersWithAccess.length === 0 ? (
                                      <p className="text-[10px] italic" style={{ color: 'var(--th-text4)' }}>No users have access to this database yet.</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-1.5">
                                        {usersWithAccess.map((email) => (
                                          <span
                                            key={email}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border"
                                            style={{ background: 'var(--th-primary-xlight)', borderColor: 'var(--th-border)', color: 'var(--th-text2)' }}
                                          >
                                            {email}
                                            <button
                                              onClick={() => handleUpdateAccess(email, db.id, 'revoke')}
                                              className="text-red-400 hover:text-red-600 font-bold ml-0.5 cursor-pointer"
                                              title={`Revoke ${email}'s access to ${db.name}`}
                                            >
                                              ✕
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    )}
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
        <div className="lg:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t px-4 py-2 z-50 flex items-center justify-around shadow-lg" style={{ background: 'var(--th-header-bg)', borderColor: 'var(--th-header-border)' }}>
          <button
            onClick={() => setActiveTab('gateway')}
            className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer`}
            style={{ color: activeTab === 'gateway' ? 'var(--th-primary)' : 'var(--th-text4)' }}
          >
            <UploadCloud className="w-5 h-5" />
            Gateway
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer relative`}
            style={{ color: activeTab === 'records' ? 'var(--th-primary)' : 'var(--th-text4)' }}
          >
            <FileText className="w-5 h-5" />
            Case Files
            {savedDatabases.length > 0 && (
              <span className="absolute top-0 right-3 px-1 py-0.5 text-white text-[7px] font-bold rounded-full leading-none" style={{ background: 'var(--th-primary)' }}>
                {savedDatabases.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer relative`}
            style={{ color: activeTab === 'editor' ? 'var(--th-primary)' : 'var(--th-text4)' }}
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
            onClick={() => { setActiveTab('bulkexport'); setBulkSelectedIds(new Set()); }}
            className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer relative`}
            style={{ color: activeTab === 'bulkexport' ? 'var(--th-primary)' : 'var(--th-text4)' }}
          >
            <PackageOpen className="w-5 h-5" />
            Bulk Export
            {bulkSelectedIds.size > 0 && (
              <span className="absolute top-0 right-2 px-1 py-0.5 bg-emerald-600 text-white text-[7px] font-bold rounded-full leading-none">
                {bulkSelectedIds.size}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer`}
            style={{ color: activeTab === 'dashboard' ? 'var(--th-primary)' : 'var(--th-text4)' }}
          >
            <Shield className="w-5 h-5" />
            Admin
          </button>
        </div>
      )}

      {/* Import Database Conflict Resolution Modal */}
      {importConflictData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl border flex flex-col gap-4"
            style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-base" style={{ color: 'var(--th-text)' }}>
                  Database Conflict Detected
                </h3>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--th-text3)' }}>
                  A database named <strong className="font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">{importConflictData.dbName}</strong> already exists. How would you like to proceed with the imported backup?
                </p>
              </div>
            </div>

            <div className="bg-gray-50/50 dark:bg-slate-900/30 border border-gray-100 dark:border-slate-800 p-3.5 rounded-2xl text-[11px] font-medium leading-relaxed" style={{ color: 'var(--th-text4)' }}>
              <div className="flex justify-between py-1 border-b border-gray-200/40">
                <span>Existing Database:</span>
                <span className="font-bold text-gray-850 dark:text-gray-150">{importConflictData.existingDb.diaries.length} records</span>
              </div>
              <div className="flex justify-between py-1 mt-1">
                <span>Importing Backup:</span>
                <span className="font-bold text-gray-850 dark:text-gray-150">{importConflictData.diaries.length} records</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 mt-2">
              <button
                onClick={handleResolveConflictMerge}
                className="w-full text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-dark))' }}
              >
                <Plus className="w-4 h-4" />
                Merge Case Records (Update & Append)
              </button>

              <button
                onClick={handleResolveConflictKeepBoth}
                className="w-full bg-white border border-gray-250 hover:bg-gray-50 text-gray-700 text-xs font-bold py-2.5 px-4 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FileUp className="w-4 h-4 text-gray-400" />
                Keep Both (Rename Imported Database)
              </button>

              <button
                onClick={() => setImportConflictData(null)}
                className="w-full bg-transparent hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-750 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-200"
              >
                Cancel Import
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer bar */}
      <footer className="border-t py-6 px-6 text-center text-[10px] font-medium z-10 relative" style={{ borderColor: 'var(--th-border)', background: 'var(--th-header-bg)', color: 'var(--th-text4)' }}>
        <p>DocuForge Case Diary Reconstruction Workspace • Powered securely by Google Cloud Platform & Gemini</p>
      </footer>
      <Analytics />
    </div>
  );
}
