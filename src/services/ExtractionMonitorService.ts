/**
 * ExtractionMonitorService
 *
 * A singleton service that aggregates live extraction telemetry from:
 *   - QueueManager  (session state, chunk progress, speed, ETA)
 *   - Logger        (terminal log entries, capped at 500)
 *   - ApiKeyManager (key statuses, rotation history)
 *
 * It exposes a MonitorSnapshot that React components can subscribe to.
 * Every 5 seconds during an active session it batches a sync to Supabase
 * via POST /api/monitor/sync so cross-device monitoring is possible.
 */

import { Logger, LogMessage } from './Logger';
import { ApiKeyManager } from './ApiKeyManager';
import { QueueManager, QueueManagerStatus } from './QueueManager';

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface ChunkRecord {
  chunkIndex: number;
  startPage: number;
  endPage: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  databaseSaved: boolean;
  importStatus: 'pending' | 'imported' | 'failed';
  processingTimeMs: number;
  apiKeyLabel: string;
  retryCount: number;
}

export interface ImportStats {
  cachedChunks: number;
  importedChunks: number;
  pendingImports: number;
  failedImports: number;
  duplicateSkipped: number;
  updatedExisting: number;
  backupCreated: number;
  speedRecordsPerSec: number;
}

export interface DatabaseActivity {
  productionRecords: number;
  cachedChunks: number;
  importedChunks: number;
  pendingImports: number;
  duplicateSkipped: number;
  backupRecords: number;
  databaseWrites: number;
  databaseFailures: number;
  lastInsertTime: number;
  lastUpdateTime: number;
}

export interface HealthIndicators {
  extractionEngine: 'healthy' | 'degraded' | 'offline';
  databaseConnection: 'connected' | 'disconnected';
  supabase: 'healthy' | 'degraded' | 'offline';
  geminiApi: 'connected' | 'quota_exhausted' | 'offline';
  queue: 'running' | 'paused' | 'idle' | 'error';
  cache: 'saving' | 'idle' | 'error';
  importEngine: 'active' | 'idle' | 'error';
  searchIndex: 'ready' | 'building' | 'offline';
}

export interface MonitorSnapshot {
  // Session
  sessionId: string | null;
  pdfName: string;
  status: string;
  userId: string;
  userEmail: string;
  device: string;

  // Live Processing
  currentPage: number;
  totalPages: number;
  currentChunk: number;
  totalChunks: number;
  chunkSize: number;
  queueStatus: string;
  speedSecPerPage: number;
  avgChunkTimeSec: number;
  elapsedSeconds: number;
  etaSeconds: number;
  estimatedMemoryMB: number;

  // Cache Status
  completedPages: number;
  remainingPages: number;
  lastDbSaveTime: number;
  lastCacheUpdateTime: number;
  cacheSizeKB: number;
  chunkCacheCount: number;
  importQueue: number;
  autoSaveEnabled: boolean;

  // API Rotation
  rotationMode: string;
  configuredKeys: number;
  healthyKeys: number;
  waitingKeys: number;
  exhaustedKeys: number;
  activeKeyIndex: number;
  currentModel: string;
  currentRetry: number;
  maxRetry: number;
  lastRotationTime: number;
  lastSuccessfulRequest: number;
  responseTimeMs: number;
  tokensIn: number;
  tokensOut: number;

  // Resume
  resumeAvailable: boolean;
  resumeFromPage: number;
  resumeFromChunk: number;
  cachedChunksCount: number;
  remainingChunks: number;
  pauseReason: string;

  // Sub-objects
  chunks: ChunkRecord[];
  logs: LogMessage[];
  importStats: ImportStats;
  dbActivity: DatabaseActivity;
  health: HealthIndicators;
}

export type MonitorListener = (snapshot: MonitorSnapshot) => void;

// ─── Service ─────────────────────────────────────────────────────────────────

class ExtractionMonitorServiceClass {
  private snapshot: MonitorSnapshot = this.makeEmptySnapshot();
  private listeners: Set<MonitorListener> = new Set();
  private chunkStartTimes: Map<number, number> = new Map();
  private chunkRecords: Map<number, ChunkRecord> = new Map();
  private logs: LogMessage[] = [];
  private dbWrites: number = 0;
  private dbFailures: number = 0;
  private lastInsertTime: number = 0;
  private lastUpdateTime: number = 0;
  private lastSyncTime: number = 0;
  private syncIntervalId?: number;
  private pendingLogBatch: LogMessage[] = [];

  constructor() {
    this.init();
  }

  private init(): void {
    // Subscribe to QueueManager for live extraction status
    QueueManager.subscribe((status: QueueManagerStatus) => {
      this.handleQueueUpdate(status);
    });

    // Subscribe to Logger for terminal log entries
    Logger.subscribe((allLogs: LogMessage[]) => {
      this.logs = allLogs.slice(-500); // cap at 500
      // Collect new logs for batched Supabase sync
      const newLogs = allLogs.slice(this.pendingLogBatch.length);
      this.pendingLogBatch.push(...newLogs);
      this.rebuildSnapshot();
    });

    // Start 5-second Supabase sync interval
    if (typeof window !== 'undefined') {
      this.syncIntervalId = window.setInterval(() => {
        this.batchSyncToSupabase();
      }, 5000) as unknown as number;
    }
  }

  private handleQueueUpdate(status: QueueManagerStatus): void {
    const queue = (QueueManager as any).currentQueue;

    // Track chunk start times and update chunk records
    if (queue?.chunks) {
      for (const chunk of queue.chunks) {
        const existing = this.chunkRecords.get(chunk.index);
        const activeKeyIdx = ApiKeyManager.getActiveKeyIndex();
        const keyLabel = `Key #${activeKeyIdx + 1}`;

        if (chunk.status === 'processing' && !this.chunkStartTimes.has(chunk.index)) {
          this.chunkStartTimes.set(chunk.index, Date.now());
        }

        const processingTimeMs = chunk.status === 'completed' || chunk.status === 'failed'
          ? (this.chunkStartTimes.has(chunk.index)
            ? Date.now() - this.chunkStartTimes.get(chunk.index)!
            : existing?.processingTimeMs || 0)
          : 0;

        if (chunk.status === 'completed') {
          this.dbWrites++;
          this.lastInsertTime = Date.now();
          this.lastUpdateTime = Date.now();
        }

        this.chunkRecords.set(chunk.index, {
          chunkIndex: chunk.index,
          startPage: chunk.startPage,
          endPage: chunk.endPage,
          status: chunk.status as ChunkRecord['status'],
          databaseSaved: chunk.status === 'completed',
          importStatus: chunk.status === 'completed' ? 'imported' : 'pending',
          processingTimeMs: chunk.status === 'completed' ? processingTimeMs : (existing?.processingTimeMs || 0),
          apiKeyLabel: chunk.status === 'processing' || chunk.status === 'completed'
            ? keyLabel
            : (existing?.apiKeyLabel || '-'),
          retryCount: chunk.retryCount || 0,
        });
      }
    }

    this.rebuildSnapshot();
  }

  private rebuildSnapshot(): void {
    const status = QueueManager.getStatus();
    const queue = (QueueManager as any).currentQueue;
    const keyStatuses = ApiKeyManager.getKeyStatuses();
    const rotHistory = ApiKeyManager.getRotationHistory();

    const healthyKeys = keyStatuses.filter(k => k.status === 'healthy' || k.status === 'active').length;
    const waitingKeys = keyStatuses.filter(k => k.status === 'waiting' || k.status === 'unused').length;
    const exhaustedKeys = keyStatuses.filter(k => k.status === 'quota_exhausted' || k.status === 'auth_failed').length;

    const completedChunks = Array.from(this.chunkRecords.values()).filter(c => c.databaseSaved);
    const pendingChunks = Array.from(this.chunkRecords.values()).filter(c => c.importStatus === 'pending' && c.status !== 'pending');

    // Speed: convert pages/min to sec/page
    const speedSecPerPage = status.speed > 0 ? 60 / status.speed : 0;

    // Average chunk time from completed chunks
    const completedWithTime = completedChunks.filter(c => c.processingTimeMs > 0);
    const avgChunkTimeSec = completedWithTime.length > 0
      ? completedWithTime.reduce((a, c) => a + c.processingTimeMs, 0) / completedWithTime.length / 1000
      : 0;

    // Estimated memory: ~2KB per page + 1KB per chunk record
    const estimatedMemoryMB = Math.round((status.processedPages * 2 + this.chunkRecords.size * 1) / 1024 * 10) / 10;

    // Pause reason detection
    let pauseReason = '';
    if (status.state === 'paused' || status.state === 'error') {
      if (exhaustedKeys >= keyStatuses.length && keyStatuses.length > 0) {
        pauseReason = 'Quota Exceeded – All keys exhausted';
      } else if (status.error) {
        pauseReason = status.error;
      } else {
        pauseReason = 'Manual Pause';
      }
    }

    // Last rotation time from history
    const lastRotation = rotHistory.length > 0 ? rotHistory[rotHistory.length - 1] : null;

    // Cache size estimate: JSON length of all chunk records
    const cacheSizeKB = Math.round(JSON.stringify(Array.from(this.chunkRecords.values())).length / 1024);

    // Health indicators
    const health: HealthIndicators = {
      extractionEngine: status.state === 'processing' ? 'healthy'
        : status.state === 'error' ? 'degraded'
        : 'offline',
      databaseConnection: 'connected',
      supabase: 'healthy',
      geminiApi: exhaustedKeys > 0 && healthyKeys === 0 ? 'quota_exhausted'
        : exhaustedKeys === keyStatuses.length && keyStatuses.length > 0 ? 'offline'
        : 'connected',
      queue: status.state === 'processing' ? 'running'
        : status.state === 'paused' ? 'paused'
        : status.state === 'error' ? 'error'
        : 'idle',
      cache: completedChunks.length > 0 ? 'saving' : 'idle',
      importEngine: pendingChunks.length > 0 ? 'active' : 'idle',
      searchIndex: 'ready',
    };

    // Import stats
    const importStats: ImportStats = {
      cachedChunks: completedChunks.length,
      importedChunks: completedChunks.filter(c => c.importStatus === 'imported').length,
      pendingImports: pendingChunks.length,
      failedImports: Array.from(this.chunkRecords.values()).filter(c => c.importStatus === 'failed').length,
      duplicateSkipped: 0,
      updatedExisting: 0,
      backupCreated: 0,
      speedRecordsPerSec: speedSecPerPage > 0 ? Math.round(10 / speedSecPerPage * 10) / 10 : 0,
    };

    // Database activity
    const dbActivity: DatabaseActivity = {
      productionRecords: status.diaries.length,
      cachedChunks: completedChunks.length,
      importedChunks: importStats.importedChunks,
      pendingImports: pendingChunks.length,
      duplicateSkipped: importStats.duplicateSkipped,
      backupRecords: 0,
      databaseWrites: this.dbWrites,
      databaseFailures: this.dbFailures,
      lastInsertTime: this.lastInsertTime,
      lastUpdateTime: this.lastUpdateTime,
    };

    const deviceInfo = typeof navigator !== 'undefined'
      ? `${navigator.userAgent.split(' ').slice(-2).join(' ')}`
      : 'Unknown';

    this.snapshot = {
      sessionId: queue?.id || null,
      pdfName: queue?.filename || '',
      status: status.state,
      userId: (QueueManager as any).userId || '',
      userEmail: '',
      device: deviceInfo,

      currentPage: status.processedPages,
      totalPages: status.totalPages,
      currentChunk: status.currentChunkIndex,
      totalChunks: status.totalChunks,
      chunkSize: queue?.chunks?.[0]
        ? queue.chunks[0].endPage - queue.chunks[0].startPage + 1
        : 5,
      queueStatus: status.state,
      speedSecPerPage: Math.round(speedSecPerPage * 100) / 100,
      avgChunkTimeSec: Math.round(avgChunkTimeSec * 10) / 10,
      elapsedSeconds: status.elapsedTime,
      etaSeconds: status.eta,
      estimatedMemoryMB,

      completedPages: status.processedPages,
      remainingPages: Math.max(0, status.totalPages - status.processedPages),
      lastDbSaveTime: this.lastInsertTime,
      lastCacheUpdateTime: Date.now(),
      cacheSizeKB,
      chunkCacheCount: completedChunks.length,
      importQueue: pendingChunks.length,
      autoSaveEnabled: true,

      rotationMode: 'Automatic',
      configuredKeys: keyStatuses.length,
      healthyKeys,
      waitingKeys,
      exhaustedKeys,
      activeKeyIndex: status.activeKeyIndex,
      currentModel: 'gemini-1.5-flash-latest',
      currentRetry: 0,
      maxRetry: 5,
      lastRotationTime: lastRotation ? Date.now() : 0,
      lastSuccessfulRequest: this.lastInsertTime,
      responseTimeMs: 0,
      tokensIn: 0,
      tokensOut: 0,

      resumeAvailable: status.state === 'paused' || status.state === 'error',
      resumeFromPage: status.processedPages + 1,
      resumeFromChunk: status.currentChunkIndex,
      cachedChunksCount: completedChunks.length,
      remainingChunks: Math.max(0, status.totalChunks - completedChunks.length),
      pauseReason,

      chunks: Array.from(this.chunkRecords.values()).sort((a, b) => a.chunkIndex - b.chunkIndex),
      logs: this.logs,
      importStats,
      dbActivity,
      health,
    };

    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => {
      try { l(this.snapshot); } catch (e) { /* ignore */ }
    });
  }

  private async batchSyncToSupabase(): Promise<void> {
    if (!this.snapshot.sessionId) return;
    if (this.snapshot.status === 'idle' && this.pendingLogBatch.length === 0) return;

    try {
      const logBatch = this.pendingLogBatch.splice(0, 100); // send max 100 logs per tick

      await fetch('/api/monitor/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: {
            id: this.snapshot.sessionId,
            user_id: this.snapshot.userId,
            user_email: this.snapshot.userEmail,
            pdf_name: this.snapshot.pdfName,
            status: this.snapshot.status,
            total_pages: this.snapshot.totalPages,
            processed_pages: this.snapshot.completedPages,
            total_chunks: this.snapshot.totalChunks,
            current_chunk: this.snapshot.currentChunk,
            concurrency: 1,
            chunk_size: this.snapshot.chunkSize,
            speed_sec_per_page: this.snapshot.speedSecPerPage,
            avg_chunk_time_sec: this.snapshot.avgChunkTimeSec,
            elapsed_seconds: this.snapshot.elapsedSeconds,
            eta_seconds: this.snapshot.etaSeconds,
            db_id: null,
            db_name: '',
            device: this.snapshot.device,
            error: this.snapshot.pauseReason || null,
            created_at: Date.now(),
            updated_at: Date.now(),
          },
          chunks: this.snapshot.chunks.map(c => ({
            id: `${this.snapshot.sessionId}-chunk-${c.chunkIndex}`,
            session_id: this.snapshot.sessionId,
            chunk_index: c.chunkIndex,
            start_page: c.startPage,
            end_page: c.endPage,
            status: c.status,
            database_saved: c.databaseSaved,
            import_status: c.importStatus,
            processing_time_ms: c.processingTimeMs,
            api_key_label: c.apiKeyLabel,
            retry_count: c.retryCount,
            updated_at: Date.now(),
          })),
          logs: logBatch.length > 0 ? [{
            id: 'last_system_activity',
            level: logBatch[logBatch.length - 1].type.toLowerCase(),
            message: logBatch[logBatch.length - 1].message,
            category: 'engine',
            session_id: this.snapshot.sessionId,
            timestamp: logBatch[logBatch.length - 1].timestamp,
          }] : [],
        })
      });

      this.lastSyncTime = Date.now();
    } catch {
      // Non-fatal: batch sync failure does not interrupt extraction
    }
  }

  public subscribe(listener: MonitorListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  public getSnapshot(): MonitorSnapshot {
    return this.snapshot;
  }

  public setUserEmail(email: string): void {
    this.snapshot = { ...this.snapshot, userEmail: email };
  }

  public recordDbWrite(success: boolean): void {
    if (success) {
      this.dbWrites++;
      this.lastInsertTime = Date.now();
      this.lastUpdateTime = Date.now();
    } else {
      this.dbFailures++;
    }
  }

  private makeEmptySnapshot(): MonitorSnapshot {
    return {
      sessionId: null, pdfName: '', status: 'idle', userId: '', userEmail: '', device: '',
      currentPage: 0, totalPages: 0, currentChunk: 0, totalChunks: 0, chunkSize: 5,
      queueStatus: 'idle', speedSecPerPage: 0, avgChunkTimeSec: 0,
      elapsedSeconds: 0, etaSeconds: 0, estimatedMemoryMB: 0,
      completedPages: 0, remainingPages: 0, lastDbSaveTime: 0, lastCacheUpdateTime: 0,
      cacheSizeKB: 0, chunkCacheCount: 0, importQueue: 0, autoSaveEnabled: true,
      rotationMode: 'Automatic', configuredKeys: 0, healthyKeys: 0, waitingKeys: 0,
      exhaustedKeys: 0, activeKeyIndex: 0, currentModel: 'gemini-1.5-flash-latest',
      currentRetry: 0, maxRetry: 5, lastRotationTime: 0, lastSuccessfulRequest: 0,
      responseTimeMs: 0, tokensIn: 0, tokensOut: 0,
      resumeAvailable: false, resumeFromPage: 0, resumeFromChunk: 0,
      cachedChunksCount: 0, remainingChunks: 0, pauseReason: '',
      chunks: [], logs: [],
      importStats: {
        cachedChunks: 0, importedChunks: 0, pendingImports: 0,
        failedImports: 0, duplicateSkipped: 0, updatedExisting: 0,
        backupCreated: 0, speedRecordsPerSec: 0,
      },
      dbActivity: {
        productionRecords: 0, cachedChunks: 0, importedChunks: 0,
        pendingImports: 0, duplicateSkipped: 0, backupRecords: 0,
        databaseWrites: 0, databaseFailures: 0, lastInsertTime: 0, lastUpdateTime: 0,
      },
      health: {
        extractionEngine: 'offline', databaseConnection: 'disconnected',
        supabase: 'offline', geminiApi: 'offline',
        queue: 'idle', cache: 'idle', importEngine: 'idle', searchIndex: 'ready',
      },
    };
  }
}

export const ExtractionMonitorService = new ExtractionMonitorServiceClass();
