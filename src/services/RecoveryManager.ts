import { QueueManager } from './QueueManager';
import { StorageManager } from './StorageManager';
import { Logger } from './Logger';
import { ReconstructionQueue } from '../types';
import { NotificationService } from './NotificationService';

class RecoveryManagerClass {
  private userId: string = '';
  private initialized = false;

  public initialize(userId: string): void {
    if (this.initialized || !userId) return;
    this.userId = userId;
    this.initialized = true;

    Logger.log('Initializing Recovery Manager service...', 'SYSTEM');

    // 1. Setup online/offline listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      Logger.log(`Network status listeners registered. Browser is currently ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}.`, 'SYSTEM');
    }

    // 2. Setup browser refresh / crash recovery check
    this.checkAndRecoverQueue();
  }

  private handleOnline(): void {
    Logger.log('📡 Internet connection restored. Resuming reconstruction automatically...', 'SUCCESS');
    NotificationService.success('Internet restored. Resuming reconstruction...');
    
    const status = QueueManager.getStatus();
    if (status.state === 'paused' || status.state === 'error') {
      QueueManager.resume();
    }
  }

  private handleOffline(): void {
    Logger.log('📡 Internet connection lost. Pausing reconstruction to protect queue progress...', 'WARNING');
    NotificationService.warn('You are offline. Reconstruction paused automatically.');
    
    const status = QueueManager.getStatus();
    if (status.state === 'processing') {
      QueueManager.pause();
    }
  }

  /**
   * Checks IndexedDB for an unfinished reconstruction task and auto-recovers/resumes it.
   */
  private async checkAndRecoverQueue(): Promise<void> {
    try {
      const recoveredQueue = await StorageManager.getIndexedItem<ReconstructionQueue>('gateway_extraction_queue');
      
      if (recoveredQueue && recoveredQueue.chunks) {
        const completedCount = recoveredQueue.chunks.filter(c => c.status === 'completed').length;
        const totalCount = recoveredQueue.chunks.length;
        
        if (completedCount < totalCount) {
          Logger.log(`Detected unfinished reconstruction queue for "${recoveredQueue.filename}" (${completedCount}/${totalCount} batches finished).`, 'SYSTEM');
          
          // Re-create the File instance from the filename (stub)
          const stubFile = new File([], recoveredQueue.filename, { type: 'application/pdf' });
          
          // Load the queue back into QueueManager
          await QueueManager.recoverQueue(recoveredQueue, stubFile, this.userId);
          
          // Automatically resume processing
          Logger.log('Auto-recovering and resuming reconstruction pipeline...', 'SYSTEM');
          NotificationService.info(`Auto-recovered progress. Resuming reconstruction from batch ${completedCount + 1}...`);
          QueueManager.startProcessing();
        }
      }
    } catch (err) {
      console.warn('Failed to perform automatic recovery checks:', err);
    }
  }
}

export const RecoveryManager = new RecoveryManagerClass();
