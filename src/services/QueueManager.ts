import { 
  CaseDiary, 
  ReconstructionChunk, 
  ReconstructionQueue, 
  QueueState,
  ProgressMetadata
} from '../types';
import { Logger } from './Logger';
import { StorageManager } from './StorageManager';
import { ApiKeyManager } from './ApiKeyManager';
import { RetryManager } from './RetryManager';
import { GeminiClient, QuotaExhaustedError } from './GeminiClient';
import { SupabaseService } from './SupabaseService';
import { PdfReader } from './PdfReader';
import { ChunkProcessor } from './ChunkProcessor';
import { ProgressManager } from './ProgressManager';
import { ResumeManager } from './ResumeManager';
import { NotificationService } from './NotificationService';

export interface QueueManagerStatus {
  state: QueueState;
  progress: number;
  currentChunkIndex: number;
  totalChunks: number;
  processedPages: number;
  totalPages: number;
  speed: number; // pages per minute
  eta: number; // seconds remaining
  elapsedTime: number; // seconds
  activeKey: string | null;
  activeKeyIndex: number;
  concurrencyLimit: number;
  dbId: string | null;
  dbName: string;
  diaries: CaseDiary[];
  error?: string;
}

export type QueueManagerListener = (status: QueueManagerStatus) => void;

class QueueManagerService {
  private currentQueue: ReconstructionQueue | null = null;
  private queueState: QueueState = 'idle';
  private targetFile: File | null = null;
  private accumulatedDiaries: CaseDiary[] = [];
  private userId: string = '';
  private currentError?: string;

  // Telemetry properties
  private startTime: number = 0;
  private totalElapsedSeconds: number = 0;
  private chunkTimes: number[] = []; // durations of completed chunk runs
  private timerIntervalId?: number;

  private listeners: Set<QueueManagerListener> = new Set();
  private activePromises: Set<Promise<void>> = new Set();

  constructor() {
    this.startTimer();
  }

  // Timer to update elapsed seconds and ETA continuously
  private startTimer(): void {
    if (typeof window === 'undefined') return;
    
    this.timerIntervalId = window.setInterval(() => {
      if (this.queueState === 'processing') {
        this.totalElapsedSeconds++;
        this.notifyListeners();
      }
    }, 1000) as unknown as number;
  }

  public getStatus(): QueueManagerStatus {
    const totalChunks = this.currentQueue?.chunks.length || 0;
    const currentChunkIndex = this.currentQueue?.currentChunkIndex || 0;
    
    // Calculate processed pages
    let processedPages = 0;
    if (this.currentQueue) {
      this.currentQueue.chunks.forEach(chunk => {
        if (chunk.status === 'completed') {
          processedPages += (chunk.endPage - chunk.startPage + 1);
        }
      });
    }

    const totalPages = this.currentQueue?.totalPages || 0;
    const progress = totalPages > 0 ? Math.min(100, Math.floor((processedPages / totalPages) * 100)) : 0;

    // Calculate Speed (pages/min) and ETA (seconds)
    let speed = 0;
    let eta = 0;
    
    if (processedPages > 0 && this.totalElapsedSeconds > 0) {
      speed = (processedPages / this.totalElapsedSeconds) * 60;
      
      const remainingPages = totalPages - processedPages;
      if (remainingPages > 0 && speed > 0) {
        eta = Math.ceil((remainingPages / speed) * 60);
      }
    }

    return {
      state: this.queueState,
      progress,
      currentChunkIndex,
      totalChunks,
      processedPages,
      totalPages,
      speed: Math.round(speed * 10) / 10,
      eta,
      elapsedTime: this.totalElapsedSeconds,
      activeKey: ApiKeyManager.getActiveKey(),
      activeKeyIndex: ApiKeyManager.getActiveKeyIndex(),
      concurrencyLimit: this.currentQueue?.concurrencyLimit || 1,
      dbId: this.currentQueue?.gatewayDbId || null,
      dbName: this.currentQueue?.gatewayDbName || '',
      diaries: ProgressManager.filterMetadataDiaries(this.accumulatedDiaries),
      error: this.currentError
    };
  }

  public subscribe(listener: QueueManagerListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(l => {
      try {
        l(status);
      } catch (err) {
        console.error('Error notifying QueueManager listener:', err);
      }
    });
  }

  /**
   * Enqueue a new PDF file for Case Diary reconstruction.
   */
  public async enqueue(
    file: File,
    mode: 'free' | 'direct',
    config: {
      dbName: string;
      startPage: number;
      chunkSize: number;
      concurrency: number;
      userId: string;
      dbId?: string | null;
    }
  ): Promise<void> {
    if (this.queueState === 'processing') {
      Logger.log('Cannot enqueue, reconstruction is already running.', 'WARNING');
      return;
    }

    this.targetFile = file;
    this.userId = config.userId;
    this.queueState = 'idle';
    this.currentError = undefined;
    this.totalElapsedSeconds = 0;
    this.chunkTimes = [];
    this.accumulatedDiaries = [];

    Logger.log(`Preparing case diary reconstruction for "${file.name}"...`, 'SYSTEM');
    
    try {
      const totalPages = await PdfReader.getPageCount(file);
      const startPage = Math.max(1, config.startPage);
      
      if (startPage > totalPages) {
        throw new Error(`Start page (${startPage}) exceeds total pages (${totalPages}) in document.`);
      }

      // Slice the PDF pages into chunk definitions
      const chunks: ReconstructionChunk[] = [];
      let index = 0;
      for (let p = startPage; p <= totalPages; p += config.chunkSize) {
        const endP = Math.min(p + config.chunkSize - 1, totalPages);
        chunks.push({
          index,
          startPage: p,
          endPage: endP,
          data: '', // dynamically read on process time to optimize memory
          status: 'pending',
          retryCount: 0
        });
        index++;
      }

      this.currentQueue = {
        id: `queue-${Date.now()}`,
        filename: file.name,
        mode,
        chunks,
        currentChunkIndex: 0,
        totalPages,
        startPageOffset: startPage - 1,
        gatewayDbName: config.dbName,
        gatewayDbId: config.dbId || null,
        activeKeyIndex: ApiKeyManager.getActiveKeyIndex(),
        concurrencyLimit: config.concurrency,
        timestamp: Date.now()
      };

      // Clean old state in IndexedDB and serialize the new queue
      await StorageManager.removeIndexedItem('gateway_extracted_diaries');
      await StorageManager.setIndexedItem('gateway_extraction_queue', this.currentQueue);
      
      this.notifyListeners();
      Logger.log(`Document successfully queued. ${totalPages} pages segmented into ${chunks.length} chunks.`, 'SUCCESS');
      
      // Start processing immediately
      this.startProcessing();

    } catch (err: any) {
      this.queueState = 'error';
      this.currentError = err.message || err;
      this.notifyListeners();
      Logger.log(`Failed to queue document: ${this.currentError}`, 'ERROR');
      NotificationService.error(`Reconstruction setup failed: ${this.currentError}`);
    }
  }

  /**
   * Recovers an incomplete queue found in IndexedDB on application start or page refresh.
   */
  public async recoverQueue(
    recovered: ReconstructionQueue,
    file: File,
    userId: string
  ): Promise<void> {
    this.currentQueue = recovered;
    this.targetFile = file;
    this.userId = userId;
    this.queueState = 'paused';
    
    // Load previously accumulated diaries
    try {
      const cached = await StorageManager.getIndexedItem<CaseDiary[]>('gateway_extracted_diaries');
      if (cached) {
        this.accumulatedDiaries = cached;
      }
      Logger.log(`Recovered previous progress checkpoint. ${this.getStatus().processedPages} pages completed.`, 'SYSTEM');
    } catch (e) {
      console.warn('Failed to load cached diaries on recovery:', e);
    }

    this.notifyListeners();
  }

  public dismissRecovery(): void {
    StorageManager.removeIndexedItem('gateway_extraction_queue');
    StorageManager.removeIndexedItem('gateway_extracted_diaries');
    this.currentQueue = null;
    this.accumulatedDiaries = [];
    this.queueState = 'idle';
    this.notifyListeners();
  }

  /**
   * Start or resume the queue processing.
   */
  public startProcessing(): void {
    if (!this.currentQueue || !this.targetFile) {
      Logger.log('No active queue to process.', 'WARNING');
      return;
    }

    if (this.queueState === 'processing') return;

    this.queueState = 'processing';
    this.currentError = undefined;
    this.startTime = Date.now();
    this.notifyListeners();

    Logger.log('Starting queue execution loop...', 'SYSTEM');
    this.executeLoop();
  }

  public pause(): void {
    if (this.queueState !== 'processing') return;
    
    this.queueState = 'paused';
    Logger.log('Processing paused. Safely checkpointing queue state...', 'SYSTEM');
    this.notifyListeners();
    NotificationService.info('Reconstruction paused. You can resume later.');
  }

  public async resume(): Promise<void> {
    if (this.queueState !== 'paused' && this.queueState !== 'error') return;

    Logger.log('Resuming reconstruction...', 'SYSTEM');
    
    // Sync any offline records first
    await SupabaseService.syncPendingJobs(this.userId).catch(() => {});

    this.startProcessing();
  }

  public async cancel(): Promise<void> {
    this.queueState = 'cancelled';
    Logger.log('Cancelling queue processing...', 'SYSTEM');

    // Clean active jobs
    this.activePromises.clear();

    // Persist completed items but clean recovery state
    await StorageManager.removeIndexedItem('gateway_extraction_queue');
    await StorageManager.removeIndexedItem('gateway_extracted_diaries');

    this.notifyListeners();
    NotificationService.warn('Reconstruction cancelled.');
  }

  public retryFailed(): void {
    if (!this.currentQueue) return;

    // Reset failed chunks to pending
    this.currentQueue.chunks.forEach(chunk => {
      if (chunk.status === 'failed') {
        chunk.status = 'pending';
        chunk.retryCount = 0;
      }
    });

    this.queueState = 'idle';
    this.startProcessing();
  }

  /**
   * Internal queue execution loop managing concurrency control.
   */
  private async executeLoop(): Promise<void> {
    if (!this.currentQueue || !this.targetFile) return;

    // Concurrency control: limit concurrently active tasks
    const limit = this.currentQueue.concurrencyLimit || 1;

    while (this.queueState === 'processing') {
      // Find the next chunks that are pending
      const pendingChunks = this.currentQueue.chunks.filter(c => c.status === 'pending');
      
      if (pendingChunks.length === 0) {
        // If all chunks are completed or failed, we are done
        const activeTasks = this.activePromises.size;
        if (activeTasks === 0) {
          this.finishQueue();
        }
        break;
      }

      // Check if we have room under concurrency limit
      if (this.activePromises.size < limit) {
        const nextChunk = pendingChunks[0];
        
        // Mark chunk as processing
        nextChunk.status = 'processing';
        this.currentQueue.currentChunkIndex = nextChunk.index;
        this.notifyListeners();

        // Launch async chunk processor task
        const chunkPromise = this.processChunkTask(nextChunk);
        this.activePromises.add(chunkPromise);

        chunkPromise.finally(() => {
          this.activePromises.delete(chunkPromise);
          // Trigger loop check
          this.executeLoop();
        });
      } else {
        // Wait for at least one active promise to complete
        await Promise.race(Array.from(this.activePromises));
      }
    }
  }

  /**
   * Tasks to parse, call Gemini, validate output, and insert into Supabase for a single chunk.
   */
  private async processChunkTask(chunk: ReconstructionChunk): Promise<void> {
    if (!this.currentQueue || !this.targetFile || this.queueState !== 'processing') return;

    const chunkIdStr = `Chunk ${chunk.index + 1} (Pages ${chunk.startPage} to ${chunk.endPage})`;
    const chunkStart = Date.now();

    try {
      // Extract data (pages sliced, text OCRed) and trigger API call
      const extractedDiaries = await ChunkProcessor.processChunk(
        this.targetFile,
        this.currentQueue.mode,
        chunk.startPage,
        chunk.endPage,
        (step) => {
          // Broadcast progress steps to logger
          Logger.log(`[${chunkIdStr}] ${step}`, 'INFO');
        },
        chunk.index,
        this.currentQueue.chunks.length
      );

      // Append new diaries
      const combined = [...this.accumulatedDiaries, ...extractedDiaries];
      
      // Deduplicate case records using ResumeManager constraints
      const deduplicated = ResumeManager.deduplicateDiaries(combined);

      // Create checkpoint metadata to save in Supabase as a special diary entry
      const processedPagesList: number[] = [];
      this.currentQueue.chunks.forEach(c => {
        if (c.status === 'completed' || c.index === chunk.index) {
          for (let p = c.startPage; p <= c.endPage; p++) {
            processedPagesList.push(p);
          }
        }
      });

      const nextChunkIdx = chunk.index + 1;
      const progressMeta: ProgressMetadata = {
        pdfId: this.currentQueue.id,
        filename: this.currentQueue.filename,
        currentPage: chunk.endPage,
        completedPages: processedPagesList,
        failedPages: this.currentQueue.chunks.filter(c => c.status === 'failed').map(c => c.index),
        remainingPages: this.currentQueue.chunks.filter(c => c.status === 'pending').map(c => c.index),
        queueState: this.queueState,
        currentBatch: nextChunkIdx,
        retryCount: chunk.retryCount,
        apiKeyIndex: ApiKeyManager.getActiveKeyIndex(),
        timestamp: Date.now()
      };

      const metaDiary = ProgressManager.serializeMetadataToDiary(progressMeta);
      
      // Remove old metadata diary if exists and add new one
      const withoutOldMeta = deduplicated.filter(d => d.id !== '__reconstruction_metadata__');
      withoutOldMeta.push(metaDiary);

      this.accumulatedDiaries = withoutOldMeta;

      // Update status
      chunk.status = 'completed';
      this.currentQueue.currentChunkIndex = nextChunkIdx;

      // Write results to IndexedDB recovery cache
      await StorageManager.setIndexedItem('gateway_extracted_diaries', this.accumulatedDiaries);
      await StorageManager.setIndexedItem('gateway_extraction_queue', this.currentQueue);

      // Continuously save to Supabase
      if (this.userId) {
        const savedDb = await SupabaseService.saveDatabase(
          this.currentQueue.gatewayDbName,
          this.accumulatedDiaries,
          this.userId,
          this.currentQueue.gatewayDbId || undefined
        );
        this.currentQueue.gatewayDbId = savedDb.id;
        
        // Re-write queue checkpoint to include the persistent database ID
        await StorageManager.setIndexedItem('gateway_extraction_queue', this.currentQueue);
      }

      this.chunkTimes.push(Date.now() - chunkStart);
      Logger.log(`Successfully completed structuring for ${chunkIdStr}.`, 'SUCCESS');
      this.notifyListeners();

    } catch (err: any) {
      if (this.queueState !== 'processing') return;

      const isQuotaErr = err instanceof QuotaExhaustedError;

      if (isQuotaErr) {
        // Quota Limit Exhausted: pause processing, alert user
        this.queueState = 'paused';
        this.currentError = err.message;
        chunk.status = 'pending'; // revert to pending to retry on resume

        Logger.log(`[${chunkIdStr}] Quota Limit Exhausted. Pause queue checkpoint saved.`, 'ERROR');
        this.notifyListeners();
        NotificationService.error(`Gemini API Quota Exceeded. Rotating/adding keys or switching to Free OCR mode is recommended.`);
        return;
      }

      // Handle transient vs terminal error checks
      const isRetryable = RetryManager.isRetryable(err);
      
      if (isRetryable && chunk.retryCount < RetryManager.getMaxRetries()) {
        chunk.status = 'retrying';
        chunk.retryCount++;
        const delay = RetryManager.getDelay(chunk.retryCount - 1);
        
        Logger.log(`[${chunkIdStr}] Transient error: ${err.message || err}. Scheduling retry ${chunk.retryCount}/${RetryManager.getMaxRetries()} in ${delay / 1000}s...`, 'WARNING');
        this.notifyListeners();
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (this.queueState === 'processing') {
          chunk.status = 'pending';
          this.notifyListeners();
          // Loop check will handle triggering execution
        }
      } else {
        // Terminal error or retries exhausted
        chunk.status = 'failed';
        this.queueState = 'error';
        this.currentError = err.message || String(err);
        
        Logger.log(`[${chunkIdStr}] Reconstruction failed: ${this.currentError}`, 'ERROR');
        this.notifyListeners();
        NotificationService.error(`Reconstruction error at page ${chunk.startPage}: ${this.currentError}`);
      }
    }
  }

  /**
   * Queue finished execution.
   */
  private async finishQueue(): Promise<void> {
    const hasFailed = this.currentQueue?.chunks.some(c => c.status === 'failed') || false;

    if (hasFailed) {
      this.queueState = 'error';
      this.currentError = 'Reconstruction finished, but some page batches failed to process.';
      Logger.log('Queue complete, but some pages failed.', 'ERROR');
      NotificationService.warn('Reconstruction finished with warnings.');
    } else {
      this.queueState = 'completed';
      Logger.log('Case Diary reconstruction pipeline completed successfully! Rendering in Workspace.', 'SUCCESS');
      NotificationService.success('Case Diary Reconstruction Completed successfully!');
      
      // Clean up recovery caches since finished
      await StorageManager.removeIndexedItem('gateway_extraction_queue');
      await StorageManager.removeIndexedItem('gateway_extracted_diaries');
      
      // Save a final metadata record reflecting the 'completed' state
      if (this.currentQueue && this.userId) {
        const processedPagesList: number[] = [];
        for (let p = this.currentQueue.startPageOffset + 1; p <= this.currentQueue.totalPages; p++) {
          processedPagesList.push(p);
        }

        const progressMeta: ProgressMetadata = {
          pdfId: this.currentQueue.id,
          filename: this.currentQueue.filename,
          currentPage: this.currentQueue.totalPages,
          completedPages: processedPagesList,
          failedPages: [],
          remainingPages: [],
          queueState: 'completed',
          currentBatch: this.currentQueue.chunks.length,
          retryCount: 0,
          apiKeyIndex: ApiKeyManager.getActiveKeyIndex(),
          timestamp: Date.now()
        };

        const metaDiary = ProgressManager.serializeMetadataToDiary(progressMeta);
        const withoutOldMeta = this.accumulatedDiaries.filter(d => d.id !== '__reconstruction_metadata__');
        withoutOldMeta.push(metaDiary);
        this.accumulatedDiaries = withoutOldMeta;

        await SupabaseService.saveDatabase(
          this.currentQueue.gatewayDbName,
          this.accumulatedDiaries,
          this.userId,
          this.currentQueue.gatewayDbId || undefined
        );
      }
    }

    this.notifyListeners();
  }
}

export const QueueManager = new QueueManagerService();
