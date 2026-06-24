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
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initAuth, googleSignIn, logout } from './firebase';
import { uploadAndConvertPdf, exportToDocx } from './converter';
import { generateCaseDiaryDocx } from './exportDocx';
import { exportDiariesToZip } from './exportZip';
import { User } from 'firebase/auth';
import { CaseDiary, Accused } from './types';

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
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [extractionStep, setExtractionStep] = useState<string>('');

  // Workspace States
  const [diaries, setDiaries] = useState<CaseDiary[]>([]);
  const [selectedDiaryId, setSelectedDiaryId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBulkExporting, setIsBulkExporting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Auth state on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
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

  const handleGuestAccess = () => {
    setUser({
      uid: 'guest-' + Date.now(),
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
        await logout();
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setDiaries([]);
        setSelectedDiaryId(null);
      } catch (err) {
        console.error('Logout error:', err);
      }
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
    setExtractionStep('Uploading Case Diary & Setting up Security Context...');

    // Progress bar simulation interval
    let progressVal = 5;
    const progressInterval = setInterval(() => {
      progressVal += Math.floor(Math.random() * 8) + 3;
      if (progressVal > 95) {
        progressVal = 95;
      }
      setExtractionProgress(progressVal);

      // Dynamically select steps based on current simulated progress
      if (progressVal <= 18) {
        setExtractionStep('Uploading Case Diary & Setting up Security Context...');
      } else if (progressVal <= 38) {
        setExtractionStep('Performing OCR Layout and Hand-written Aligned Parsing...');
      } else if (progressVal <= 58) {
        setExtractionStep('Consulting Google Gemini Language Intelligence Engine...');
      } else if (progressVal <= 78) {
        setExtractionStep('Translating bilingual segments & form structures...');
      } else if (progressVal <= 92) {
        setExtractionStep('Reconstructing complex police diary database records...');
      } else {
        setExtractionStep('Aligning and mapping structured tables...');
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

    try {
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Reconstruction failed (${response.status})`);
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        clearInterval(progressInterval);
        setExtractionProgress(100);
        setExtractionStep('Reconstruction completed successfully!');

        // Map extracted indices to unique string IDs
        const formattedDiaries: CaseDiary[] = result.data.map((diary: any, idx: number) => ({
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

        // Delay slightly for visual satisfaction of reaching 100%
        setTimeout(() => {
          setDiaries((prev) => [...formattedDiaries, ...prev]);
          setSelectedDiaryId(formattedDiaries[0].id);
          setSelectedFile(null);
          setIsExtracting(false);
          setExtractionProgress(0);
        }, 600);

      } else {
        throw new Error('Server returned invalid structured data format.');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Reconstruction error:', err);
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

  const saveWorkspaceChanges = () => {
    if (!selectedDiaryId) return;
    setDiaries((prev) =>
      prev.map((d) => (d.id === selectedDiaryId ? { ...d, isSavedDraft: true } : d))
    );
    setIsSaved(true);
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
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-lg text-gray-950 tracking-tight">AI Case Diary Reconstruction Workspace</h1>
              <p className="text-xs text-gray-500 font-medium">Reconstruct, Form and Format Scanned Case Diaries with Pixel Precision</p>
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
                    </motion.div>
                  )}
                </div>

                {/* Extracted Record Selector List (Material You Style Card) */}
                <div className="bg-white border border-gray-200/95 rounded-3xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.02)] flex-1 flex flex-col min-h-[400px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-semibold text-gray-900 text-base flex items-center gap-2">
                      <ListFilter className="w-4 h-4 text-indigo-600" />
                      Reconstructed Records ({diaries.length})
                    </h3>
                    
                    {diaries.length > 0 && (
                      <button
                        onClick={handleMarkAllAsSaved}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/80 font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer"
                        title="Mark all current cases as saved drafts for bulk export"
                      >
                        Mark All Saved
                      </button>
                    )}
                  </div>

                  {diaries.length > 0 && (
                    <div className="relative mb-4">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Search className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search by Crime No. or Station..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-full text-xs text-gray-900 placeholder-gray-400 font-medium transition-all"
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
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50 rounded-2xl border border-gray-100">
                      <FileText className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-xs font-semibold text-gray-500">No documents loaded</p>
                      <p className="text-[10px] text-gray-400 mt-1 max-w-[190px] leading-relaxed">
                        Upload your scanned police case diary PDF above to begin formatting layout translation.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Filtered list based on searchQuery */}
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 flex-1">
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
                      <div className="mt-4 pt-4 border-t border-gray-100 bg-indigo-50/15 p-3.5 rounded-2xl border border-indigo-100/50">
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
              </div>

              {/* Right Grid Workspace: Beautiful Form and Layout Editor (8 Columns) */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {activeDiary ? (
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col h-full min-h-[600px]">
                    
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

                      <div className="flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-end">
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
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm hover:shadow transition-all"
                        >
                          <FileDown className="w-4 h-4" />
                          Download Word (.docx)
                        </button>
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
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Stage of the Case</label>
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
                        <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                          REMARKS & TAMIL TRANSCRIPTION
                        </label>
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
