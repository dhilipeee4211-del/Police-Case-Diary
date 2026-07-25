/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FileText, 
  UploadCloud, 
  CheckCircle, 
  CheckCircle2,
  Upload,
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
  PackageOpen,
  Cpu,
  Settings,
  Terminal,
  HeartPulse
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { InstallManager } from './pwa/InstallManager';
import { initAuth, googleSignIn, logout } from './firebase';
import { uploadAndConvertPdf, exportToDocx } from './converter';
import { generateCaseDiaryDocx, generateMultipleCaseDiariesDocx } from './exportDocx';
import { exportDiariesToZip } from './exportZip';
import { User } from 'firebase/auth';
import { CaseDiary, Accused, SavedDatabase } from './types';
import { saveSavedDatabase, getSavedDatabases, deleteSavedDatabase, getSavedDatabaseById } from './dbHelper';
import { extractTextFromPdfClientSide, loadPdfJs } from './clientOcr';

// Reconstruction Engine Services
import { Logger } from './services/Logger';
import { StorageManager } from './services/StorageManager';
import { ApiKeyManager } from './services/ApiKeyManager';
import { DataHealthService } from './services/DataHealthService';
import { DuplicateGroup, parseCdDate } from './services/DuplicateScanner';
import { QueueManager } from './services/QueueManager';
import { RecoveryManager } from './services/RecoveryManager';
import { ProgressManager } from './services/ProgressManager';
import { validateAndPlanImport, ImportValidationReport } from './services/ImportValidationService';
import { BackupManagerService, DuplicateBackupRecord } from './services/BackupManagerService';
import { ExtractionMonitorService, MonitorSnapshot } from './services/ExtractionMonitorService';

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
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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

  // Network online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addLocalLog('Network reconnected. You can retry the extraction.', 'SUCCESS');
    };
    const handleOffline = () => {
      setIsOnline(false);
      addLocalLog('Network disconnected. Extraction paused.', 'ERROR');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [monitorSnapshot, setMonitorSnapshot] = useState<MonitorSnapshot | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');

  // Subscribe to live extraction monitor — always active, updates every second during extraction
  useEffect(() => ExtractionMonitorService.subscribe(setMonitorSnapshot), []);
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(1);
  const [chunkSize, setChunkSize] = useState<number>(() => {
    return StorageManager.getLocalItem<number>('gateway_pages_per_chunk', 2);
  });
  const [telemetryTick, setTelemetryTick] = useState<number>(0);

  useEffect(() => {
    return ApiKeyManager.subscribe(() => {
      setTelemetryTick(prev => prev + 1);
    });
  }, []);

  useEffect(() => {
    StorageManager.setLocalItem('gateway_pages_per_chunk', chunkSize);
  }, [chunkSize]);

  const totalKeys = ApiKeyManager.getTotalKeysCount();
  const activeIndex = ApiKeyManager.getActiveKeyIndex();
  const isAllExhausted = ApiKeyManager.isAllExhausted();
  const activeStatus = ApiKeyManager.getKeyStatuses()[activeIndex];
  const isKeyExhausted = activeStatus?.status === 'quota_exhausted' || activeStatus?.status === 'auth_failed';
  const processedRequests = ApiKeyManager.getProcessedRequestsCount();
  const lastSwitchTime = ApiKeyManager.getLastSwitchTime();

  const formatLastSwitch = (time: number) => {
    if (time === 0) return 'Never';
    const diffSec = Math.floor((Date.now() - time) / 1000);
    if (diffSec < 6) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  };

  const [adminSubTab, setAdminSubTab] = useState<'dashboard' | 'users' | 'pdf' | 'logs' | 'settings' | 'health'>('dashboard');

  // Data Health Check Module states
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scannedCount, setScannedCount] = useState<number>(0);
  const [totalToScan, setTotalToScan] = useState<number>(0);
  const [estTimeSecs, setEstTimeSecs] = useState<number>(0);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroupForCompare, setSelectedGroupForCompare] = useState<DuplicateGroup | null>(null);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
  const [healthSearch, setHealthSearch] = useState<string>('');
  const [healthStation, setHealthStation] = useState<string>('all');
  const [healthYear, setHealthYear] = useState<string>('all');
  const [healthCourt, setHealthCourt] = useState<string>('all');
  const [healthOfficer, setHealthOfficer] = useState<string>('all');
  const [healthStats, setHealthStats] = useState<{
    totalRecords: number;
    uniqueRecords: number;
    duplicateGroupsCount: number;
    totalDuplicatesCount: number;
    scanTimeMs: number;
    lastScanDate: string;
    removedCount: number;
    score: number;
    latestPreservedDate: string;
    cleanupStatus: string;
  }>({
    totalRecords: 0,
    uniqueRecords: 0,
    duplicateGroupsCount: 0,
    totalDuplicatesCount: 0,
    scanTimeMs: 0,
    lastScanDate: '',
    removedCount: 0,
    score: 100,
    latestPreservedDate: 'N/A',
    cleanupStatus: 'Not Scanned'
  });

  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);

  // Backup Manager State
  const [backupManagerRecords, setBackupManagerRecords] = useState<DuplicateBackupRecord[]>([]);
  const [backupManagerTotal, setBackupManagerTotal] = useState<number>(0);
  const [backupManagerPage, setBackupManagerPage] = useState<number>(1);
  const [isLoadingBackupManager, setIsLoadingBackupManager] = useState<boolean>(false);
  const [backupManagerError, setBackupManagerError] = useState<string | null>(null);
  const [healthSubTab, setHealthSubTab] = useState<'scanner' | 'backup_manager'>('scanner');
  const [restoreTargetDbId, setRestoreTargetDbId] = useState<string>('');

  // Import Validation State
  const [importValidationReport, setImportValidationReport] = useState<ImportValidationReport | null>(null);
  const [showImportValidationModal, setShowImportValidationModal] = useState<boolean>(false);
  const [importValidationDbName, setImportValidationDbName] = useState<string>('');
  const [isImportingValidated, setIsImportingValidated] = useState<boolean>(false);

  const [importConflictData, setImportConflictData] = useState<{
    dbName: string;
    diaries: CaseDiary[];
    existingDb: SavedDatabase;
  } | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Load API Keys count from backend on mount
  useEffect(() => {
    ApiKeyManager.initialize();
  }, []);

  const loadBackupsAndLogs = async () => {
    try {
      const backups = await DataHealthService.getBackups();
      const audits = await DataHealthService.getAuditLogs();
      setBackupsList(backups);
      setAuditLogsList(audits);
    } catch (err) {
      console.error("Failed to load backups/audit logs:", err);
    }
  };

  const loadBackupManagerRecords = async (page = 1) => {
    setIsLoadingBackupManager(true);
    setBackupManagerError(null);
    try {
      const result = await BackupManagerService.listBackups(page, 50);
      setBackupManagerRecords(result.records);
      setBackupManagerTotal(result.total);
      setBackupManagerPage(page);
    } catch (err: any) {
      setBackupManagerError(err.message || 'Failed to load backup records');
    } finally {
      setIsLoadingBackupManager(false);
    }
  };

  const handleDeleteBackupRecord = async (id: string) => {
    if (!confirm('Permanently delete this backup record? This cannot be undone.')) return;
    try {
      await BackupManagerService.deleteBackup(id);
      setBackupManagerRecords(prev => prev.filter(r => r.id !== id));
      setBackupManagerTotal(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      alert(`Failed to delete backup: ${err.message}`);
    }
  };

  const handleRestoreBackupRecord = async (record: DuplicateBackupRecord) => {
    if (!restoreTargetDbId) {
      alert('Please select a target database to restore into.');
      return;
    }
    if (!confirm(`Restore "${record.original_record?.policeStation} / ${record.original_record?.crNoAndSecOfLaw}" into the selected database?`)) return;
    try {
      const result = await BackupManagerService.restoreBackup(record.id, restoreTargetDbId);
      if (result.success) {
        alert('✅ Record restored successfully!');
        loadBackupManagerRecords(backupManagerPage);
      } else if (result.reason === 'duplicate') {
        alert(`⚠️ Restore blocked: ${result.message}`);
      } else {
        alert(`Restore failed: ${result.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Restore error: ${err.message}`);
    }
  };

  // Sync health check filters
  useEffect(() => {
    const params = {
      search: healthSearch,
      station: healthStation,
      year: healthYear,
      court: healthCourt,
      officer: healthOfficer
    };
    const filtered = DataHealthService.filterGroups(duplicateGroups, params);
    setFilteredGroups(filtered);
  }, [healthSearch, healthStation, healthYear, healthCourt, healthOfficer, duplicateGroups]);

  const runHealthScan = async () => {
    if (savedDatabases.length === 0) {
      alert("No databases found to scan.");
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setScannedCount(0);
    setExpandedGroupKeys(new Set());

    let totalCount = 0;
    savedDatabases.forEach(db => {
      if (!db.id.startsWith('__')) {
        totalCount += (db.diaries || []).length;
      }
    });

    setTotalToScan(totalCount);

    const startTime = Date.now();
    const steps = Math.min(25, totalCount || 1);
    const stepDelay = Math.max(50, 1500 / steps); // Complete scan progress loop in 1.5 seconds

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDelay));
      const progressPercent = Math.floor((i / steps) * 100);
      const processed = Math.floor((i / steps) * totalCount);
      const timeRemaining = Math.max(0, Math.ceil(((steps - i) * stepDelay) / 1000));

      setScanProgress(progressPercent);
      setScannedCount(processed);
      setEstTimeSecs(timeRemaining);
    }

    const results = DataHealthService.scanDatabase(savedDatabases);
    const scanDuration = Date.now() - startTime;

    let totalDuplicates = 0;
    let latestPreservedDate = 'N/A';
    let latestPreservedTime = 0;

    results.forEach(g => {
      totalDuplicates += g.duplicates.length;
      const d = parseCdDate(g.originalRecord.dateOfCd);
      if (d && d.getTime() > latestPreservedTime) {
        latestPreservedTime = d.getTime();
        latestPreservedDate = g.originalRecord.dateOfCd;
      }
    });

    const unique = totalCount - totalDuplicates;
    const healthScore = totalCount > 0 ? Math.floor((unique / totalCount) * 100) : 100;
    const cleanupStatus = results.length === 0 ? 'Healthy (No Duplicates)' : 'Duplicates Found: Action Required';

    setDuplicateGroups(results);
    setHealthStats(prev => ({
      ...prev,
      totalRecords: totalCount,
      uniqueRecords: unique,
      duplicateGroupsCount: results.length,
      totalDuplicatesCount: totalDuplicates,
      scanTimeMs: scanDuration,
      lastScanDate: new Date().toLocaleString('en-GB'),
      score: healthScore,
      latestPreservedDate,
      cleanupStatus
    }));

    setIsScanning(false);
    await loadBackupsAndLogs();
  };

  const handleRemoveGroupDuplicates = async (group: DuplicateGroup) => {
    const confirmMsg = `You are about to remove ${group.duplicates.length} duplicate record(s).\n\nThe newest Case Diary (latest CD Date) in each duplicate group will be preserved.\n\nAll older duplicate records will be moved to backup storage (case_diary_duplicate_backup) and deleted from the active list.\n\nDo you want to continue?`;
    if (window.confirm(confirmMsg)) {
      try {
        setIsScanning(true);
        const adminEmail = user?.email || 'admin@gmail.com';
        
        // Call backend transaction-safe endpoint
        await BackupManagerService.runTransactionSafeCleanup([group], adminEmail);
        
        // Refresh databases list from Supabase
        const dbs = await getSavedDatabases(user?.uid || '');
        setSavedDatabases(dbs);

        const updatedResults = DataHealthService.scanDatabase(dbs);
        setDuplicateGroups(updatedResults);

        // Recompute stats
        let totalDuplicates = 0;
        let latestPreservedDate = 'N/A';
        let latestPreservedTime = 0;
        updatedResults.forEach(g => {
          totalDuplicates += g.duplicates.length;
          const d = parseCdDate(g.originalRecord.dateOfCd);
          if (d && d.getTime() > latestPreservedTime) {
            latestPreservedTime = d.getTime();
            latestPreservedDate = g.originalRecord.dateOfCd;
          }
        });
        const totalCount = dbs.filter(db => !db.id.startsWith('__')).reduce((acc, db) => acc + (db.diaries?.length || 0), 0);
        const unique = totalCount - totalDuplicates;
        const healthScore = totalCount > 0 ? Math.floor((unique / totalCount) * 100) : 100;
        const cleanupStatus = updatedResults.length === 0 ? 'Healthy (No Duplicates)' : 'Duplicates Found: Action Required';

        setHealthStats(prev => ({
          ...prev,
          totalRecords: totalCount,
          uniqueRecords: unique,
          duplicateGroupsCount: updatedResults.length,
          totalDuplicatesCount: totalDuplicates,
          removedCount: prev.removedCount + group.duplicates.length,
          score: healthScore,
          latestPreservedDate,
          cleanupStatus
        }));

        await loadBackupsAndLogs();
        alert("Duplicates removed successfully and backed up into the separate table.");
      } catch (err: any) {
        alert(`Failed to remove duplicates: ${err.message || err}`);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleBulkRemoveAll = async () => {
    if (duplicateGroups.length === 0) {
      alert("No duplicate groups found to clean.");
      return;
    }
    
    let totalDuplicates = 0;
    duplicateGroups.forEach(g => {
      totalDuplicates += g.duplicates.length;
    });

    const confirmMsg = `You are about to remove ${totalDuplicates} duplicate records.\n\nThe newest Case Diary (latest CD Date) in each duplicate group will be preserved.\n\nAll older duplicate records will be moved to backup storage (case_diary_duplicate_backup) and deleted from the active list.\n\nDo you want to continue?`;
    if (window.confirm(confirmMsg)) {
      try {
        setIsScanning(true);
        const adminEmail = user?.email || 'admin@gmail.com';

        // Chunking implementation for Vercel Free Serverless limits
        const chunkSize = 10;
        let totalRemoved = 0;
        const totalChunks = Math.ceil(duplicateGroups.length / chunkSize);
        
        for (let i = 0; i < duplicateGroups.length; i += chunkSize) {
          const chunk = duplicateGroups.slice(i, i + chunkSize);
          const chunkNum = Math.floor(i / chunkSize) + 1;
          
          setHealthStats(prev => ({
            ...prev,
            cleanupStatus: `Cleaning chunk ${chunkNum} of ${totalChunks}...`
          }));

          const result = await BackupManagerService.runTransactionSafeCleanup(chunk, adminEmail);
          totalRemoved += result.totalDeleted;
        }

        // Refresh databases list from Supabase
        const dbs = await getSavedDatabases(user?.uid || '');
        setSavedDatabases(dbs);

        const updatedResults = DataHealthService.scanDatabase(dbs);
        setDuplicateGroups(updatedResults);

        // Recompute stats
        let newTotalDuplicates = 0;
        let latestPreservedDate = 'N/A';
        let latestPreservedTime = 0;
        updatedResults.forEach(g => {
          newTotalDuplicates += g.duplicates.length;
          const d = parseCdDate(g.originalRecord.dateOfCd);
          if (d && d.getTime() > latestPreservedTime) {
            latestPreservedTime = d.getTime();
            latestPreservedDate = g.originalRecord.dateOfCd;
          }
        });
        const totalCount = dbs.filter(db => !db.id.startsWith('__')).reduce((acc, db) => acc + (db.diaries?.length || 0), 0);
        const unique = totalCount - newTotalDuplicates;
        const healthScore = totalCount > 0 ? Math.floor((unique / totalCount) * 100) : 100;
        const cleanupStatus = updatedResults.length === 0 ? 'Healthy (No Duplicates)' : 'Duplicates Found: Action Required';

        setHealthStats(prev => ({
          ...prev,
          totalRecords: totalCount,
          uniqueRecords: unique,
          duplicateGroupsCount: updatedResults.length,
          totalDuplicatesCount: newTotalDuplicates,
          removedCount: prev.removedCount + totalRemoved,
          score: healthScore,
          latestPreservedDate,
          cleanupStatus
        }));

        await loadBackupsAndLogs();
        alert(`Successfully removed ${totalRemoved} duplicate records in ${totalChunks} chunks!`);
      } catch (err: any) {
        alert(`Bulk cleanup failed during execution: ${err.message || err}`);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (window.confirm("Are you sure you want to restore this backup? This will revert the affected databases to their original states and delete the backup registry record.")) {
      try {
        setIsScanning(true);
        await DataHealthService.restoreBackup(backupId);

        // Refresh databases list from Supabase
        const dbs = await getSavedDatabases(user?.uid || '');
        setSavedDatabases(dbs);

        const updatedResults = DataHealthService.scanDatabase(dbs);
        setDuplicateGroups(updatedResults);

        await loadBackupsAndLogs();
        alert("Backup snapshot successfully restored!");
      } catch (err: any) {
        alert(`Backup restoration failed: ${err.message || err}`);
      } finally {
        setIsScanning(false);
      }
    }
  };

  // Initialize RecoveryManager and sync queue state once user is logged in
  useEffect(() => {
    if (user) {
      RecoveryManager.initialize(user.uid);
    }
  }, [user]);

  // Hook up QueueManager and Logger to existing React state
  useEffect(() => {
    const unsubscribeQueue = QueueManager.subscribe((status) => {
      setIsExtracting(status.state === 'processing');
      setIsPaused(status.state === 'paused');
      setExtractionProgress(status.progress);
      setGatewayDbId(status.dbId);
      setLastExtractedDiaries(status.diaries);

      // Track recoveryQueue state for the recovery banner UI block
      if (status.state === 'paused' && status.totalChunks > 0 && status.currentChunkIndex < status.totalChunks) {
        setRecoveryQueue({
          filename: status.dbName || 'Reconstruction',
          nextIndex: status.currentChunkIndex,
          chunks: { length: status.totalChunks }
        });
      } else {
        setRecoveryQueue(null);
      }

      let stepText = '';
      if (status.state === 'processing') {
        const remainingStr = status.eta > 0 
          ? `ETA: ${Math.floor(status.eta / 60)}m ${status.eta % 60}s` 
          : 'Calculating ETA...';
        stepText = `Batch ${status.currentChunkIndex + 1}/${status.totalChunks} • Speed: ${status.speed} p/m • ${remainingStr}`;
      } else if (status.state === 'completed') {
        stepText = 'Reconstruction completed successfully!';
      } else if (status.state === 'paused') {
        stepText = 'Reconstruction paused.';
      } else if (status.state === 'error') {
        stepText = `Reconstruction failed: ${status.error || 'Unknown error'}`;
      } else if (status.state === 'idle' && status.totalChunks > 0) {
        stepText = `Ready to process (${status.totalChunks} batches)`;
      }
      setExtractionStep(stepText);

      if (status.error) {
        setConversionError(status.error);
      } else {
        setConversionError(null);
      }
    });

    const unsubscribeLogger = Logger.subscribe((logMessages) => {
      setExtractionLogs(logMessages.map(m => m.formatted));
    });

    return () => {
      unsubscribeQueue();
      unsubscribeLogger();
    };
  }, []);

  const handleDismissRecovery = () => {
    QueueManager.dismissRecovery();
    setRecoveryQueue(null);
  };

  const handleResumeRecovery = () => {
    QueueManager.resume();
    setRecoveryQueue(null);
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
      
      // Preserve any existing reconstruction progress metadata
      const existingDb = savedDatabases.find(db => db.id === generatedDbId);
      const metadataDiary = existingDb?.diaries?.find(d => d.id === '__reconstruction_metadata__');
      if (metadataDiary) {
        taggedDiaries.push(metadataDiary);
      }

      const saved = await saveSavedDatabase(dbName, taggedDiaries, user.uid, generatedDbId);
      setSavedDatabases((prev) => {
        const filtered = prev.filter(db => db.id !== saved.id);
        return [saved, ...filtered];
      });
      setGatewayDbId(saved.id);

      // Merge newly extracted tagged diaries (excluding metadata) into workspace
      const cleanDiaries = taggedDiaries.filter(d => d.id !== '__reconstruction_metadata__');
      setDiaries(prev => {
        const otherDiaries = prev.filter(d => !cleanDiaries.some(td => td.id === d.id));
        return [...otherDiaries, ...cleanDiaries];
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

    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const isCSV = fileExtension === 'csv';
    const fileType: 'json' | 'csv' = isCSV ? 'csv' : 'json';

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;

        // Derive a database name from file name
        const rawDbName = file.name.replace(/\.(json|csv)$/i, '').trim() || 'Imported Database';

        // Collect all existing diaries for duplicate detection
        const allExistingDiaries: CaseDiary[] = [];
        savedDatabases.forEach(db => {
          (db.diaries || []).forEach(d => {
            if (d.id !== '__reconstruction_metadata__') allExistingDiaries.push(d);
          });
        });

        // Run 7-step validation pipeline
        const report = validateAndPlanImport(text, fileType, allExistingDiaries);

        setImportValidationReport(report);
        setImportValidationDbName(rawDbName);
        setShowImportValidationModal(true);
      } catch (err: any) {
        console.error("Import validation error:", err);
        alert("Failed to process import file: " + err.message);
      } finally {
        if (importFileInputRef.current) {
          importFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmValidatedImport = async () => {
    if (!importValidationReport || !user) return;
    const { validDiaries } = importValidationReport;

    if (validDiaries.length === 0) {
      alert('No valid records to import.');
      setShowImportValidationModal(false);
      return;
    }

    setIsImportingValidated(true);
    try {
      const dbName = importValidationDbName || 'Imported Database';

      // Check for existing database with same name for conflict resolution
      const existingDb = savedDatabases.find(db => db.name.toLowerCase() === dbName.toLowerCase());
      if (existingDb) {
        // Reuse existing conflict dialog
        setShowImportValidationModal(false);
        setImportConflictData({ dbName, diaries: validDiaries, existingDb });
        return;
      }

      // No name conflict: import as new database
      const generatedDbId = `db-${Date.now()}`;
      const taggedDiaries = validDiaries.map(d => ({ ...d, dbId: generatedDbId }));
      const startTime = Date.now();
      const saved = await saveSavedDatabase(dbName, taggedDiaries, user.uid, generatedDbId);
      setSavedDatabases(prev => {
        const filtered = prev.filter(db => db.id !== saved.id);
        return [saved, ...filtered];
      });
      setDiaries(prev => {
        const combined = [...prev, ...taggedDiaries];
        const seen = new Set<string>();
        return combined.filter(d => {
          const key = `${(d.policeStation || '').trim().toLowerCase()}|${(d.crNoAndSecOfLaw || '').trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      setSelectedDiaryId(taggedDiaries[0]?.id || null);

      // Update the report with final imported count and time
      setImportValidationReport(prev => prev ? {
        ...prev,
        imported: taggedDiaries.length,
        timeTaken: prev.timeTaken + (Date.now() - startTime)
      } : prev);

      setSaveDbStatus({ type: 'success', message: `Successfully imported ${taggedDiaries.length} records as "${dbName}"!` });
      setTimeout(() => setSaveDbStatus({ type: null, message: null }), 3500);
      setShowImportValidationModal(false);
    } catch (err: any) {
      console.error("Confirmed import error:", err);
      alert("Import failed: " + err.message);
    } finally {
      setIsImportingValidated(false);
    }
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
    
    // Filter out reconstruction progress metadata diary from workspace loading
    const cleanDiaries = loadedDb.diaries.filter(d => d.id !== '__reconstruction_metadata__');
    const selectedDiaries = cleanDiaries.filter(d => selectedDatabaseCaseIds.includes(d.id));
    
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
      // Filter out reconstruction progress metadata diary from workspace loading
      const cleanDiaries = loadedDb.diaries.filter(d => d.id !== '__reconstruction_metadata__');
      if (cleanDiaries.length === 0) {
        alert("This database contains no case records.");
        return;
      }

      const firstDiary = diaries.find(d => d.dbId === dbItem.id);
      if (firstDiary) {
        setSelectedDiaryId(firstDiary.id);
      } else {
        const mapped = cleanDiaries.map(d => ({ ...d, dbId: dbItem.id }));
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
        setSelectedDiaryId(cleanDiaries[0].id);
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
      
      // Find and preserve existing progress metadata diary from loaded databases list, if it exists
      const existingDb = savedDatabases.find(db => db.id === loadedDbId);
      const metadataDiary = existingDb?.diaries?.find(d => d.id === '__reconstruction_metadata__');
      if (metadataDiary) {
        dbDiaries.push(metadataDiary);
      }

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
    QueueManager.pause();
  };

  const handleResume = () => {
    QueueManager.resume();
  };

  const handleCancel = async () => {
    await QueueManager.cancel();
  };

  const runExtraction = async () => {
    if (!selectedFile) return;

    if (!gatewayDbName.trim()) {
      alert("Please enter a database name before starting the reconstruction.");
      return;
    }

    if (!user) {
      alert("Please sign in before starting the reconstruction.");
      return;
    }

    Logger.clear();
    await QueueManager.enqueue(selectedFile, extractionMode, {
      dbName: gatewayDbName.trim(),
      startPage: startPageInput,
      chunkSize,
      concurrency: concurrencyLimit,
      userId: user.uid,
      dbId: gatewayDbId
    });
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
        
        // Find and preserve existing progress metadata diary if it exists
        const existingDb = savedDatabases.find(db => db.id === loadedDbId);
        const metadataDiary = existingDb?.diaries?.find(d => d.id === '__reconstruction_metadata__');
        if (metadataDiary) {
          dbDiaries.push(metadataDiary);
        }

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
    <div className="min-h-screen min-h-dvh flex flex-col antialiased relative pb-20 lg:pb-0" style={{ background: 'var(--th-bg)', color: 'var(--th-text)' }}>
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
              {(['gateway', 'records', 'editor', 'bulkexport', 'dashboard'] as const).filter((tab) => tab !== 'dashboard' || roleInfo.level === 'admin').map((tab) => {
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

                        {/* Collapsible Advanced Settings */}
                        <div className="border rounded-2xl p-3" style={{ borderColor: 'var(--th-border)', background: 'var(--th-surface)' }}>
                          <button
                            type="button"
                            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                            className="w-full flex items-center justify-between text-xs font-bold cursor-pointer"
                            style={{ color: 'var(--th-text2)' }}
                          >
                            <span className="flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5" style={{ color: 'var(--th-primary)' }} />
                              Advanced Engine Configuration
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {showAdvancedSettings && (
                            <div
                              className="mt-3 space-y-4 pt-3 border-t flex flex-col"
                              style={{ borderColor: 'var(--th-border2)' }}
                            >
                              {/* Concurrency and Chunk Size */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text4)' }}>
                                    Max Concurrency
                                  </label>
                                  <select
                                    value={concurrencyLimit}
                                    onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
                                    className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-semibold"
                                    style={{ background: 'var(--th-input-bg)', borderColor: 'var(--th-input-border)', color: 'var(--th-text)' }}
                                  >
                                    <option value={1}>1 request (Safe)</option>
                                    <option value={2}>2 requests (Fast)</option>
                                  </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text4)' }}>
                                    Pages per Chunk
                                  </label>
                                  <select
                                    value={chunkSize}
                                    onChange={(e) => setChunkSize(Number(e.target.value))}
                                    className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-semibold"
                                    style={{ background: 'var(--th-input-bg)', borderColor: 'var(--th-input-border)', color: 'var(--th-text)' }}
                                  >
                                    <option value={1}>1 Page (Memory Efficient)</option>
                                    <option value={2}>2 Pages (Standard)</option>
                                    <option value={5}>5 Pages (good)</option>
                                    <option value={10}>10 Pages (Fast)</option>
                                    <option value={20}>20 Pages (Maximum)</option>
                                  </select>
                                </div>
                              </div>


                              {/* ═══ LIVE MONITORING DASHBOARD ═══ */}
                              {(() => {
                                const snap = monitorSnapshot;
                                const qs = QueueManager.getStatus();
                                const keyStatuses = ApiKeyManager.getKeyStatuses();
                                const rotHistory = ApiKeyManager.getRotationHistory();

                                // ── Helper: format seconds to HH:MM:SS ──
                                const fmtSec = (s: number) => {
                                  if (!s || s <= 0) return '00:00:00';
                                  const h = Math.floor(s / 3600);
                                  const m = Math.floor((s % 3600) / 60);
                                  const sec = s % 60;
                                  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
                                };

                                const fmtTime = (ts: number) =>
                                  ts > 0 ? new Date(ts).toLocaleTimeString('en-US', { hour12: false }) : 'N/A';

                                // ── Engine Status ──
                                const engineState = snap?.status || qs.state;
                                const engineBadge: Record<string, string> = {
                                  processing: '🟢 Running',
                                  idle: '🟡 Waiting',
                                  retrying: '🟠 Retrying',
                                  paused: '🔴 Paused',
                                  cancelled: '⚫ Cancelled',
                                  importing: '🔵 Importing',
                                  completed: '✅ Completed',
                                  error: '🔴 Error',
                                };
                                const engineBadgeColor: Record<string, string> = {
                                  processing: 'text-green-600',
                                  idle: 'text-amber-500',
                                  retrying: 'text-orange-500',
                                  paused: 'text-red-600',
                                  cancelled: 'text-gray-500',
                                  importing: 'text-blue-500',
                                  completed: 'text-green-700',
                                  error: 'text-red-600',
                                };

                                const healthLabel = (v: string) => {
                                  const map: Record<string, string> = {
                                    healthy: '🟢 Healthy', connected: '🟢 Connected',
                                    running: '🟢 Running', saving: '🟢 Saving',
                                    active: '🟢 Active', ready: '🟢 Ready',
                                    degraded: '🟠 Degraded', disconnected: '🔴 Disconnected',
                                    offline: '🔴 Offline', quota_exhausted: '🔴 Quota',
                                    paused: '🔴 Paused', idle: '⚪ Idle', error: '🔴 Error',
                                    building: '🔵 Building', imported: '✅ Imported',
                                  };
                                  return map[v] || v;
                                };

                                const filteredLogs = (snap?.logs || []).filter(l => {
                                  if (logFilter === 'all') return true;
                                  if (logFilter === 'info') return ['INFO', 'SYSTEM', 'AI', 'OCR', 'SUCCESS'].includes(l.type);
                                  if (logFilter === 'warning') return l.type === 'WARNING';
                                  if (logFilter === 'error') return l.type === 'ERROR';
                                  return true;
                                });

                                const monRow = (label: string, value: React.ReactNode, valueClass = '') => (
                                  <div key={label} className="flex justify-between items-center py-0.5">
                                    <span style={{ color: 'var(--th-text4)' }}>{label}</span>
                                    <span className={`font-bold font-mono text-right max-w-[55%] truncate ${valueClass}`} style={{ color: 'var(--th-text)' }}>{value}</span>
                                  </div>
                                );

                                return (
                                  <div className="space-y-2.5 text-[9.5px]">

                                    {/* ── § 1: Engine Status Bar ── */}
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)' }}>
                                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text4)' }}>Engine Status</span>
                                      <span className={`text-[11px] font-extrabold ${engineBadgeColor[engineState] || 'text-gray-500'} ${engineState === 'processing' || engineState === 'retrying' ? 'animate-pulse' : ''}`}>
                                        {engineBadge[engineState] || '⚪ Idle'}
                                      </span>
                                    </div>

                                    {/* ── § 2: Live Processing Metrics ── */}
                                    <div className="p-2.5 rounded-xl border space-y-0.5" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)' }}>
                                      <p className="text-[9px] font-bold uppercase tracking-wider pb-1 border-b mb-1.5" style={{ color: 'var(--th-text4)', borderColor: 'var(--th-border2)' }}>Live Processing</p>
                                      {monRow('Current PDF', snap?.pdfName || (qs.state !== 'idle' ? 'Loading...' : 'None'))}
                                      {monRow('Current Page', `${snap?.currentPage ?? qs.processedPages} / ${snap?.totalPages ?? qs.totalPages}`)}
                                      {monRow('Current Chunk', `${(snap?.currentChunk ?? qs.currentChunkIndex) + 1} / ${snap?.totalChunks ?? qs.totalChunks}`)}
                                      {monRow('Pages Per Chunk', String(chunkSize))}
                                      {monRow('Queue Status', snap?.queueStatus ?? qs.state)}
                                      {monRow('Processing Speed', snap?.speedSecPerPage ? `${snap.speedSecPerPage.toFixed(2)} sec/page` : (qs.speed > 0 ? `${(60 / qs.speed).toFixed(1)} sec/page` : '—'))}
                                      {monRow('Avg Chunk Time', snap?.avgChunkTimeSec ? `${snap.avgChunkTimeSec.toFixed(1)} sec` : '—')}
                                      {monRow('Elapsed Time', fmtSec(snap?.elapsedSeconds ?? qs.elapsedTime))}
                                      {monRow('Estimated Remaining', fmtSec(snap?.etaSeconds ?? qs.eta))}
                                      {monRow('Memory Usage (Est.)', `~${snap?.estimatedMemoryMB ?? 0} MB`)}
                                      {snap?.sessionId && monRow('Session ID', snap.sessionId.substring(0, 20) + '...')}
                                      {snap?.userEmail && monRow('Current User', snap.userEmail)}
                                    </div>

                                    {/* ── § 3: Extraction Cache Status ── */}
                                    <div className="p-2.5 rounded-xl border space-y-0.5" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)' }}>
                                      <p className="text-[9px] font-bold uppercase tracking-wider pb-1 border-b mb-1.5" style={{ color: 'var(--th-text4)', borderColor: 'var(--th-border2)' }}>Extraction Cache Status</p>
                                      {monRow('Session Status', engineBadge[engineState] || '⚪ Idle')}
                                      {monRow('Completed Pages', String(snap?.completedPages ?? qs.processedPages))}
                                      {monRow('Remaining Pages', String(snap?.remainingPages ?? Math.max(0, qs.totalPages - qs.processedPages)))}
                                      {monRow('Last Database Save', fmtTime(snap?.lastDbSaveTime ?? 0))}
                                      {monRow('Last Cache Update', fmtTime(snap?.lastCacheUpdateTime ?? 0))}
                                      {monRow('Cache Size (Est.)', `~${snap?.cacheSizeKB ?? 0} KB`)}
                                      {monRow('Chunk Cache Records', String(snap?.chunkCacheCount ?? 0))}
                                      {monRow('Import Queue', String(snap?.importQueue ?? 0))}
                                      {monRow('Auto Save', snap?.autoSaveEnabled ? '✅ Every chunk' : '❌ Disabled')}
                                    </div>

                                    {/* ── § 4: Chunk Cache Monitor Table ── */}
                                    {(snap?.chunks?.length ?? 0) > 0 && (
                                      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--th-border2)' }}>
                                        <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ background: 'var(--th-surface2)' }}>
                                          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text4)' }}>Chunk Cache Monitor</p>
                                          <span className="text-[9px] font-mono" style={{ color: 'var(--th-text4)' }}>{snap?.chunks.filter(c => c.databaseSaved).length} / {snap?.chunks.length} saved</span>
                                        </div>
                                        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '180px' }}>
                                          <table className="w-full text-left border-collapse text-[8.5px]">
                                            <thead>
                                              <tr className="sticky top-0 font-bold border-b" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)', color: 'var(--th-text4)' }}>
                                                <th className="p-1 whitespace-nowrap">Chunk</th>
                                                <th className="p-1 whitespace-nowrap">Pages</th>
                                                <th className="p-1 whitespace-nowrap">Status</th>
                                                <th className="p-1 whitespace-nowrap">DB Saved</th>
                                                <th className="p-1 whitespace-nowrap">Import</th>
                                                <th className="p-1 whitespace-nowrap">Time</th>
                                                <th className="p-1 whitespace-nowrap">API Key</th>
                                                <th className="p-1 text-center">Retries</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {snap?.chunks.map(c => {
                                                const statusIcon: Record<string, string> = {
                                                  completed: '✅ Cached', processing: '🔄 Processing',
                                                  retrying: '🟠 Retrying', failed: '❌ Failed', pending: '⏳ Waiting'
                                                };
                                                const statusColor: Record<string, string> = {
                                                  completed: 'text-green-600', processing: 'text-blue-500 animate-pulse',
                                                  retrying: 'text-orange-500', failed: 'text-red-500', pending: 'text-gray-400'
                                                };
                                                return (
                                                  <tr key={c.chunkIndex} className="border-b" style={{ borderColor: 'var(--th-border2)', color: 'var(--th-text3)' }}>
                                                    <td className="p-1 font-semibold">#{c.chunkIndex + 1}</td>
                                                    <td className="p-1 font-mono whitespace-nowrap">{c.startPage}–{c.endPage}</td>
                                                    <td className={`p-1 whitespace-nowrap font-semibold ${statusColor[c.status] || ''}`}>{statusIcon[c.status] || c.status}</td>
                                                    <td className="p-1 text-center">{c.databaseSaved ? '✅' : '—'}</td>
                                                    <td className="p-1 whitespace-nowrap">{c.importStatus === 'imported' ? '✅ Imported' : c.importStatus === 'failed' ? '❌ Failed' : '⏳ Pending'}</td>
                                                    <td className="p-1 font-mono whitespace-nowrap">{c.processingTimeMs > 0 ? `${(c.processingTimeMs / 1000).toFixed(1)}s` : '—'}</td>
                                                    <td className="p-1 whitespace-nowrap">{c.apiKeyLabel || '—'}</td>
                                                    <td className="p-1 text-center font-mono">{c.retryCount}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {/* ── § 5: Database Activity ── */}
                                    <div className="p-2.5 rounded-xl border space-y-0.5" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)' }}>
                                      <p className="text-[9px] font-bold uppercase tracking-wider pb-1 border-b mb-1.5" style={{ color: 'var(--th-text4)', borderColor: 'var(--th-border2)' }}>Database Activity</p>
                                      {monRow('Production Records', String(snap?.dbActivity.productionRecords ?? qs.diaries.length))}
                                      {monRow('Cached Chunks', String(snap?.dbActivity.cachedChunks ?? 0))}
                                      {monRow('Imported Chunks', String(snap?.dbActivity.importedChunks ?? 0))}
                                      {monRow('Pending Imports', String(snap?.dbActivity.pendingImports ?? 0))}
                                      {monRow('Duplicate Skipped', String(snap?.dbActivity.duplicateSkipped ?? 0))}
                                      {monRow('Backup Records', String(snap?.dbActivity.backupRecords ?? 0))}
                                      {monRow('Database Writes', String(snap?.dbActivity.databaseWrites ?? 0))}
                                      {monRow('Database Failures', String(snap?.dbActivity.databaseFailures ?? 0), snap?.dbActivity.databaseFailures ? 'text-red-500' : '')}
                                      {monRow('Last Insert Time', fmtTime(snap?.dbActivity.lastInsertTime ?? 0))}
                                      {monRow('Last Update Time', fmtTime(snap?.dbActivity.lastUpdateTime ?? 0))}
                                    </div>

                                    {/* ── § 6: Gemini API Rotation ── */}
                                    {totalKeys > 0 && (
                                      <div className="p-2.5 rounded-xl border space-y-0.5" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)' }}>
                                        <p className="text-[9px] font-bold uppercase tracking-wider pb-1 border-b mb-1.5" style={{ color: 'var(--th-text4)', borderColor: 'var(--th-border2)' }}>Gemini API Rotation</p>
                                        {monRow('Rotation Mode', 'Automatic', 'text-green-600')}
                                        {monRow('Configured Keys', String(totalKeys))}
                                        {monRow('Healthy Keys', String(snap?.healthyKeys ?? keyStatuses.filter(k => k.status === 'healthy' || k.status === 'active').length), 'text-green-600')}
                                        {monRow('Waiting Keys', String(snap?.waitingKeys ?? keyStatuses.filter(k => k.status === 'waiting').length), 'text-amber-500')}
                                        {monRow('Exhausted Keys', String(snap?.exhaustedKeys ?? keyStatuses.filter(k => k.status === 'quota_exhausted' || k.status === 'auth_failed').length), 'text-red-500')}
                                        {monRow('Current Active Key', `Key #${(snap?.activeKeyIndex ?? activeIndex) + 1} of ${totalKeys}`)}
                                        {monRow('Current Model', snap?.currentModel ?? 'gemini-1.5-flash-latest')}
                                        {monRow('Current Page', String(snap?.currentPage ?? qs.processedPages))}
                                        {monRow('Last Key Switch', formatLastSwitch(lastSwitchTime))}
                                        {monRow('Processing Speed', qs.speed > 0 ? `${(60 / qs.speed).toFixed(1)} sec/request` : '—')}

                                        {/* Active Retry Monitor */}
                                        {activeStatus?.status === 'retrying' && (
                                          <div className="mt-1.5 p-2 rounded-xl border border-orange-200 space-y-0.5" style={{ background: 'rgba(251,146,60,0.07)' }}>
                                            <p className="text-[8.5px] font-bold text-orange-500 uppercase tracking-wider">Active Retry</p>
                                            {monRow('Retry', `${activeStatus.currentRetry} / ${activeStatus.maxRetry}`)}
                                            {monRow('Next Retry In', `${activeStatus.retryDelay}s`)}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* ── § 7: Per-Key Status Cards ── */}
                                    {totalKeys > 0 && (
                                      <div className="space-y-1.5">
                                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text4)' }}>API Key Status</p>
                                        <div className="space-y-1.5">
                                          {keyStatuses.map((kst, idx) => {
                                            const cardColor = kst.status === 'active' || kst.status === 'healthy' ? 'border-green-300 dark:border-green-900' :
                                              kst.status === 'quota_exhausted' || kst.status === 'auth_failed' ? 'border-red-300 dark:border-red-900' :
                                              kst.status === 'retrying' ? 'border-orange-300' : 'border-gray-200 dark:border-gray-700';
                                            const statusLabel = kst.status === 'active' ? '🟢 Active' :
                                              kst.status === 'healthy' ? '🟢 Healthy' :
                                              kst.status === 'quota_exhausted' ? '🔴 Quota Exhausted' :
                                              kst.status === 'auth_failed' ? '🔴 Auth Failed' :
                                              kst.status === 'retrying' ? '🟠 Retrying' :
                                              kst.status === 'waiting' ? '🟡 Waiting' : '⚪ Unused';
                                            const statusTextColor = kst.status === 'active' || kst.status === 'healthy' ? 'text-green-600' :
                                              kst.status === 'quota_exhausted' || kst.status === 'auth_failed' ? 'text-red-500' :
                                              kst.status === 'retrying' ? 'text-orange-500' :
                                              kst.status === 'waiting' ? 'text-amber-500' : 'text-gray-400';
                                            return (
                                              <div key={idx} className={`p-2 rounded-xl border ${cardColor} space-y-0.5`} style={{ background: 'var(--th-surface2)' }}>
                                                <div className="flex justify-between items-center">
                                                  <span className="font-bold text-[9.5px]" style={{ color: 'var(--th-text)' }}>Key #{idx + 1}</span>
                                                  <span className={`font-bold text-[9.5px] ${statusTextColor}`}>{statusLabel}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5">
                                                  <div className="flex justify-between"><span style={{ color: 'var(--th-text4)' }}>Requests</span><span className="font-mono font-bold" style={{ color: 'var(--th-text)' }}>{kst.requestsProcessed}</span></div>
                                                  <div className="flex justify-between"><span style={{ color: 'var(--th-text4)' }}>Retries</span><span className="font-mono font-bold" style={{ color: 'var(--th-text)' }}>{kst.retries}</span></div>
                                                  <div className="flex justify-between col-span-2"><span style={{ color: 'var(--th-text4)' }}>Last Used</span><span className="font-mono font-bold" style={{ color: 'var(--th-text)' }}>{kst.lastUsed > 0 ? new Date(kst.lastUsed).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span></div>
                                                  {kst.reason && <div className="flex justify-between col-span-2"><span style={{ color: 'var(--th-text4)' }}>Last Error</span><span className="font-semibold text-red-500 truncate max-w-[70%]">{kst.reason}</span></div>}
                                                  {kst.processing && <div className="flex justify-between col-span-2"><span style={{ color: 'var(--th-text4)' }}>Current Page</span><span className="font-mono font-bold" style={{ color: 'var(--th-text)' }}>{kst.processing}</span></div>}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* ── § 8: Live Terminal Log ── */}
                                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--th-border2)' }}>
                                      <div className="px-2.5 py-1.5 flex items-center justify-between flex-wrap gap-1" style={{ background: 'var(--th-surface2)' }}>
                                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text4)' }}>Live Terminal Log</p>
                                        <div className="flex gap-1">
                                          {(['all', 'info', 'warning', 'error'] as const).map(f => (
                                            <button
                                              key={f}
                                              onClick={() => setLogFilter(f)}
                                              className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase transition-colors ${logFilter === f ? 'text-white' : ''}`}
                                              style={logFilter === f ? { background: 'var(--th-primary)', color: '#fff' } : { background: 'var(--th-border2)', color: 'var(--th-text4)' }}
                                            >{f}</button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="overflow-y-auto font-mono" style={{ maxHeight: '220px', background: 'var(--th-surface)' }}>
                                        {filteredLogs.length === 0 ? (
                                          <p className="p-2.5 text-center italic text-[8.5px]" style={{ color: 'var(--th-text4)' }}>No log entries yet. Start extraction to see live logs.</p>
                                        ) : (
                                          filteredLogs.slice(-200).map((l, i) => {
                                            const lc = { ERROR: 'text-red-500', WARNING: 'text-amber-500', SUCCESS: 'text-green-600', SYSTEM: 'text-blue-500', AI: 'text-purple-500', OCR: 'text-cyan-500', INFO: 'text-gray-400' }[l.type] || 'text-gray-400';
                                            return (
                                              <div key={i} className={`flex gap-1.5 px-2 py-0.5 border-b text-[8.5px] leading-4 ${lc}`} style={{ borderColor: 'var(--th-border2)' }}>
                                                <span className="shrink-0 opacity-60">{new Date(l.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
                                                <span className="shrink-0 font-bold w-[42px]">[{l.type.substring(0, 4)}]</span>
                                                <span className="break-all">{l.message}</span>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>

                                    {/* ── § 9: Resume Information ── */}
                                    {(snap?.resumeAvailable || isAllExhausted || qs.state === 'paused' || qs.state === 'error') && (
                                      <div className="p-2.5 rounded-xl border space-y-0.5 border-amber-300 dark:border-amber-800" style={{ background: 'rgba(245,158,11,0.07)' }}>
                                        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider pb-1 border-b border-amber-200 mb-1.5">Resume Information</p>
                                        {monRow('Resume Available', 'YES', 'text-green-600')}
                                        {monRow('Resume From Page', String((snap?.resumeFromPage ?? qs.processedPages + 1)))}
                                        {monRow('Resume From Chunk', String(snap?.resumeFromChunk ?? qs.currentChunkIndex))}
                                        {monRow('Cached Chunks', String(snap?.cachedChunksCount ?? 0))}
                                        {monRow('Remaining Chunks', String(snap?.remainingChunks ?? Math.max(0, qs.totalChunks - qs.currentChunkIndex)))}
                                        {monRow('Reason', snap?.pauseReason || (isAllExhausted ? 'Quota Exceeded' : qs.error || 'Manual Pause'), 'text-red-500')}
                                      </div>
                                    )}

                                    {/* ── § 10: Import Progress ── */}
                                    {(snap?.importStats.cachedChunks ?? 0) > 0 && (
                                      <div className="p-2.5 rounded-xl border space-y-0.5" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)' }}>
                                        <p className="text-[9px] font-bold uppercase tracking-wider pb-1 border-b mb-1.5" style={{ color: 'var(--th-text4)', borderColor: 'var(--th-border2)' }}>Import Progress</p>
                                        {monRow('Cached Chunks', String(snap?.importStats.cachedChunks ?? 0))}
                                        {monRow('Imported Chunks', String(snap?.importStats.importedChunks ?? 0))}
                                        {monRow('Pending Imports', String(snap?.importStats.pendingImports ?? 0))}
                                        {monRow('Failed Imports', String(snap?.importStats.failedImports ?? 0), snap?.importStats.failedImports ? 'text-red-500' : '')}
                                        {monRow('Duplicate Records Skipped', String(snap?.importStats.duplicateSkipped ?? 0))}
                                        {monRow('Updated Existing', String(snap?.importStats.updatedExisting ?? 0))}
                                        {monRow('Backup Records Created', String(snap?.importStats.backupCreated ?? 0))}
                                        {monRow('Import Speed', snap?.importStats.speedRecordsPerSec ? `${snap.importStats.speedRecordsPerSec} records/sec` : '—')}
                                      </div>
                                    )}

                                    {/* ── § 11: Health Indicators ── */}
                                    <div className="p-2.5 rounded-xl border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border2)' }}>
                                      <p className="text-[9px] font-bold uppercase tracking-wider pb-1.5 border-b mb-2" style={{ color: 'var(--th-text4)', borderColor: 'var(--th-border2)' }}>Health Indicators</p>
                                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                        {[
                                          ['Extraction Engine', snap?.health.extractionEngine ?? (qs.state === 'processing' ? 'healthy' : 'offline')],
                                          ['Database Connection', snap?.health.databaseConnection ?? 'connected'],
                                          ['Supabase', snap?.health.supabase ?? 'healthy'],
                                          ['Gemini API', snap?.health.geminiApi ?? (isAllExhausted ? 'quota_exhausted' : 'connected')],
                                          ['Queue', snap?.health.queue ?? qs.state],
                                          ['Cache', snap?.health.cache ?? 'idle'],
                                          ['Import Engine', snap?.health.importEngine ?? 'idle'],
                                          ['Search Index', snap?.health.searchIndex ?? 'ready'],
                                        ].map(([label, val]) => (
                                          <div key={label as string} className="flex justify-between items-center gap-1">
                                            <span className="truncate" style={{ color: 'var(--th-text4)' }}>{label}</span>
                                            <span className="font-bold shrink-0 text-right">{healthLabel(val as string)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* ── API Rotation History (preserved) ── */}
                                    {rotHistory.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text4)' }}>API Rotation History</p>
                                        <div className="overflow-x-auto border rounded-xl max-h-[110px] overflow-y-auto" style={{ borderColor: 'var(--th-border2)' }}>
                                          <table className="w-full text-left border-collapse text-[9px]">
                                            <thead>
                                              <tr className="bg-slate-50 dark:bg-slate-900 border-b font-bold sticky top-0" style={{ borderColor: 'var(--th-border2)', color: 'var(--th-text4)' }}>
                                                <th className="p-1 bg-slate-50 dark:bg-slate-900">Time</th>
                                                <th className="p-1 bg-slate-50 dark:bg-slate-900">Key</th>
                                                <th className="p-1 bg-slate-50 dark:bg-slate-900">Reason</th>
                                                <th className="p-1 bg-slate-50 dark:bg-slate-900">Page</th>
                                                <th className="p-1 bg-slate-50 dark:bg-slate-900 text-center">Retries</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {rotHistory.map((event, idx) => (
                                                <tr key={idx} className="border-b" style={{ borderColor: 'var(--th-border2)', color: 'var(--th-text3)' }}>
                                                  <td className="p-1 font-mono whitespace-nowrap">{event.time}</td>
                                                  <td className="p-1 font-semibold whitespace-nowrap">{event.keyNumber}</td>
                                                  <td className="p-1 text-red-500 font-semibold">{event.reason}</td>
                                                  <td className="p-1 font-mono whitespace-nowrap">{event.page}</td>
                                                  <td className="p-1 font-mono text-center">{event.retries}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                  </div>
                                );
                              })()}
                            </div>
                          )}
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
                      <div className="mt-4 border text-xs rounded-xl overflow-hidden" style={{ borderColor: 'var(--th-error-border)' }}>
                        <div className="p-3 flex gap-2.5" style={{ background: 'var(--th-error-bg)', color: 'var(--th-error)' }}>
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="flex-1">{conversionError}</span>
                        </div>
                        {/* Retry button — shown when there's a resumable queue */}
                        {currentExtractionQueue && !isExtracting && (
                          <div className="px-3 py-2.5 flex items-center justify-between gap-3" style={{ background: 'var(--th-surface2)', borderTop: '1px solid var(--th-error-border)' }}>
                            <div className="flex items-center gap-1.5">
                              {!isOnline ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block"></span>
                                  <span className="text-[10px] font-semibold" style={{ color: 'var(--th-text3)' }}>Waiting for network...</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                                  <span className="text-[10px] font-semibold text-green-700">Network restored — ready to retry</span>
                                </>
                              )}
                            </div>
                            <button
                              onClick={handleResume}
                              disabled={!isOnline}
                              className="flex items-center gap-1.5 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                              style={{ background: isOnline ? 'var(--th-primary)' : 'var(--th-text4)' }}
                            >
                              <RefreshCw className={`w-3 h-3 ${isOnline ? '' : 'animate-spin'}`} />
                              {isOnline ? `Retry from Batch ${(currentExtractionQueue.nextIndex ?? 0) + 1}` : 'Waiting...'}
                            </button>
                          </div>
                        )}
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
                        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1" style={{ maxHeight: 'min(300px, calc(100dvh - 280px))' }}>
                          {diaries
                            .filter(diary => {
                              const raw = searchQuery.trim();
                              if (!raw) return true;
                              const keywords = raw.toLowerCase().split(/\s+/).filter(Boolean);
                              const haystack = [
                                diary.policeStation,
                                diary.crNoAndSecOfLaw,
                                diary.courtNameAndPlace,
                                diary.attendedBy,
                                diary.complainant,
                                diary.stageOfTheCase,
                                diary.remarks,
                                diary.dateOfCd,
                                diary.courtRefNo,
                                diary.district,
                                diary.dateOfReportTime,
                                (diary.accusedList || []).map((a: any) => a.nameAndAddress).join(' ')
                              ].join(' ').toLowerCase();
                              return keywords.every(kw => haystack.includes(kw));
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
                            const raw = searchQuery.trim();
                            if (!raw) return true;
                            const keywords = raw.toLowerCase().split(/\s+/).filter(Boolean);
                            const haystack = [
                              diary.policeStation,
                              diary.crNoAndSecOfLaw,
                              diary.courtNameAndPlace,
                              diary.attendedBy,
                              diary.complainant,
                              diary.stageOfTheCase,
                              diary.remarks,
                              diary.dateOfCd,
                              diary.courtRefNo,
                              diary.district,
                              diary.dateOfReportTime,
                              (diary.accusedList || []).map((a: any) => a.nameAndAddress).join(' ')
                            ].join(' ').toLowerCase();
                            return keywords.every(kw => haystack.includes(kw));
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
                          <div className="backdrop-blur-md border rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col min-h-0 lg:min-h-[600px]" style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}>
                            {/* Mobile: Back to Case List */}
                            <button
                              className="lg:hidden mb-3 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                              style={{ color: 'var(--th-primary)' }}
                              onClick={() => setShowMobileEditor(false)}
                            >
                              <ArrowLeft className="w-4 h-4" />
                              ← Back to Case List
                            </button>

                            {/* Database Save Status Feedback Notification - desktop only */}
                            {saveDbStatus.message && (
                              <div className={`hidden lg:flex mb-4 p-4 border rounded-2xl items-center gap-2.5 text-xs font-semibold shadow-xs ${
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

                            {/* Workspace Header Actions - desktop only */}
                            <div className="hidden lg:flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--th-border)' }}>
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
                            <div className="space-y-6 lg:mt-6 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100dvh - 180px)' }}>
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

              {activeTab === 'dashboard' && roleInfo.level === 'admin' && (
                <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row gap-6 items-start">
                  {/* Admin Sidebar Navigation */}
                  <div className="w-full md:w-60 shrink-0 flex flex-col gap-4">
                    <div className="bg-white/80 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-150 dark:border-slate-800">
                        <Shield className="w-5 h-5 text-indigo-650" />
                        <span className="font-display font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--th-text)' }}>Admin Control</span>
                      </div>
                      <nav className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                        {([
                          { id: 'dashboard', name: 'Dashboard', icon: <Activity className="w-4 h-4" /> },
                          { id: 'users', name: 'User Management', icon: <Lock className="w-4 h-4" /> },
                          { id: 'pdf', name: 'PDF Processing', icon: <Cpu className="w-4 h-4" /> },
                          { id: 'logs', name: 'Logs', icon: <Terminal className="w-4 h-4" /> },
                          { id: 'settings', name: 'Settings', icon: <Settings className="w-4 h-4" /> },
                          { id: 'health', name: 'Data Health Check', icon: <HeartPulse className="w-4 h-4" />, badge: 'NEW' }
                        ] as { id: 'dashboard' | 'users' | 'pdf' | 'logs' | 'settings' | 'health'; name: string; icon: React.ReactNode; badge?: string }[]).map((sub) => {
                          const isActive = adminSubTab === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                setAdminSubTab(sub.id);
                                if (sub.id === 'health') loadBackupsAndLogs();
                              }}
                              className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap w-full text-left"
                              style={isActive ? {
                                background: 'var(--th-primary-xlight)',
                                color: 'var(--th-primary)'
                              } : {
                                color: 'var(--th-text3)'
                              }}
                            >
                              {sub.icon}
                              <span>{sub.name}</span>
                              {sub.badge && (
                                <span className="ml-auto bg-indigo-600 text-white text-[8px] px-1 py-0.5 rounded-md font-extrabold uppercase">
                                  {sub.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                  </div>

                  {/* Admin Sub-Tab Contents */}
                  <div className="flex-1 w-full flex flex-col gap-6">
                    {adminSubTab === 'dashboard' && (
                      <div className="bg-white/80 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-150 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-slate-800 text-indigo-650 rounded-xl animate-pulse">
                              <Shield className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-display font-bold text-base" style={{ color: 'var(--th-text)' }}>Admin Dashboard</h3>
                              <p className="text-xs font-medium" style={{ color: 'var(--th-text3)' }}>System stats, user details, and active cloud databases</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                          {/* Profile Card */}
                          <div className="bg-gray-50/50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 p-5 rounded-2xl flex items-center gap-4">
                            {user?.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-16 h-16 rounded-full border border-gray-200 dark:border-slate-800" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-650 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                                {user?.displayName?.charAt(0) || 'U'}
                              </div>
                            )}
                            <div>
                              <h4 className="text-sm font-bold" style={{ color: 'var(--th-text)' }}>{user?.displayName || 'Admin'}</h4>
                              <p className="text-xs text-indigo-650 font-bold mt-0.5">{roleInfo.name}</p>
                              <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--th-text4)' }}>{user?.email}</p>
                            </div>
                          </div>

                          {/* Stats Card */}
                          <div className="bg-gray-50/50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 p-5 rounded-2xl grid grid-cols-2 gap-4">
                            <div className="text-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-200/50 dark:border-slate-800 shadow-sm">
                              <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Stored DBs</p>
                              <p className="text-2xl font-display font-bold mt-1" style={{ color: 'var(--th-text)' }}>{savedDatabases.length}</p>
                            </div>
                            <div className="text-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-200/50 dark:border-slate-800 shadow-sm">
                              <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Loaded cases</p>
                              <p className="text-2xl font-display font-bold mt-1" style={{ color: 'var(--th-primary)' }}>{diaries.length}</p>
                            </div>
                          </div>
                        </div>

                        {/* System Health / Cloud DB section */}
                        <div className="mt-6 p-5 border rounded-2xl" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
                              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--th-text2)' }}>Cloud Sync Telemetry</h4>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                              supabaseStatus?.isConfigured 
                                ? 'bg-green-500/10 text-green-700 border-green-500/30'
                                : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${supabaseStatus?.isConfigured ? 'bg-green-500 animate-pulse' : 'bg-amber-50'}`} />
                              {supabaseStatus?.isConfigured ? 'CONNECTED' : 'DISCONNECTED'}
                            </span>
                          </div>

                          <div className="space-y-2.5 text-xs font-medium" style={{ color: 'var(--th-text3)' }}>
                            <div className="flex justify-between py-1.5 border-b border-gray-200/40">
                              <span>Database Client</span>
                              <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--th-text)' }}>Supabase JS client v2</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-gray-200/40">
                              <span>Connection Endpoint</span>
                              <span className="font-mono text-[10px]" style={{ color: 'var(--th-text4)' }}>{supabaseStatus?.supabaseUrl ? `${supabaseStatus.supabaseUrl}` : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-gray-200/40">
                              <span>Database Tables Verified</span>
                              <span className={`font-bold ${supabaseStatus?.tableExists ? 'text-green-600' : 'text-amber-600'}`}>
                                {supabaseStatus?.tableExists ? 'Verified (case_databases active)' : 'Unverified'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {adminSubTab === 'users' && (
                      <div className="bg-white/80 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm w-full">
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
                        <div className="grid grid-cols-1 gap-4 p-4 rounded-xl mb-5 border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text3)' }}>
                                User Emails <span className="normal-case font-normal">(comma-separated for multiple)</span>
                              </label>
                              <textarea
                                rows={2}
                                placeholder="e.g. user1@gmail.com, user2@gmail.com"
                                value={adminGrantEmails}
                                onChange={(e) => setAdminGrantEmails(e.target.value)}
                                className="w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none transition-all resize-none shadow-xs"
                                style={{ background: 'var(--th-input-bg)', borderColor: 'var(--th-input-border)', color: 'var(--th-text)' }}
                              />
                            </div>
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

                        {/* Current Access list */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--th-text3)' }}>Current Access — Grouped by Database</p>
                          {savedDatabases.length === 0 ? (
                            <p className="text-xs italic text-center py-4" style={{ color: 'var(--th-text4)' }}>No databases found.</p>
                          ) : (
                            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                              {savedDatabases.map((db) => {
                                const usersWithAccess = (Object.entries(adminAccessMap) as [string, string[]][]).filter(
                                  ([, dbIds]) => dbIds.includes(db.id)
                                ).map(([email]) => email);
                                return (
                                  <div key={db.id} className="p-4 rounded-xl border" style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)' }}>
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
                                          <span key={email} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border" style={{ background: 'var(--th-primary-xlight)', borderColor: 'var(--th-border)', color: 'var(--th-text2)' }}>
                                            {email}
                                            <button onClick={() => handleUpdateAccess(email, db.id, 'revoke')} className="text-red-400 hover:text-red-600 font-bold ml-0.5 cursor-pointer" title={`Revoke ${email}'s access`}>✕</button>
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

                    {adminSubTab === 'pdf' && (
                      <div className="bg-white/80 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm w-full">
                        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100 dark:border-slate-800">
                          <Cpu className="w-5 h-5 text-indigo-650" />
                          <div>
                            <h4 className="text-sm font-bold" style={{ color: 'var(--th-text)' }}>PDF Queue Processing Engine</h4>
                            <p className="text-[10px] font-medium" style={{ color: 'var(--th-text3)' }}>Telemetries and chunk batch execution states</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl border space-y-2 text-xs" style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)' }}>
                            <p className="font-bold uppercase text-[9px]" style={{ color: 'var(--th-text4)' }}>Active Key Rotation Status</p>
                            <div className="flex justify-between">
                              <span>Active Key Index:</span>
                              <span className="font-bold">Key #{activeIndex + 1} of {totalKeys || 1}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Rotation Mode:</span>
                              <span className="text-green-600 font-bold">AUTOMATIC</span>
                            </div>
                          </div>

                          <div className="p-4 rounded-xl border space-y-2 text-xs" style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)' }}>
                            <p className="font-bold uppercase text-[9px]" style={{ color: 'var(--th-text4)' }}>Batching Parameters</p>
                            <div className="flex justify-between">
                              <span>Concurrency Limit:</span>
                              <span className="font-bold">{concurrencyLimit} request(s)</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Chunk Sizing:</span>
                              <span className="font-bold">{chunkSize} pages per batch</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {adminSubTab === 'logs' && (
                      <div className="bg-white/80 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm w-full">
                        <div className="flex items-center gap-2 mb-4">
                          <Terminal className="w-5 h-5 text-indigo-650" />
                          <div>
                            <h4 className="text-sm font-bold" style={{ color: 'var(--th-text)' }}>Admin Console Logger</h4>
                            <p className="text-[10px] font-medium" style={{ color: 'var(--th-text3)' }}>Real-time logs collected from reconstruction pipeline</p>
                          </div>
                        </div>

                        <div className="w-full bg-slate-950 rounded-2xl p-4 text-[10px] font-mono text-gray-200 border border-slate-900 h-[360px] overflow-y-auto space-y-1 select-text">
                          {extractionLogs.length === 0 ? (
                            <p className="text-slate-500 italic">No logs recorded yet. Start a reconstruction queue to stream console lines.</p>
                          ) : (
                            extractionLogs.map((log, idx) => (
                              <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                                {log}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {adminSubTab === 'settings' && (
                      <div className="bg-white/80 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm w-full">
                        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-150 dark:border-slate-800">
                          <Settings className="w-5 h-5 text-indigo-650" />
                          <div>
                            <h4 className="text-sm font-bold" style={{ color: 'var(--th-text)' }}>Admin Global Settings</h4>
                            <p className="text-[10px] font-medium" style={{ color: 'var(--th-text3)' }}>Re-initialize services and run diagnostics manually</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)' }}>
                            <div>
                              <p className="text-xs font-bold" style={{ color: 'var(--th-text)' }}>Reset Key Rotation Stats</p>
                              <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--th-text3)' }}>Clears active rotation histories and sets current index back to Key #1.</p>
                            </div>
                            <button
                              onClick={() => {
                                ApiKeyManager.resetStatus();
                                alert('Rotation histories reset!');
                              }}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0"
                            >
                              Reset Engine
                            </button>
                          </div>

                          <div className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)' }}>
                            <div>
                              <p className="text-xs font-bold" style={{ color: 'var(--th-text)' }}>Clear Local Telemetry Backup</p>
                              <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--th-text3)' }}>Forces reload of verification states and empties browser caches.</p>
                            </div>
                            <button
                              onClick={() => {
                                window.localStorage.clear();
                                alert('Local telemetry cache cleared. Reload page.');
                              }}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-750 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0"
                            >
                              Clear Cache
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {adminSubTab === 'health' && (
                      <div className="bg-white/80 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm w-full flex flex-col gap-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-150 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-xl">
                              <HeartPulse className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                              <h3 className="font-display font-bold text-base" style={{ color: 'var(--th-text)' }}>Data Health Check</h3>
                              <p className="text-xs font-medium" style={{ color: 'var(--th-text3)' }}>Scan and clear redundant case diary records while preserving originals</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Sub-tab toggle */}
                            <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                              <button
                                onClick={() => setHealthSubTab('scanner')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${healthSubTab === 'scanner' ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                              >
                                🔍 Scanner
                              </button>
                              <button
                                onClick={() => { setHealthSubTab('backup_manager'); loadBackupManagerRecords(1); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${healthSubTab === 'backup_manager' ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                              >
                                🛡️ Backup Manager
                              </button>
                            </div>
                            {healthSubTab === 'scanner' && !isScanning && (
                              <button
                                onClick={runHealthScan}
                                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-750 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Scan Database
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Scanner Loading State */}
                        {healthSubTab === 'scanner' && isScanning && (
                          <div className="p-6 rounded-2xl border bg-gray-50/50 dark:bg-slate-900/40 border-gray-150 dark:border-slate-800 flex flex-col items-center justify-center gap-4 text-center">
                            <RefreshCw className="w-8 h-8 text-rose-600 animate-spin" />
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold" style={{ color: 'var(--th-text)' }}>Scanning Database...</h4>
                              <p className="text-xs" style={{ color: 'var(--th-text4)' }}>Estimating duplicate groups in case registers</p>
                            </div>
                            {/* Custom progress indicators */}
                            <div className="w-full max-w-xs space-y-2 mt-2">
                              <div className="w-full bg-gray-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-rose-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                              </div>
                              <div className="flex justify-between text-[10px] font-bold" style={{ color: 'var(--th-text4)' }}>
                                <span>{scanProgress}% Completed</span>
                                <span>{scannedCount.toLocaleString()} / {totalToScan.toLocaleString()} Scanned</span>
                              </div>
                              <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase">
                                <span>Duplicate Groups: {duplicateGroups.length}</span>
                                <span>ETA: {estTimeSecs}s</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Scanner Unscanned State */}
                        {healthSubTab === 'scanner' && healthStats.totalRecords === 0 && !isScanning && (
                          <div className="p-12 text-center border rounded-3xl" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                            <HeartPulse className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-pulse" />
                            <h4 className="font-display font-bold text-sm" style={{ color: 'var(--th-text)' }}>Database Health Diagnostics</h4>
                            <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto">
                              Run a database scan to find duplicate entries, calculate health scores, and create duplicate safety backups.
                            </p>
                            <button
                              onClick={runHealthScan}
                              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Start Health Scan
                            </button>
                          </div>
                        )}

                        {/* Scan Results Dashboard */}
                        {healthSubTab === 'scanner' && healthStats.totalRecords > 0 && !isScanning && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div className="p-3.5 bg-white dark:bg-slate-900 border border-gray-250/40 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Total Records</p>
                                <p className="text-xl font-display font-bold mt-0.5" style={{ color: 'var(--th-text)' }}>{healthStats.totalRecords}</p>
                              </div>
                              <div className="p-3.5 bg-white dark:bg-slate-900 border border-gray-250/40 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Duplicate Groups</p>
                                <p className="text-xl font-display font-bold text-amber-600 mt-0.5">{healthStats.duplicateGroupsCount}</p>
                              </div>
                              <div className="p-3.5 bg-white dark:bg-slate-900 border border-gray-250/40 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Records to Keep</p>
                                <p className="text-xl font-display font-bold text-green-600 mt-0.5">{healthStats.totalRecords - healthStats.totalDuplicatesCount}</p>
                              </div>
                              <div className="p-3.5 bg-white dark:bg-slate-900 border border-gray-250/40 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Records to Delete</p>
                                <p className="text-xl font-display font-bold text-rose-600 mt-0.5">{healthStats.totalDuplicatesCount}</p>
                              </div>
                            </div>

                            <div className="p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-4 gap-4" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                              <div className="text-center sm:text-left border-b sm:border-b-0 sm:border-r border-gray-200/50 dark:border-slate-800 pb-3 sm:pb-0 sm:pr-4">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Health Score</p>
                                <p className={`text-2xl font-display font-bold mt-1 ${healthStats.score >= 90 ? 'text-green-600' : healthStats.score >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                                  {healthStats.score}%
                                </p>
                              </div>
                              <div className="text-center sm:text-left border-b sm:border-b-0 sm:border-r border-gray-200/50 dark:border-slate-800 pb-3 sm:pb-0 sm:px-4">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Latest CD Date Preserved</p>
                                <p className="text-xs font-mono font-bold mt-2.5 text-green-600">{healthStats.latestPreservedDate}</p>
                              </div>
                              <div className="text-center sm:text-left border-b sm:border-b-0 sm:border-r border-gray-200/50 dark:border-slate-800 pb-3 sm:pb-0 sm:px-4">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Cleanup Status</p>
                                <p className={`text-xs font-bold mt-2.5 ${healthStats.duplicateGroupsCount === 0 ? 'text-green-600' : 'text-amber-600'}`}>{healthStats.cleanupStatus}</p>
                              </div>
                              <div className="text-center sm:text-left sm:pl-4 space-y-1.5">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Scan Duration</span>
                                  <span className="text-xs font-bold" style={{ color: 'var(--th-text)' }}>{healthStats.scanTimeMs} ms</span>
                                  <span className="text-[8px] font-bold text-gray-500">{healthStats.lastScanDate}</span>
                                </div>
                                <div className="flex flex-col pt-0.5 border-t border-gray-200/40 dark:border-slate-850">
                                  <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Removed Duplicates</span>
                                  <span className="text-xs font-bold text-indigo-650">{healthStats.removedCount} entries</span>
                                </div>
                              </div>
                            </div>

                            {/* Search and Filters */}
                            <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 relative">
                                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                  <input
                                    type="text"
                                    placeholder="Search by Police Station, Crime Number, ID..."
                                    value={healthSearch}
                                    onChange={(e) => setHealthSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs focus:outline-none"
                                    style={{
                                      background: 'var(--th-input-bg)',
                                      borderColor: 'var(--th-input-border)',
                                      color: 'var(--th-text)'
                                    }}
                                  />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={healthStation}
                                    onChange={(e) => setHealthStation(e.target.value)}
                                    className="p-2 border rounded-xl text-xs bg-white dark:bg-slate-950 font-medium"
                                  >
                                    <option value="all">All Stations</option>
                                    {Array.from(new Set(duplicateGroups.map(g => g.policeStation))).map((st: any) => (
                                      <option key={st} value={String(st).toLowerCase()}>{st}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={healthYear}
                                    onChange={(e) => setHealthYear(e.target.value)}
                                    className="p-2 border rounded-xl text-xs bg-white dark:bg-slate-950 font-medium"
                                  >
                                    <option value="all">All Years</option>
                                    {Array.from(new Set(duplicateGroups.map(g => {
                                      const parts = g.crimeNumber.split('/');
                                      return parts[1] || '';
                                    }).filter(Boolean))).map(yr => (
                                      <option key={yr} value={yr}>{yr}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Duplicate Groups List */}
                            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: 'var(--th-border)', background: 'var(--th-surface)' }}>
                              <div className="p-3 border-b flex justify-between items-center text-xs" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                                <span className="font-bold">Duplicate Records Scanner</span>
                                {filteredGroups.length > 0 && (
                                  <button
                                    onClick={handleBulkRemoveAll}
                                    className="p-1 px-3 bg-rose-600 hover:bg-rose-750 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                                  >
                                    Clear All Duplicates
                                  </button>
                                )}
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                                      <th className="p-3 font-bold text-[9px] uppercase">Police Station</th>
                                      <th className="p-3 font-bold text-[9px] uppercase">Crime Number</th>
                                      <th className="p-3 font-bold text-[9px] uppercase">Duplicates Count</th>
                                      <th className="p-3 font-bold text-[9px] uppercase">Created (Oldest)</th>
                                      <th className="p-3 font-bold text-[9px] uppercase">Last Updated</th>
                                      <th className="p-3 font-bold text-[9px] uppercase text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredGroups.length === 0 ? (
                                      <tr>
                                        <td colSpan={6} className="p-8 text-center text-xs italic text-gray-400">
                                          No duplicate records detected. Your databases are healthy!
                                        </td>
                                      </tr>
                                    ) : (
                                      filteredGroups.map((g) => {
                                        const isExpanded = expandedGroupKeys.has(g.id);
                                        return (
                                          <React.Fragment key={g.id}>
                                            <tr className="border-b hover:bg-slate-50/40 dark:hover:bg-slate-900/40" style={{ borderColor: 'var(--th-border)' }}>
                                              <td className="p-3 font-semibold">{g.policeStation}</td>
                                              <td className="p-3 font-bold text-gray-750 dark:text-gray-250">{g.crimeNumber}</td>
                                              <td className="p-3 font-mono">{g.totalCount} records ({g.duplicates.length} to delete)</td>
                                              <td className="p-3 text-gray-400 font-mono">{g.createdDate}</td>
                                              <td className="p-3 font-medium text-emerald-600 font-mono">{g.lastUpdated}</td>
                                              <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                                                <button
                                                  onClick={() => {
                                                    const nextKeys = new Set(expandedGroupKeys);
                                                    if (isExpanded) nextKeys.delete(g.id);
                                                    else nextKeys.add(g.id);
                                                    setExpandedGroupKeys(nextKeys);
                                                  }}
                                                  className="p-1 px-2 border hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-bold text-[10px] cursor-pointer"
                                                >
                                                  {isExpanded ? 'Hide' : 'Details'}
                                                </button>
                                                <button
                                                  onClick={() => setSelectedGroupForCompare(g)}
                                                  className="p-1 px-2 border hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-bold text-[10px] cursor-pointer"
                                                >
                                                  Compare
                                                </button>
                                                <button
                                                  onClick={() => handleRemoveGroupDuplicates(g)}
                                                  className="p-1 px-2 bg-rose-600 hover:bg-rose-750 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                                                >
                                                  Clean
                                                </button>
                                              </td>
                                            </tr>

                                            {/* Expandable Case Details Subtable */}
                                            {isExpanded && (
                                              <tr>
                                                <td colSpan={6} className="bg-gray-50/40 dark:bg-slate-900/10 p-4 border-b border-gray-200/50">
                                                  <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--th-border)' }}>
                                                    <table className="w-full text-[11px] text-left border-collapse bg-white dark:bg-slate-900">
                                                      <thead>
                                                        <tr style={{ background: 'var(--th-surface2)', borderBottom: '1px solid var(--th-border)' }}>
                                                          <th className="p-2.5 font-bold text-[9px] uppercase">Record ID</th>
                                                          <th className="p-2.5 font-bold text-[9px] uppercase">Date of CD</th>
                                                          <th className="p-2.5 font-bold text-[9px] uppercase">Investigating Officer</th>
                                                          <th className="p-2.5 font-bold text-[9px] uppercase">Court Name</th>
                                                          <th className="p-2.5 font-bold text-[9px] uppercase">Status</th>
                                                          <th className="p-2.5 font-bold text-[9px] uppercase">Role Badge</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {[g.originalRecord, ...g.duplicates].map((rec, idx) => (
                                                          <tr key={rec.id} className="border-b border-gray-100 last:border-0">
                                                            <td className="p-2.5 font-mono text-[9.5px] truncate max-w-[120px]" title={rec.id}>
                                                              {rec.id} {idx === 0 && <span className="ml-1 px-1 bg-green-100 text-green-700 font-bold rounded text-[8px]">ORIGINAL (NEWEST)</span>}
                                                            </td>
                                                            <td className="p-2.5">{rec.dateOfCd}</td>
                                                            <td className="p-2.5 font-semibold">{rec.attendedBy || 'N/A'}</td>
                                                            <td className="p-2.5 text-gray-500">{rec.courtNameAndPlace || 'N/A'}</td>
                                                            <td className="p-2.5 font-bold text-indigo-650">{rec.stageOfTheCase}</td>
                                                            <td className="p-2.5">
                                                              <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold uppercase">
                                                                {rec.dbId ? 'Cloud Persisted' : 'Local'}
                                                              </span>
                                                            </td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Backups and Audits Trail */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-150 dark:border-slate-800">
                              {/* Safety Restore Backups */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--th-text2)' }}>
                                  <History className="w-4 h-4 text-emerald-600" />
                                  Safety Restore Registry (Pre-cleanup snapshots)
                                </h4>
                                <div className="border rounded-2xl overflow-hidden max-h-[220px] overflow-y-auto" style={{ borderColor: 'var(--th-border)' }}>
                                  {backupsList.length === 0 ? (
                                    <p className="p-6 text-center text-xs italic text-gray-400">No backup records configured.</p>
                                  ) : (
                                    backupsList.map(bk => (
                                      <div key={bk.id} className="p-3 border-b border-gray-100 last:border-0 flex items-center justify-between text-[11px]" style={{ background: 'var(--th-surface)' }}>
                                        <div className="space-y-0.5 min-w-0 pr-2">
                                          <p className="font-bold truncate text-gray-800 dark:text-gray-200">{bk.description}</p>
                                          <p className="text-[9.5px] text-gray-400 font-mono">By: {bk.adminEmail} | {new Date(bk.timestamp).toLocaleString()}</p>
                                        </div>
                                        <button
                                          onClick={() => handleRestoreBackup(bk.id)}
                                          className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded-lg font-bold text-[10px] shrink-0 cursor-pointer"
                                        >
                                          Restore
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Admin Action Audit Trails */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--th-text2)' }}>
                                  <Terminal className="w-4 h-4 text-indigo-650" />
                                  Action Audit Trails
                                </h4>
                                <div className="border rounded-2xl overflow-hidden max-h-[220px] overflow-y-auto" style={{ borderColor: 'var(--th-border)' }}>
                                  {auditLogsList.length === 0 ? (
                                    <p className="p-6 text-center text-xs italic text-gray-400">No audit log entries recorded yet.</p>
                                  ) : (
                                    auditLogsList.map(ad => (
                                      <div key={ad.id} className="p-3 border-b border-gray-100 last:border-0 text-[10.5px] leading-relaxed" style={{ background: 'var(--th-surface)', color: 'var(--th-text3)' }}>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{ad.action}</span>
                                        <div className="flex flex-wrap gap-x-2 text-[9px] text-gray-400 font-mono mt-0.5">
                                          <span>User: {ad.adminEmail}</span>
                                          <span>IP: {ad.ipAddress}</span>
                                          <span>Time: {new Date(ad.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Backup Manager Dashboard Tab */}
                        {healthSubTab === 'backup_manager' && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="p-3.5 bg-white dark:bg-slate-900 border border-gray-250/40 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Total Backups</p>
                                <p className="text-xl font-display font-bold text-indigo-600 mt-0.5">{backupManagerTotal}</p>
                              </div>
                              <div className="p-3.5 bg-white dark:bg-slate-900 border border-gray-250/40 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Safety Snapshots</p>
                                <p className="text-xl font-display font-bold text-emerald-600 mt-0.5">{backupsList.length}</p>
                              </div>
                              <div className="p-3.5 bg-white dark:bg-slate-900 border border-gray-250/40 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Duplicate Backups</p>
                                <p className="text-xl font-display font-bold text-amber-600 mt-0.5">{backupManagerTotal}</p>
                              </div>
                              <div className="p-3.5 bg-white dark:bg-slate-900 border border-gray-250/40 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--th-text4)' }}>Restore Guard</p>
                                <p className="text-xs font-bold text-green-600 mt-2.5">Active</p>
                              </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-0.5">
                                <h4 className="text-xs font-bold" style={{ color: 'var(--th-text)' }}>Target Database for Restores</h4>
                                <p className="text-[10px] text-gray-500">Select which database to push recovered duplicate records into</p>
                              </div>
                              <select
                                value={restoreTargetDbId}
                                onChange={(e) => setRestoreTargetDbId(e.target.value)}
                                className="p-2 border rounded-xl text-xs font-medium focus:outline-none max-w-xs bg-white dark:bg-slate-950"
                                style={{ borderColor: 'var(--th-border)', color: 'var(--th-text)' }}
                              >
                                <option value="">-- Choose Target Database --</option>
                                {savedDatabases.filter(db => !db.id.startsWith('__')).map(db => (
                                  <option key={db.id} value={db.id}>{db.name} ({db.diaries?.length || 0} cases)</option>
                                ))}
                              </select>
                            </div>

                            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: 'var(--th-border)', background: 'var(--th-surface)' }}>
                              <div className="p-3 border-b font-bold text-xs" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)', color: 'var(--th-text2)' }}>
                                Deleted Duplicates Backup Table (case_diary_duplicate_backup)
                              </div>
                              {isLoadingBackupManager ? (
                                <p className="p-8 text-center text-xs italic text-gray-400">Loading backup records...</p>
                              ) : backupManagerError ? (
                                <p className="p-8 text-center text-xs text-rose-500 font-semibold">{backupManagerError}</p>
                              ) : backupManagerRecords.length === 0 ? (
                                <p className="p-8 text-center text-xs italic text-gray-400">No deleted duplicate records found in backup storage.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b" style={{ background: 'var(--th-surface2)', borderColor: 'var(--th-border)' }}>
                                        <th className="p-3 font-bold text-[9px] uppercase">Backup ID</th>
                                        <th className="p-3 font-bold text-[9px] uppercase">Backup Date</th>
                                        <th className="p-3 font-bold text-[9px] uppercase">Deleted By</th>
                                        <th className="p-3 font-bold text-[9px] uppercase">Police Station</th>
                                        <th className="p-3 font-bold text-[9px] uppercase">Crime Number</th>
                                        <th className="p-3 font-bold text-[9px] uppercase">Original Record ID</th>
                                        <th className="p-3 font-bold text-[9px] uppercase">Reason</th>
                                        <th className="p-3 font-bold text-[9px] uppercase text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {backupManagerRecords.map(rec => {
                                        const original = typeof rec.original_record === 'string'
                                          ? JSON.parse(rec.original_record)
                                          : rec.original_record || {};
                                        return (
                                          <tr key={rec.id} className="border-b hover:bg-slate-50/40 dark:hover:bg-slate-900/40" style={{ borderColor: 'var(--th-border)' }}>
                                            <td className="p-3 font-mono text-[9px]">{rec.id}</td>
                                            <td className="p-3 whitespace-nowrap">{BackupManagerService.formatBackupDate(rec.backup_timestamp)}</td>
                                            <td className="p-3 font-semibold text-gray-700 dark:text-gray-300">{rec.deleted_by}</td>
                                            <td className="p-3">{original.policeStation || 'N/A'}</td>
                                            <td className="p-3 font-bold">{original.crNoAndSecOfLaw || 'N/A'}</td>
                                            <td className="p-3 font-mono text-[9px]">{rec.original_record_id}</td>
                                            <td className="p-3 text-gray-500 max-w-xs truncate" title={rec.delete_reason}>{rec.delete_reason}</td>
                                            <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                                              <button
                                                onClick={() => alert(`Original Case Record JSON:\n\n${JSON.stringify(original, null, 2)}`)}
                                                className="p-1 px-2 border hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-bold text-[10px] cursor-pointer"
                                              >
                                                View
                                              </button>
                                              <button
                                                onClick={() => handleRestoreBackupRecord(rec)}
                                                disabled={!restoreTargetDbId}
                                                className={`p-1 px-2 bg-emerald-600 hover:bg-emerald-750 text-white rounded-lg font-bold text-[10px] cursor-pointer ${!restoreTargetDbId ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                title={!restoreTargetDbId ? 'Select a target database first' : ''}
                                              >
                                                Restore
                                              </button>
                                              <button
                                                onClick={() => handleDeleteBackupRecord(rec.id)}
                                                className="p-1 px-2 bg-transparent hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg font-bold text-[10px] cursor-pointer"
                                              >
                                                Delete
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Pagination controls */}
                            {backupManagerTotal > 50 && (
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-medium">Showing {backupManagerRecords.length} of {backupManagerTotal} records</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => loadBackupManagerRecords(backupManagerPage - 1)}
                                    disabled={backupManagerPage === 1}
                                    className="p-1 px-2.5 border rounded-lg hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Previous
                                  </button>
                                  <span className="font-bold px-2">Page {backupManagerPage}</span>
                                  <button
                                    onClick={() => loadBackupManagerRecords(backupManagerPage + 1)}
                                    disabled={backupManagerPage * 50 >= backupManagerTotal}
                                    className="p-1 px-2.5 border rounded-lg hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Legacy safety restore backups section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-150 dark:border-slate-800">
                              {/* Safety Restore Backups */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--th-text2)' }}>
                                  <History className="w-4 h-4 text-emerald-600" />
                                  Safety Restore Registry (Pre-cleanup snapshots)
                                </h4>
                                <div className="border rounded-2xl overflow-hidden max-h-[220px] overflow-y-auto" style={{ borderColor: 'var(--th-border)' }}>
                                  {backupsList.length === 0 ? (
                                    <p className="p-6 text-center text-xs italic text-gray-400">No backup records configured.</p>
                                  ) : (
                                    backupsList.map(bk => (
                                      <div key={bk.id} className="p-3 border-b border-gray-100 last:border-0 flex items-center justify-between text-[11px]" style={{ background: 'var(--th-surface)' }}>
                                        <div className="space-y-0.5 min-w-0 pr-2">
                                          <p className="font-bold truncate text-gray-800 dark:text-gray-200">{bk.description}</p>
                                          <p className="text-[9.5px] text-gray-400 font-mono">By: {bk.adminEmail} | {new Date(bk.timestamp).toLocaleString()}</p>
                                        </div>
                                        <button
                                          onClick={() => handleRestoreBackup(bk.id)}
                                          className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded-lg font-bold text-[10px] shrink-0 cursor-pointer"
                                        >
                                          Restore
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Admin Action Audit Trails */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--th-text2)' }}>
                                  <Terminal className="w-4 h-4 text-indigo-650" />
                                  Action Audit Trails
                                </h4>
                                <div className="border rounded-2xl overflow-hidden max-h-[220px] overflow-y-auto" style={{ borderColor: 'var(--th-border)' }}>
                                  {auditLogsList.length === 0 ? (
                                    <p className="p-6 text-center text-xs italic text-gray-400">No audit log entries recorded yet.</p>
                                  ) : (
                                    auditLogsList.map(ad => (
                                      <div key={ad.id} className="p-3 border-b border-gray-100 last:border-0 text-[10.5px] leading-relaxed" style={{ background: 'var(--th-surface)', color: 'var(--th-text3)' }}>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{ad.action}</span>
                                        <div className="flex flex-wrap gap-x-2 text-[9px] text-gray-400 font-mono mt-0.5">
                                          <span>User: {ad.adminEmail}</span>
                                          <span>IP: {ad.ipAddress}</span>
                                          <span>Time: {new Date(ad.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
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
        <div className="lg:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t px-4 z-50 flex items-center justify-around shadow-lg" style={{ background: 'var(--th-header-bg)', borderColor: 'var(--th-header-border)', paddingBottom: 'max(env(safe-area-inset-bottom), 8px)', paddingTop: '8px' }}>
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
          {roleInfo.level === 'admin' && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all cursor-pointer`}
              style={{ color: activeTab === 'dashboard' ? 'var(--th-primary)' : 'var(--th-text4)' }}
            >
              <Shield className="w-5 h-5" />
              Admin
            </button>
          )}
        </div>
      )}

      {/* Duplicate Comparison Modal */}
      {selectedGroupForCompare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl border flex flex-col gap-5"
            style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--th-border)' }}>
              <div>
                <h3 className="font-display font-semibold text-base" style={{ color: 'var(--th-text)' }}>
                  Duplicate Record Comparison
                </h3>
                <p className="text-xs" style={{ color: 'var(--th-text3)' }}>
                  Comparing entries for PS: <strong>{selectedGroupForCompare.policeStation}</strong> | Crime No: <strong>{selectedGroupForCompare.crimeNumber}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedGroupForCompare(null)}
                className="text-gray-400 hover:text-gray-655 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr style={{ background: 'var(--th-surface2)', borderBottom: '1px solid var(--th-border)' }}>
                    <th className="p-3 font-bold uppercase text-[9px] w-1/4">Field</th>
                    <th className="p-3 font-bold uppercase text-[9px] w-3/8 text-green-700 bg-green-500/5">Original Record (Oldest)</th>
                    <th className="p-3 font-bold uppercase text-[9px] w-3/8 text-rose-700 bg-rose-500/5">Duplicate Record (Newer)</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: 'Record ID', field: 'id' },
                    { label: 'Police Station', field: 'policeStation' },
                    { label: 'Crime No & Sec of Law', field: 'crNoAndSecOfLaw' },
                    { label: 'Date of CD', field: 'dateOfCd' },
                    { label: 'District', field: 'district' },
                    { label: 'Attended By / IO', field: 'attendedBy' },
                    { label: 'Court Name', field: 'courtNameAndPlace' },
                    { label: 'Stage of the Case', field: 'stageOfTheCase' },
                    { label: 'Posted For', field: 'postedFor' },
                    { label: 'Next Hearing Date', field: 'nextHearingDate' },
                    { label: 'Complainant', field: 'complainant' }
                  ] as const).map((col) => {
                    const originalVal = String((selectedGroupForCompare.originalRecord as any)[col.field] || '');
                    const duplicateVal = String((selectedGroupForCompare.duplicates[0] as any)[col.field] || '');
                    const isDifferent = originalVal !== duplicateVal;

                    return (
                      <tr key={col.field} className="border-b border-gray-100 last:border-0">
                        <td className="p-3 font-bold text-gray-500">{col.label}</td>
                        <td className="p-3 font-medium bg-green-500/5" style={{ color: 'var(--th-text)' }}>
                          {originalVal || <span className="text-gray-400 italic">Empty</span>}
                        </td>
                        <td className={`p-3 font-semibold ${isDifferent ? 'bg-amber-500/10 text-amber-900 border border-amber-200/50' : 'bg-rose-500/5'}`}>
                          {duplicateVal || <span className="text-gray-400 italic">Empty</span>}
                          {isDifferent && (
                            <span className="block text-[8px] font-bold text-amber-600 uppercase mt-1">Difference Detected</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 border-t pt-3" style={{ borderColor: 'var(--th-border)' }}>
              <button
                onClick={() => setSelectedGroupForCompare(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold hover:bg-gray-50 cursor-pointer"
                style={{ color: 'var(--th-text2)' }}
              >
                Close Comparison
              </button>
              <button
                onClick={() => {
                  handleRemoveGroupDuplicates(selectedGroupForCompare);
                  setSelectedGroupForCompare(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-750 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Remove Duplicates
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Import Validation Report Modal */}
      {showImportValidationModal && importValidationReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl rounded-3xl p-6 shadow-2xl border flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--th-card-bg)', borderColor: 'var(--th-card-border)' }}
          >
            <div className="flex items-start justify-between border-b pb-3" style={{ borderColor: 'var(--th-border)' }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-650 animate-pulse" />
                <h3 className="font-display font-bold text-base" style={{ color: 'var(--th-text)' }}>
                  File Import Validation Report
                </h3>
              </div>
              <button
                onClick={() => setShowImportValidationModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Validation summary metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-center" style={{ borderColor: 'var(--th-border)' }}>
                <span className="text-[9px] font-bold uppercase text-gray-500">Total Records</span>
                <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--th-text)' }}>{importValidationReport.totalRecords}</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-150/40 rounded-xl text-center">
                <span className="text-[9px] font-bold uppercase text-green-600">Valid Records</span>
                <p className="text-lg font-bold text-green-700 mt-0.5">{importValidationReport.validRecords}</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-150/40 rounded-xl text-center">
                <span className="text-[9px] font-bold uppercase text-amber-600">Skipped (Dup)</span>
                <p className="text-lg font-bold text-amber-700 mt-0.5">{importValidationReport.skippedCount}</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-150/40 rounded-xl text-center">
                <span className="text-[9px] font-bold uppercase text-red-600">Invalid Records</span>
                <p className="text-lg font-bold text-red-700 mt-0.5">{importValidationReport.invalidRecords}</p>
              </div>
            </div>

            {/* Detailed counters grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl text-[10px] font-semibold" style={{ color: 'var(--th-text3)' }}>
              <div className="flex justify-between border-b sm:border-b-0 sm:border-r border-gray-200/50 pr-2" style={{ borderColor: 'var(--th-border)' }}>
                <span>Duplicates In File:</span>
                <span className="font-bold text-amber-600">{importValidationReport.skippedDuplicateInFile}</span>
              </div>
              <div className="flex justify-between border-b sm:border-b-0 sm:border-r border-gray-200/50 px-2" style={{ borderColor: 'var(--th-border)' }}>
                <span>Duplicates In DB:</span>
                <span className="font-bold text-amber-600">{importValidationReport.skippedDuplicateInDatabase}</span>
              </div>
              <div className="flex justify-between pl-2">
                <span>Time Taken:</span>
                <span className="font-bold text-indigo-650">{importValidationReport.timeTaken} ms</span>
              </div>
            </div>

            {/* Validation Warnings / Details List */}
            {(importValidationReport.skippedFileDetails.length > 0 ||
              importValidationReport.skippedDatabaseDetails.length > 0 ||
              importValidationReport.invalidDetails.length > 0) && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Validation Details</h4>
                <div className="border rounded-2xl max-h-[220px] overflow-y-auto divide-y text-[10.5px] leading-relaxed" style={{ borderColor: 'var(--th-border)', background: 'var(--th-surface)' }}>
                  
                  {/* Invalid details */}
                  {importValidationReport.invalidDetails.map((inv, idx) => (
                    <div key={`inv-${idx}`} className="p-2.5 bg-red-500/5 text-red-700 dark:text-red-400">
                      <strong>Row {inv.rowIndex}:</strong> Missing required fields: <span className="font-bold">{inv.missingFields.join(', ')}</span>.
                    </div>
                  ))}

                  {/* Skipped in File details */}
                  {importValidationReport.skippedFileDetails.map((sk, idx) => (
                    <div key={`sk-file-${idx}`} className="p-2.5 bg-amber-500/5 text-amber-700 dark:text-amber-400">
                      <strong>Skipped Duplicate in File:</strong> PS: {sk.policeStation} | Crime: {sk.crimeNumber} — {sk.reason}
                    </div>
                  ))}

                  {/* Skipped in DB details */}
                  {importValidationReport.skippedDatabaseDetails.map((sk, idx) => (
                    <div key={`sk-db-${idx}`} className="p-2.5 bg-amber-500/5 text-amber-700 dark:text-amber-400">
                      <strong>Skipped Duplicate in Database:</strong> PS: {sk.policeStation} | Crime: {sk.crimeNumber} (Existing ID: <span className="font-mono text-[9.5px]">{sk.existingRecordId}</span>) — {sk.reason}
                    </div>
                  ))}

                </div>
              </div>
            )}

            {/* Confirmation actions */}
            <div className="border-t pt-3 flex flex-col sm:flex-row justify-between items-center gap-3" style={{ borderColor: 'var(--th-border)' }}>
              <div className="w-full sm:w-auto relative">
                <label className="block text-[8px] font-bold uppercase tracking-wider mb-0.5 text-gray-400">Import Database Name</label>
                <input
                  type="text"
                  value={importValidationDbName}
                  onChange={(e) => setImportValidationDbName(e.target.value)}
                  className="p-2 border rounded-xl text-xs font-semibold focus:outline-none w-full sm:w-60 bg-white dark:bg-slate-950"
                  style={{ borderColor: 'var(--th-border)', color: 'var(--th-text)' }}
                  placeholder="Database Name"
                />
              </div>
              <div className="flex gap-2.5 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setShowImportValidationModal(false)}
                  className="px-4 py-2.5 border rounded-xl text-xs font-bold hover:bg-gray-50 cursor-pointer"
                  style={{ color: 'var(--th-text2)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmValidatedImport}
                  disabled={importValidationReport.validDiaries.length === 0 || isImportingValidated}
                  className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                    (importValidationReport.validDiaries.length === 0 || isImportingValidated) ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isImportingValidated ? 'Importing...' : `Import ${importValidationReport.validDiaries.length} Valid Records`}
                </button>
              </div>
            </div>
          </motion.div>
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
      <InstallManager hasUser={!!user} />
    </div>
  );
}
