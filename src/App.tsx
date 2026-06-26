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
  Edit3
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


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  // Tamil Voice Typing States
  const [isListeningRemarks, setIsListeningRemarks] = useState<boolean>(false);
  const [voiceTypingSupported, setVoiceTypingSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceTypingSupported(false);
    }
  }, []);

  const toggleRemarksVoiceTyping = async () => {
    if (!voiceTypingSupported) {
      alert("Voice typing is not supported in this browser. Please try using Google Chrome or Safari.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isListeningRemarks) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListeningRemarks(false);
      return;
    }

    try {
      // Explicitly request microphone access first to trigger permissions dialog in browser/iframe
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'ta-IN'; // Tamil (India)

      recognition.onstart = () => {
        setIsListeningRemarks(true);
      };

      recognition.onresult = (event: any) => {
        const resultIndex = event.resultIndex;
        const transcript = event.results[resultIndex][0].transcript;

        setDiaries((prev) =>
          prev.map((d) => {
            if (d.id === selectedDiaryId) {
              const currentRemarks = d.remarks || '';
              const separator = currentRemarks ? ' ' : '';
              return { ...d, remarks: currentRemarks + separator + transcript };
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
        setIsListeningRemarks(false);
      };

      recognition.onend = () => {
        setIsListeningRemarks(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition or get microphone permission:", err);
      alert("Microphone access is required for Voice Typing. Please allow microphone permissions or open this application in a new tab.");
      setIsListeningRemarks(false);
    }
  };


  // Initialize Auth state on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        const guestActive = localStorage.getItem("guest_session_active");
        if (guestActive === "true") {
          let guestId = localStorage.getItem("guest_user_id");
          if (!guestId) {
            guestId = 'guest-' + Date.now();
            localStorage.setItem("guest_user_id", guestId);
          }
          setUser({
            uid: guestId,
            displayName: 'Guest Officer',
            email: 'guest@station.local',
            photoURL: null,
          } as any);
          setToken('guest-token');
          setNeedsAuth(false);
        } else {
          setUser(null);
          setToken(null);
          setNeedsAuth(true);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGuestAccess = () => {
    let guestId = localStorage.getItem("guest_user_id");
    if (!guestId) {
      guestId = 'guest-' + Date.now();
      localStorage.setItem("guest_user_id", guestId);
    }
    localStorage.setItem("guest_session_active", "true");
    setUser({
      uid: guestId,
      displayName: 'Guest Officer',
      email: 'guest@station.local',
      photoURL: null,
    } as any);
    setToken('guest-token');
    setNeedsAuth(false);
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup') || err.message?.includes('closed')) {
        setAuthError('Google Sign-In popup was blocked or closed. Activating Offline Guest Mode so you can proceed immediately...');
        setTimeout(() => {
          handleGuestAccess();
        }, 1500);
      } else {
        setAuthError(err.message || 'Failed to authenticate with Google. Please try again.');
      }
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
      loadDatabases(user.uid);
    } else {
      setSavedDatabases([]);
    }
  }, [user]);

  const loadDatabases = async (uid: string) => {
    setIsLoadingDbs(true);
    try {
      const dbs = await getSavedDatabases(uid);
      setSavedDatabases(dbs);
    } catch (err) {
      console.error('Error loading databases:', err);
    } finally {
      setIsLoadingDbs(false);
    }
  };

  // Debounced Auto-Save back to Local / Server / Cloud Database when editing an active session
  useEffect(() => {
    if (!user || !loadedDbId || isSaved || diaries.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const saved = await saveSavedDatabase(loadedDbName || "Database", diaries, user.uid, loadedDbId);
        setSavedDatabases((prev) => prev.map(db => db.id === loadedDbId ? saved : db));
        setIsSaved(true);
        console.log("Background Auto-Save successful for database:", loadedDbId);
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
      } else {
        setConversionError('Please upload a valid PDF document.');
      }
    }
  };

  const triggerBrowse = () => {
    fileInputRef.current?.click();
  };

  // Run AI layout extraction and reconstruction with an animated progress loading bar
  const runExtraction = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setConversionError(null);
    setExtractionProgress(5);
    setExtractionLogs([]);

    const logList: string[] = [];
    const addLocalLog = (message: string, type: 'INFO' | 'OCR' | 'AI' | 'RECONSTRUCT' | 'SUCCESS' | 'ERROR' | 'SYSTEM' = 'INFO') => {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      const logString = `[${time}] [${type}] ${message}`;
      logList.push(logString);
      setExtractionLogs([...logList]);
    };

    addLocalLog('Starting case diary reconstruction pipeline...', 'SYSTEM');
    addLocalLog(`Target file: "${selectedFile.name}" (${(selectedFile.size / 1024).toFixed(1)} KB)`, 'SYSTEM');
    addLocalLog(`Extraction mode: ${extractionMode === 'free' ? 'Unlimited Free (Local Browser OCR)' : 'Cloud Upload (Direct multi-modal)'}`, 'SYSTEM');

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      let result: any = null;

      // Pre-check page count client-side to enforce limits and guide the user
      let numPages = 0;
      try {
        const pdfjsLib = await loadPdfJs();
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        numPages = pdf.numPages;
        addLocalLog(`Verified PDF structure: ${numPages} page(s) found.`, 'SYSTEM');
        if (numPages > 50) {
          addLocalLog(`Note: Processing documents larger than 50 pages can take a few minutes due to rate-limit pacing. Please keep this tab open until reconstruction completes.`, 'SYSTEM');
        }
      } catch (err: any) {
        console.warn("Failed to precheck page count client-side:", err);
      }

      if (numPages > 20 && extractionMode === 'direct') {
        addLocalLog(`Warning: Cloud Upload (Direct) mode is limited to 20 pages to prevent serverless timeouts.`, 'ERROR');
        addLocalLog(`Please switch the extraction option to 'Unlimited Free (Local Browser OCR)' to process this ${numPages}-page document.`, 'SYSTEM');
        throw new Error(`Direct Cloud Upload is restricted to 20 pages due to serverless timeouts. Please select the 'Unlimited Free (Local Browser OCR)' option instead.`);
      }

      if (extractionMode === 'free') {
        // Mode B: Unlimited Free Extraction (Client-Side Parser + Cloud Gemini Formatting)
        setExtractionStep('Initializing high-fidelity Client-Side PDF Engine...');
        addLocalLog('Bootstrapping local client-side PDF renderer...', 'INFO');
        
        // Run the client-side text-extraction & OCR with REAL progress updates
        const extractedText = await extractTextFromPdfClientSide(selectedFile, (percent, step) => {
          // Keep progress strictly within 0-85% range during local client-side extraction
          const scaledPercent = Math.floor(5 + (percent / 100) * 80);
          setExtractionProgress(scaledPercent);
          setExtractionStep(step);

          if (step.includes('Initializing')) {
            addLocalLog(step, 'SYSTEM');
          } else if (step.includes('Reading') || step.includes('Decrypting')) {
            addLocalLog(step, 'INFO');
          } else if (step.includes('Scanning')) {
            addLocalLog(step, 'INFO');
          } else if (step.includes('OCR') || step.includes('local deep OCR scan')) {
            addLocalLog(step, 'OCR');
          } else if (step.includes('Rendering')) {
            addLocalLog(step, 'INFO');
          } else if (step.includes('Dismantling')) {
            addLocalLog(step, 'SYSTEM');
          } else {
            addLocalLog(step, 'INFO');
          }
        });

        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('Could not extract any readable text or OCR characters from this PDF file locally.');
        }

        addLocalLog(`Successfully extracted ${extractedText.length} characters of raw text and layout matrices.`, 'SUCCESS');
        addLocalLog('Preparing structured content layout formatting rules...', 'SYSTEM');

        // Split extracted text into pages using page markers
        const parts = extractedText.split(/--- PAGE \d+(?: \(SCANNED OCR\))? ---/);
        const pages = parts.slice(1).map(p => p.trim());
        
        const chunkSize = 10;
        const chunks: string[] = [];
        for (let i = 0; i < pages.length; i += chunkSize) {
          const chunkPages = pages.slice(i, i + chunkSize);
          let chunkText = "";
          for (let j = 0; j < chunkPages.length; j++) {
            const globalPageNum = i + j + 1;
            chunkText += `\n\n--- PAGE ${globalPageNum} ---\n\n` + chunkPages[j];
          }
          chunks.push(chunkText);
        }
        
        addLocalLog(`Segmented document into ${chunks.length} processing batch(es) (maximum ${chunkSize} pages per batch).`, 'SYSTEM');
        
        const allData: any[] = [];
        let fallbackUsed = false;
        let fallbackMsg = "";
        
        for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
          const chunk = chunks[cIdx];
          const startPage = cIdx * chunkSize + 1;
          const endPage = Math.min((cIdx + 1) * chunkSize, pages.length);
          
          addLocalLog(`Transmitting batch ${cIdx + 1} of ${chunks.length} (Pages ${startPage} to ${endPage}) to Gemini formatting endpoint /api/extract-text...`, 'AI');
          setExtractionStep(`Structuring batch ${cIdx + 1}/${chunks.length} (Pages ${startPage}-${endPage})...`);
          
          const baseProgress = 85 + Math.floor((cIdx / chunks.length) * 14);
          setExtractionProgress(baseProgress);
          
          let response: Response;
          let retriesLeft = 4;
          let delayMs = 3000;
          
          while (true) {
            response = await fetch('/api/extract-text', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: chunk,
                filename: selectedFile.name,
              }),
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
              throw new Error(errorText || `Formatting failed for batch ${cIdx + 1} (${response.status})`);
            }
          }
          
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            const responseText = await response.text();
            if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
              throw new Error('The backend server returned an HTML page instead of JSON. This usually indicates that the server is restarting, overloaded, or experiencing high demand. Please try again in a few seconds.');
            }
            throw new Error(`Expected JSON response, but received content-type "${contentType}" for batch ${cIdx + 1}`);
          }
          
          const chunkResult = await response.json();
          if (chunkResult && chunkResult.success && Array.isArray(chunkResult.data)) {
            allData.push(...chunkResult.data);
            if (chunkResult.fallbackUsed) {
              fallbackUsed = true;
              fallbackMsg = chunkResult.message || fallbackMsg;
            }
          } else {
            throw new Error(`Invalid structured data format returned for batch ${cIdx + 1}.`);
          }
        }
        
        result = {
          success: true,
          data: allData,
          fallbackUsed,
          message: fallbackMsg
        };
      } else {
        // Mode A: Direct Cloud Upload (Multi-modal Gemini Direct Extraction)
        setExtractionStep('Uploading Case Diary & Setting up Security Context...');
        
        // Progress bar simulation interval
        let progressVal = 5;
        let lastLoggedVal = 0;
        progressInterval = setInterval(() => {
          progressVal += Math.floor(Math.random() * 8) + 3;
          if (progressVal > 95) {
            progressVal = 95;
          }
          setExtractionProgress(progressVal);

          // Dynamically select steps based on current simulated progress
          if (progressVal <= 18) {
            setExtractionStep('Uploading Case Diary & Setting up Security Context...');
            if (lastLoggedVal < 5) {
              addLocalLog('Uploading base64 document payload stream directly to cloud gateway...', 'SYSTEM');
              addLocalLog(`Payload size: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`, 'SYSTEM');
              lastLoggedVal = 5;
            }
          } else if (progressVal <= 38) {
            setExtractionStep('Performing OCR Layout and Hand-written Aligned Parsing...');
            if (lastLoggedVal < 20) {
              addLocalLog('Performing deep multimodal OCR rasterization on cloud instances...', 'OCR');
              addLocalLog('Segmenting handwritten logs and printed headers...', 'OCR');
              lastLoggedVal = 20;
            }
          } else if (progressVal <= 58) {
            setExtractionStep('Consulting Google Gemini Language Intelligence Engine...');
            if (lastLoggedVal < 40) {
              addLocalLog('Submitting raster images to Gemini 2.5 Flash...', 'AI');
              addLocalLog('Validating schema and structure contexts...', 'AI');
              lastLoggedVal = 40;
            }
          } else if (progressVal <= 78) {
            setExtractionStep('Translating bilingual segments & form structures...');
            if (lastLoggedVal < 60) {
              addLocalLog('Scanning for Tamil vernacular texts in Remarks sections...', 'AI');
              addLocalLog('Aligning bilingual translation schemas (Tamil and English indexes)...', 'AI');
              lastLoggedVal = 60;
            }
          } else if (progressVal <= 92) {
            setExtractionStep('Reconstructing complex police diary database records...');
            if (lastLoggedVal < 80) {
              addLocalLog('Generating clean JSON templates matching database schema rules...', 'RECONSTRUCT');
              addLocalLog('Parsing witness examination logs...', 'RECONSTRUCT');
              lastLoggedVal = 80;
            }
          } else {
            setExtractionStep('Aligning and mapping structured tables...');
            if (lastLoggedVal < 93) {
              addLocalLog('Validating layout schema consistency...', 'SYSTEM');
              lastLoggedVal = 93;
            }
          }
        }, 350);

        // Helper to read file as base64 string
        const fileToBase64 = (file: File): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
              const base64String = reader.result as string;
              const base64 = base64String.split(',')[1];
              resolve(base64);
            };
            reader.onerror = (error) => reject(error);
          });
        };

        const base64Data = await fileToBase64(selectedFile);
        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: base64Data,
            filename: selectedFile.name,
          }),
        });

        if (progressInterval) clearInterval(progressInterval);

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 413 || errorText.includes('TOO_LARGE')) {
            throw new Error('This PDF file exceeds the Vercel server upload size limit. Please switch to the "Unlimited Free (Client-Side OCR)" option above, which can process files of any size without limitations.');
          }
          throw new Error(errorText || `Reconstruction failed (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const responseText = await response.text();
          if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
            throw new Error('The backend server returned an HTML page instead of JSON. This usually indicates that the server is restarting, overloaded, or experiencing high demand. Please try again in a few seconds.');
          }
          throw new Error(`Expected JSON response, but received content-type "${contentType}" with body: ${responseText.substring(0, 200)}`);
        }

        result = await response.json();
      }

      if (result && result.success && Array.isArray(result.data)) {
        if (progressInterval) clearInterval(progressInterval);
        setExtractionProgress(100);
        setExtractionStep('Reconstruction completed successfully!');
        addLocalLog(`Successfully structured ${result.data.length} case diary entry(ies).`, 'SUCCESS');
        addLocalLog('Pipeline complete. Rendering data schemas in Workspace...', 'SUCCESS');

        // Map extracted indices to unique string IDs
        const rawDiaries: CaseDiary[] = result.data.map((diary: any, idx: number) => ({
          ...diary,
          id: `${Date.now()}-${idx}`,
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

        // Remove duplicate entries with the exact same crime number, police station, and date of CD
        const seenDiariesKeys = new Set<string>();
        const formattedDiaries: CaseDiary[] = [];

        rawDiaries.forEach((diary) => {
          const key = `${(diary.crNoAndSecOfLaw || '').trim().toLowerCase()}_${(diary.policeStation || '').trim().toLowerCase()}_${(diary.dateOfCd || '').trim().toLowerCase()}`;
          if (!seenDiariesKeys.has(key)) {
            seenDiariesKeys.add(key);
            formattedDiaries.push(diary);
          }
        });

        // Delay slightly for visual satisfaction of reaching 100%
        setTimeout(() => {
          setDiaries(formattedDiaries);
          setSelectedDiaryId(formattedDiaries[0].id);
          setSelectedFile(null);
          setIsExtracting(false);
          setExtractionProgress(0);

          // Prefill database name from extracted data
          const firstDiary = formattedDiaries[0];
          const crimeNo = (firstDiary.crNoAndSecOfLaw || 'Diary').split(',')[0].replace(/[\/\\?%*:|"<>]/g, '-').trim();
          const station = firstDiary.policeStation || 'Record';
          const defaultName = `Database - CR No ${crimeNo} - ${station}`;
          setDbNameInput(defaultName);
          setShowSaveDbPrompt(true);
        }, 600);

      } else {
        throw new Error('Server returned invalid structured data format.');
      }
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      console.error('Reconstruction error:', err);
      addLocalLog(err.message || 'Unknown processing exception occurred during execution.', 'ERROR');
      setConversionError(err.message || 'Failed to complete formatting reconstruction. Please retry.');
      setIsExtracting(false);
      setExtractionProgress(0);
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

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col antialiased">
      {/* Header Bar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-sm sm:text-base md:text-lg text-gray-950 tracking-tight truncate">AI Case Diary Reconstruction Workspace</h1>
              <p className="text-[10px] sm:text-xs text-gray-400 sm:text-gray-500 font-medium truncate">Reconstruct, Form and Format Scanned Case Diaries with Pixel Precision</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-sm">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-semibold text-gray-900 leading-tight">{user.displayName}</p>
                  <p className="text-[10px] text-gray-400 font-medium leading-none">{user.email}</p>
                </div>
              </div>
              <button 
                id="sign-out-btn"
                onClick={handleLogout} 
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

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
              className="max-w-xl w-full mx-auto my-auto py-12 flex flex-col items-center"
            >
              <div className="w-full bg-white border border-gray-200/80 rounded-2xl p-8 shadow-sm">
                <div className="text-center mb-8">
                  <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h2 className="font-display font-semibold text-2xl text-gray-950 tracking-tight">Connect Workspace Profile</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    To reconstruct scanned documents or export to Google Drive seamlessly, authenticate securely using Google.
                  </p>
                </div>

                {/* Features Checklist */}
                <div className="space-y-4 mb-8 bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Advanced Visual Document Extraction</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Gemini 2.5 Flash analyzes columns, structures, and handwritten remarks instantly.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Bilingual Translation Engine</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Transcribe typewriter and Tamil text inputs directly into readable multi-column outputs.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Pixel Perfect Word Output</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Download editable .docx files perfectly matching the official Case Diary layout guidelines.</p>
                    </div>
                  </div>
                </div>

                {authError && (
                  <div className="mb-6 p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                 <div className="flex flex-col items-center justify-center gap-3">
                  <button 
                    id="gsi-login-btn"
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60"
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

                  <button
                    type="button"
                    onClick={handleGuestAccess}
                    className="w-full flex items-center justify-center gap-2 px-6 py-2.5 border border-transparent rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <span>Continue in Offline / Guest Mode</span>
                  </button>

                  <p className="text-[10px] text-gray-400 mt-2 text-center leading-relaxed">
                    If Google Sign-In is blocked inside your sandbox preview iFrame, click <strong>Continue in Guest Mode</strong> above to format and reconstruct documents offline.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* DUAL PANE WORKSPACE */
            <motion.div 
              key="workspace-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Grid Sidebar: Upload, Select, History (5 Columns) */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* Uploader Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
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
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[140px] ${
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
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-full mb-2">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-gray-800">
                      {selectedFile ? 'Change scanned PDF' : 'Select Case Diary PDF'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {selectedFile ? selectedFile.name : 'Drag & drop or select file'}
                    </p>
                  </div>

                  {/* Extraction Method Toggle */}
                  <div className="mt-3 bg-gray-50 border border-gray-150 rounded-xl p-2.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Extraction Method</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExtractionMode('free')}
                        className={`p-2 rounded-lg text-left transition-all cursor-pointer ${
                          extractionMode === 'free'
                            ? 'bg-white text-indigo-600 shadow-sm border border-gray-150'
                            : 'text-gray-500 hover:text-gray-800 border border-transparent'
                        }`}
                      >
                        <p className="text-[11px] font-bold flex items-center gap-1">
                          <Check className={`w-3 h-3 ${extractionMode === 'free' ? 'text-indigo-600' : 'text-transparent'}`} />
                          Unlimited Free
                        </p>
                        <p className="text-[8.5px] text-gray-400 mt-0.5 ml-4 leading-normal font-medium">Local Browser OCR. Perfect for large files.</p>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setExtractionMode('direct')}
                        className={`p-2 rounded-lg text-left transition-all cursor-pointer ${
                          extractionMode === 'direct'
                            ? 'bg-white text-indigo-600 shadow-sm border border-gray-150'
                            : 'text-gray-500 hover:text-gray-800 border border-transparent'
                        }`}
                      >
                        <p className="text-[11px] font-bold flex items-center gap-1">
                          <Check className={`w-3 h-3 ${extractionMode === 'direct' ? 'text-indigo-600' : 'text-transparent'}`} />
                          Cloud Upload
                        </p>
                        <p className="text-[8.5px] text-gray-400 mt-0.5 ml-4 leading-normal font-medium">Direct Gemini. Max 4.5MB on Vercel.</p>
                      </button>
                    </div>
                  </div>

                  {/* Run Analysis Action */}
                  {selectedFile && !isExtracting && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3.5"
                    >
                      <button
                        id="start-convert-btn"
                        onClick={runExtraction}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        AI Reconstruct & Format layout
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}

                  {conversionError && (
                    <div className="mt-3.5 p-3 bg-red-50 border border-red-100 text-red-700 text-[11px] rounded-xl flex gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
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
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden relative border border-gray-200/50">
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
                        <p className="text-[9px] text-gray-400 mt-1 leading-normal">
                          Analyzing layouts, handwritings, and formatting police case diaries securely.
                        </p>
                      </div>

                      {/* Live Terminal Log Stream (Coding Flow Style) */}
                      {extractionLogs.length > 0 && (
                        <div className="mt-1 flex flex-col">
                          <div className="flex items-center justify-between px-1.5 pb-1 text-[8.5px] font-bold text-gray-400 uppercase tracking-wider">
                            <span>Live Execution Terminal</span>
                            <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                              <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></span>
                              Active Stream
                            </span>
                          </div>
                          <div 
                            ref={logsEndRef}
                            className="bg-slate-950 rounded-xl p-3 border border-slate-900 font-mono text-[9px] leading-relaxed text-slate-300 max-h-[140px] overflow-y-auto shadow-inner flex flex-col gap-1 select-none"
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

                {/* Tabbed Record Selector & Database Library */}
                <div className="bg-white border border-gray-200/95 rounded-3xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.02)] flex-1 flex flex-col min-h-[420px]">
                  {/* Tab Headers */}
                  <div className="flex items-center border-b border-gray-100 mb-4 bg-gray-50/60 p-1 rounded-xl gap-0.5">
                    <button
                      onClick={() => setSidebarTab('workspace')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        sidebarTab === 'workspace'
                          ? 'bg-white text-indigo-700 shadow-xs border border-gray-200/40'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      Workspace ({diaries.length})
                    </button>
                    <button
                      onClick={() => setSidebarTab('history')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer relative ${
                        sidebarTab === 'history'
                          ? 'bg-white text-indigo-700 shadow-xs border border-gray-200/40'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                      Supabase Cloud DB ({savedDatabases.length})
                      {supabaseStatus?.isConfigured && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      )}
                    </button>
                  </div>

                  {sidebarTab === 'workspace' && (
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
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
                              className="text-[9px] text-purple-600 hover:text-purple-800 bg-purple-50/70 hover:bg-purple-100/80 font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-0.5"
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
                            className="w-full pl-8 pr-4 py-1.5 bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs text-gray-900 placeholder-gray-400 font-medium transition-all"
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
                            Upload your scanned police case diary PDF above to begin formatting layout translation.
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
                                return (
                                  <div
                                    key={diary.id}
                                    className={`w-full rounded-2xl border transition-all flex items-center p-3 gap-2.5 cursor-pointer ${
                                      isSelected 
                                        ? 'border-indigo-300 bg-indigo-50/30 shadow-xs' 
                                        : 'border-gray-100 bg-gray-50/10 hover:bg-gray-50'
                                    }`}
                                    onClick={() => setSelectedDiaryId(diary.id)}
                                  >
                                    <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100/80 text-gray-400'}`}>
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
                                                : 'bg-white border-gray-200 text-gray-300 hover:border-indigo-300 hover:text-indigo-600'
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

                          {/* Bulk Export Section (Beautiful MD3 Card) */}
                          <div className="mt-4 pt-3.5 border-t border-gray-100 bg-indigo-50/15 p-3 rounded-2xl border border-indigo-100/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Bulk Export Status</span>
                              <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                                {diaries.filter(d => d.isSavedDraft).length} / {diaries.length} Saved
                              </span>
                            </div>
                            
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
                      <div className="flex items-center justify-between mb-3 bg-gray-50/75 p-2 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="text-[10px] font-bold text-gray-700 truncate">
                            {supabaseStatus?.isConfigured ? 'Supabase Connected' : 'Supabase Offline'}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${supabaseStatus?.isConfigured ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setShowSupaSetup(!showSupaSetup)}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline px-1.5 py-0.5 rounded transition-all cursor-pointer"
                          >
                            {showSupaSetup ? 'Hide Setup' : 'Show Setup'}
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

                      {/* Setup Overlay Guide */}
                      {showSupaSetup && (
                        <div className="mb-4 p-3 rounded-xl border border-indigo-100 bg-indigo-50/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold text-indigo-950 uppercase tracking-wider">Supabase Setup Guide</h4>
                            <button
                              onClick={() => {
                                const sqlText = supabaseStatus?.sqlSetup || `-- Create the case_databases table\nCREATE TABLE IF NOT EXISTS case_databases (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  name TEXT NOT NULL,\n  created_at BIGINT NOT NULL,\n  diaries JSONB NOT NULL DEFAULT '[]'::jsonb\n);\n\n-- Enable Row Level Security (RLS)\nALTER TABLE case_databases ENABLE ROW LEVEL SECURITY;\n\n-- Create policy to allow all users to select their own records\nCREATE POLICY "Allow select for user" ON case_databases\n  FOR SELECT USING (true);\n\n-- Create policy to allow all users to insert their own records\nCREATE POLICY "Allow insert for user" ON case_databases\n  FOR INSERT WITH CHECK (true);\n\n-- Create policy to allow all users to update their own records\nCREATE POLICY "Allow update for user" ON case_databases\n  FOR UPDATE USING (true);\n\n-- Create policy to allow all users to delete their own records\nCREATE POLICY "Allow delete for user" ON case_databases\n  FOR DELETE USING (true);`;
                                navigator.clipboard.writeText(sqlText);
                                alert("Setup SQL code copied to your clipboard!");
                              }}
                              className="text-[9px] text-white font-bold px-1.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
                            >
                              Copy SQL
                            </button>
                          </div>
                          
                          <p className="text-[9px] text-indigo-900 leading-normal font-medium">
                            {supabaseStatus?.isConfigured ? (
                              <span>Connected to: <code className="bg-white/80 px-1 py-0.5 border border-indigo-100 rounded text-[8px] font-mono">{supabaseStatus.supabaseUrl}</code></span>
                            ) : (
                              <span>Define <code className="bg-white/80 px-1 border border-indigo-200 rounded font-mono font-bold">VITE_SUPABASE_URL</code> and <code className="bg-white/80 px-1 border border-indigo-200 rounded font-mono font-bold">VITE_SUPABASE_ANON_KEY</code> in project secrets.</span>
                            )}
                          </p>

                          <div className="p-2 bg-gray-950 text-gray-200 rounded-lg font-mono text-[8px] leading-relaxed select-all overflow-x-auto max-h-[140px] whitespace-pre-wrap border border-gray-800 shadow-inner">
                            {supabaseStatus?.sqlSetup || `-- Run in Supabase SQL editor`}
                          </div>
                        </div>
                      )}

                      {isLoadingDbs ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-10">
                          <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                          <p className="text-xs font-semibold text-gray-500">Loading your database library...</p>
                        </div>
                      ) : !supabaseStatus?.isConfigured ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-amber-50/20 rounded-2xl border border-amber-100/50 min-h-[300px]">
                          <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse mb-2" />
                          <p className="text-xs font-bold text-indigo-950">Cloud Database Unconfigured</p>
                          <p className="text-[10px] text-indigo-700/80 mt-1 max-w-[210px] leading-relaxed font-medium">
                            Define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your settings to unlock persistent cloud storage.
                          </p>
                          <button
                            onClick={() => setShowSupaSetup(true)}
                            className="mt-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                          >
                            View Setup Guide
                          </button>
                        </div>
                      ) : savedDatabases.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50 rounded-2xl border border-gray-100 min-h-[300px]">
                          <Database className="w-8 h-8 text-gray-300 mb-2" />
                          <p className="text-xs font-semibold text-gray-500">No Databases Stored on Supabase</p>
                          <p className="text-[10px] text-gray-400 mt-1 max-w-[210px] leading-relaxed">
                            Once you load and reconstruct a scanned PDF, click <strong>"Save DB"</strong> above to store your case records in the Cloud.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 flex-1">
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
                                  className="p-3.5 flex items-center justify-between cursor-pointer gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-xs font-bold text-gray-950 truncate flex items-center gap-1.5">
                                      <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                      {dbItem.name}
                                    </h4>
                                    <p className="text-[9px] text-gray-400 mt-0.5 font-medium">{formattedDate} • {dbItem.diaries.length} records</p>
                                  </div>
                                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                  <div className="px-3.5 pb-3.5 border-t border-gray-100 bg-gray-50/20 pt-2.5 rounded-b-xl">
                                    {/* Action row */}
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                      <button
                                        onClick={() => handleViewDatabaseDraft(dbItem)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-all"
                                      >
                                        <Eye className="w-3 h-3" />
                                        View Draft
                                      </button>
                                      <button
                                        onClick={() => handleDownloadAllDocx(dbItem.diaries, dbItem.name)}
                                        className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-[10px] font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-all"
                                      >
                                        <FileDown className="w-3 h-3 text-gray-400" />
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

              {/* Right Grid Workspace: Beautiful Form and Layout Editor (8 Columns) */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* Save to Database Banner Prompt */}
                {showSaveDbPrompt && diaries.length > 0 && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                        <Database className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wide">Save Extracted Diaries as a Database</h4>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-medium leading-relaxed">Give this dataset a specific name to persist these case records securely in your secure library.</p>
                        
                        <div className="mt-3 max-w-md">
                          <input
                            type="text"
                            value={dbNameInput}
                            onChange={(e) => setDbNameInput(e.target.value)}
                            placeholder="e.g. Case Diary - Vikiramangalam PS - 2026"
                            className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                      <button
                        onClick={() => setShowSaveDbPrompt(false)}
                        className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 font-semibold rounded-xl transition-all cursor-pointer"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={handleSaveToDatabase}
                        className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
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
                      ? 'bg-green-50 border-green-100 text-green-700 animate-pulse' 
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
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col h-full min-h-[600px]">
                    
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
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-all shrink-0"
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
                          <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-md">VERIFIED PREVIEW</span>
                          <span className="text-[10px] text-gray-400 font-semibold">{activeDiary.dateOfCd}</span>
                        </div>
                        <h2 className="font-display font-bold text-gray-950 text-lg mt-1">{activeDiary.crNoAndSecOfLaw}</h2>
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
                          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer bg-white transition-all shadow-xs"
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
                        <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">I. Administration & Registry</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Police Station</label>
                            <input
                              type="text"
                              value={activeDiary.policeStation}
                              onChange={(e) => handleFieldChange('policeStation', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">District</label>
                            <input
                              type="text"
                              value={activeDiary.district}
                              onChange={(e) => handleFieldChange('district', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">CR. No. & Sec of Law</label>
                            <input
                              type="text"
                              value={activeDiary.crNoAndSecOfLaw}
                              onChange={(e) => handleFieldChange('crNoAndSecOfLaw', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Date of CD</label>
                            <input
                              type="text"
                              value={activeDiary.dateOfCd}
                              onChange={(e) => handleFieldChange('dateOfCd', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-semibold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: General parameters */}
                      <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">II. Occurrence & Complainant Details</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Date, Time & Place of Occurrence</label>
                            <textarea
                              rows={2}
                              value={activeDiary.dateTimeAndPlaceOfOccurrence}
                              onChange={(e) => handleFieldChange('dateTimeAndPlaceOfOccurrence', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Date of Report / Time</label>
                            <input
                              type="text"
                              value={activeDiary.dateOfReportTime}
                              onChange={(e) => handleFieldChange('dateOfReportTime', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">II. Complainant</label>
                            <textarea
                              rows={2}
                              value={activeDiary.complainant}
                              onChange={(e) => handleFieldChange('complainant', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Accused List Table */}
                      <div className="p-4 border border-gray-200 rounded-xl space-y-3.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">III. Accused Details</h4>
                          <button
                            onClick={addAccusedRow}
                            className="text-[10px] bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Accused
                          </button>
                        </div>

                        {/* List representation of accused for seamless editing */}
                        <div className="space-y-3">
                          {activeDiary.accusedList.map((acc, index) => (
                            <div key={index} className="flex gap-2 items-center bg-gray-50/30 p-2.5 rounded-lg border border-gray-100">
                              <span className="text-[11px] font-bold text-gray-400 w-6 text-center">{acc.sNo}</span>
                              <input
                                type="text"
                                value={acc.nameAndAddress}
                                onChange={(e) => handleAccusedChange(index, 'nameAndAddress', e.target.value)}
                                placeholder="Enter name, age, parents, address of accused"
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
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
                            <p className="text-[10px] text-gray-400 text-center py-2 italic bg-gray-50/50 rounded-lg">No accused registered. Click "Add Accused" to define.</p>
                          )}
                        </div>
                      </div>

                      {/* Section 4: Property Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border border-gray-200 rounded-xl">
                          <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">IV. Property Lost Details</label>
                          <textarea
                            rows={2}
                            value={activeDiary.propertyLostDetails}
                            onChange={(e) => handleFieldChange('propertyLostDetails', e.target.value)}
                            className="mt-2 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="p-4 border border-gray-200 rounded-xl">
                          <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">V. Recovered Property Details</label>
                          <textarea
                            rows={2}
                            value={activeDiary.recoveredPropertyDetails}
                            onChange={(e) => handleFieldChange('recoveredPropertyDetails', e.target.value)}
                            className="mt-2 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Section 5: Stage of Case and Court specifics */}
                      <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">VI. Stage & Court Administration</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase">Stage of the Case</label>
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
                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                }`}
                                title="Click to dispose of this case immediately"
                              >
                                {activeDiary.stageOfTheCase === 'CASE DISPOSED' ? '✓ Case Disposed' : 'Case Disposed'}
                              </button>
                            </div>
                            <input
                              type="text"
                              value={activeDiary.stageOfTheCase}
                              onChange={(e) => handleFieldChange('stageOfTheCase', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Court Ref. No.</label>
                            <input
                              type="text"
                              value={activeDiary.courtRefNo}
                              onChange={(e) => handleFieldChange('courtRefNo', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Hearing No.</label>
                            <input
                              type="text"
                              value={activeDiary.hearingNo}
                              onChange={(e) => handleFieldChange('hearingNo', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-semibold text-indigo-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Court Name & Place</label>
                            <input
                              type="text"
                              value={activeDiary.courtNameAndPlace}
                              onChange={(e) => handleFieldChange('courtNameAndPlace', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 6: Specific Hearing Checks (Boolean YES/NO switches) */}
                      <div className="p-4 border border-gray-200 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Hearing Parameters & Checks</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Magistrate Present?</label>
                            <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                              <button
                                type="button"
                                onClick={() => handleFieldChange('whetherMagistratePresent', 'YES')}
                                className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  activeDiary.whetherMagistratePresent === 'YES'
                                    ? 'bg-indigo-600 text-white shadow-xs'
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
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                                }`}
                              >
                                NO
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">APP / PP Present?</label>
                            <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                              <button
                                type="button"
                                onClick={() => handleFieldChange('whetherAppPpPresent', 'YES')}
                                className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  activeDiary.whetherAppPpPresent === 'YES'
                                    ? 'bg-indigo-600 text-white shadow-xs'
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
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                                }`}
                              >
                                NO
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Defence Counsel Present?</label>
                            <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                              <button
                                type="button"
                                onClick={() => handleFieldChange('whetherDefenceCounselPresent', 'YES')}
                                className={`flex-1 text-center py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  activeDiary.whetherDefenceCounselPresent === 'YES'
                                    ? 'bg-indigo-600 text-white shadow-xs'
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
                                    ? 'bg-indigo-600 text-white shadow-xs'
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
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">PWs Cited</label>
                            <input
                              type="text"
                              value={activeDiary.noOfPwsCited}
                              onChange={(e) => handleFieldChange('noOfPwsCited', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">PWs Examined So Far</label>
                            <input
                              type="text"
                              value={activeDiary.noOfPwsExaminedSoFar}
                              onChange={(e) => handleFieldChange('noOfPwsExaminedSoFar', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Accused Charged</label>
                            <input
                              type="text"
                              value={activeDiary.totalNoOfAccusedCharged}
                              onChange={(e) => handleFieldChange('totalNoOfAccusedCharged', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Accused Present</label>
                            <input
                              type="text"
                              value={activeDiary.noOfAccusedPresent}
                              onChange={(e) => handleFieldChange('noOfAccusedPresent', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 7: Case Remarks Multi-line (With support for Tamil text preservation) */}
                      <div className="p-4 border border-indigo-200 bg-indigo-50/10 rounded-xl space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                            REMARKS & TAMIL TRANSCRIPTION
                          </label>
                          <button
                            type="button"
                            onClick={toggleRemarksVoiceTyping}
                            className={`flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer border ${
                              isListeningRemarks 
                                ? 'bg-red-500 hover:bg-red-600 text-white border-red-600 animate-pulse'
                                : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-300 shadow-xs'
                            }`}
                            title="Tamil Voice Typing (Speak in Tamil)"
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
                        <p className="text-[10px] text-gray-400 font-medium">
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
                        <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Posted Parameters & Next Hearing</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Posted For</label>
                            <input
                              type="text"
                              value={activeDiary.postedFor}
                              onChange={(e) => handleFieldChange('postedFor', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Next Hearing Date</label>
                            <input
                              type="text"
                              value={activeDiary.nextHearingDate}
                              onChange={(e) => handleFieldChange('nextHearingDate', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Attended By</label>
                            <input
                              type="text"
                              value={activeDiary.attendedBy}
                              onChange={(e) => handleFieldChange('attendedBy', e.target.value)}
                              className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium"
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  /* WORKSPACE PLACEHOLDER */
                  <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex-1 flex flex-col items-center justify-center text-center min-h-[600px] my-auto">
                    <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
                      <FileCheck2 className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="font-display font-bold text-gray-950 text-lg">Layout Preservation Document Workspace</h3>
                    <p className="text-xs text-gray-400 mt-2 max-w-md leading-relaxed">
                      Transform scanned police case diaries into pristine editable Word forms. Adjust margins, add/remove accused rows, and generate formatted docx files.
                    </p>
                    
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 text-left max-w-lg bg-gray-50/50 border border-gray-100 p-5 rounded-2xl">
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-gray-800">1. Reconstruct Layout</span>
                        <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                          Upload your Case Diary PDF. The system parses structural grids, accused lists, dates, and typewriter texts.
                        </p>
                      </div>
                      <div className="w-px bg-gray-200 hidden sm:block"></div>
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-gray-800">2. Interactive Word Compilation</span>
                        <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                          Edit parameters right inside your browser workspace. Export high-fidelity Microsoft Word documents instantly.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer bar */}
      <footer className="border-t border-gray-200 bg-white py-6 px-6 text-center text-[10px] text-gray-400 font-medium">
        <p>DocuForge Case Diary Reconstruction Workspace • Powered securely by Google Cloud Platform & Gemini</p>
      </footer>
    </div>
  );
}
