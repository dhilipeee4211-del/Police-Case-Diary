export interface Accused {
  sNo: string;
  nameAndAddress: string;
}

export interface CaseDiary {
  id: string; // generated client-side or server-side (e.g. index-based)
  policeStation: string;
  district: string;
  crNoAndSecOfLaw: string;
  dateTimeAndPlaceOfOccurrence: string;
  dateOfCd: string;
  dateOfReportTime: string;
  complainant: string;
  accusedList: Accused[];
  propertyLostDetails: string;
  recoveredPropertyDetails: string;
  dateOfPreviousCaseDiary: string;
  stageOfTheCase: string;
  courtRefNo: string;
  hearingNo: string;
  courtNameAndPlace: string;
  whetherMagistratePresent: string; // 'YES' / 'NO'
  whetherAppPpPresent: string; // 'YES' / 'NO'
  whetherDefenceCounselPresent: string; // 'YES' / 'NO'
  noOfPwsCited: string;
  noOfPwsExaminedSoFar: string;
  noOfPwsExaminedToday: string;
  totalNoOfAccusedCharged: string;
  totalNoOfAccusedPresent: string; // NEW: matches reference doc's "TOTAL NO. OF ACCUSED PRESENT"
  noOfAccusedPresent: string;
  noOfAccusedAbsent: string;
  remarks: string; // Full text including English/Tamil transcriptions/summaries
  postedFor: string;
  nextHearingDate: string;
  attendedBy: string;
  isSavedDraft?: boolean;
  dbId?: string;
}

export interface SavedDatabase {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  diaries?: CaseDiary[];
  diaryCount?: number;
  synced?: boolean;
}

// --- Reconstruction Engine Types ---

export type QueueState = 'idle' | 'processing' | 'paused' | 'cancelled' | 'error' | 'completed';

export type ChunkStatus = 'pending' | 'processing' | 'completed' | 'retrying' | 'failed' | 'paused' | 'cancelled';

export interface ReconstructionChunk {
  index: number;
  startPage: number;
  endPage: number;
  data: string; // Base64 PDF bytes or text string
  status: ChunkStatus;
  error?: string;
  retryCount: number;
}

export interface ReconstructionQueue {
  id: string;
  filename: string;
  mode: 'free' | 'direct';
  chunks: ReconstructionChunk[];
  currentChunkIndex: number;
  totalPages: number;
  startPageOffset: number;
  gatewayDbName: string;
  gatewayDbId: string | null;
  activeKeyIndex: number;
  concurrencyLimit: number;
  timestamp: number;
  resumeToken?: string;
}

export interface ApiKeyStatus {
  key: string;
  index: number;
  status: 'active' | 'exhausted';
  requestsProcessed: number;
  lastUsed: number;
  errorMessage?: string;
}

export interface ProgressMetadata {
  pdfId: string;
  filename: string;
  currentPage: number;
  completedPages: number[];
  failedPages: number[];
  remainingPages: number[];
  queueState: QueueState;
  currentBatch: number;
  retryCount: number;
  apiKeyIndex: number;
  timestamp: number;
  resumeToken?: string;
}