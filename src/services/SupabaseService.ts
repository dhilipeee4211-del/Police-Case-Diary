import { SavedDatabase, CaseDiary } from '../types';
import { StorageManager } from './StorageManager';
import { Logger } from './Logger';

interface PendingSaveJob {
  dbId: string;
  userId: string;
  dbName: string;
  diaries: CaseDiary[];
  createdAt: number;
  timestamp: number;
}

class SupabaseServiceClass {
  private readonly pendingSyncKey = 'gateway_pending_supabase_sync';
  private isSyncing = false;

  /**
   * Save a database session, updating local caches immediately.
   * If the network call fails, queues the job for background retries.
   */
  public async saveDatabase(
    dbName: string,
    diaries: CaseDiary[],
    userId: string,
    existingDbId?: string
  ): Promise<SavedDatabase> {
    const dbId = existingDbId || `db-${Date.now()}`;
    const createdAt = Date.now();

    const newDb: SavedDatabase = {
      id: dbId,
      userId,
      name: dbName,
      createdAt,
      diaries,
      synced: false,
    };

    // 1. Immediately cache in localStorage for the user (to reflect in UI instantly)
    this.updateLocalUserCache(userId, newDb);

    // 2. Try saving to the backend server / Supabase
    try {
      Logger.log(`Saving database "${dbName}" (${diaries.length} records) to Cloud storage...`, 'SYSTEM');
      
      const response = await fetch('/api/db/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDb),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.supabaseSynced !== false) {
          newDb.synced = true;
          this.updateLocalUserCache(userId, newDb);
          Logger.log(`Cloud database save successful (DB ID: ${dbId}).`, 'SUCCESS');
          
          // Trigger any pending syncs in background
          this.syncPendingJobs(userId).catch(() => {});
          
          return newDb;
        } else {
          throw new Error(result.error || 'Server-side save returned success: false');
        }
      } else {
        throw new Error(`HTTP Status ${response.status}`);
      }
    } catch (err: any) {
      Logger.log(`Cloud save failed (${err.message || err}). Cached securely in local IndexedDB.`, 'WARNING');
      
      // Save Gemini output locally to IndexedDB so it's not lost
      await this.queuePendingJob({
        dbId,
        userId,
        dbName,
        diaries,
        createdAt,
        timestamp: Date.now()
      });

      return newDb;
    }
  }

  /**
   * Triggers retry of any pending database sync jobs stored in IndexedDB.
   */
  public async syncPendingJobs(userId: string): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const jobs = await StorageManager.getIndexedItem<PendingSaveJob[]>(this.pendingSyncKey) || [];
      if (jobs.length === 0) {
        this.isSyncing = false;
        return;
      }

      Logger.log(`Found ${jobs.length} pending database sync(s) in local storage. Retrying sync...`, 'SYSTEM');
      
      const successfulJobIds: string[] = [];

      for (const job of jobs) {
        if (job.userId !== userId) continue;

        try {
          const payload = {
            id: job.dbId,
            userId: job.userId,
            name: job.dbName,
            createdAt: job.createdAt,
            diaries: job.diaries
          };

          const response = await fetch('/api/db/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              successfulJobIds.push(job.dbId);
              
              // Update local cache as synced
              const syncedDb: SavedDatabase = {
                id: job.dbId,
                userId: job.userId,
                name: job.dbName,
                createdAt: job.createdAt,
                diaries: job.diaries,
                synced: true
              };
              this.updateLocalUserCache(userId, syncedDb);
              Logger.log(`Successfully synced pending database "${job.dbName}" (DB ID: ${job.dbId}) to Cloud.`, 'SUCCESS');
            }
          }
        } catch (jobErr) {
          // Keep the job in pending queue if save fails
          console.warn(`Sync failed for pending job ${job.dbId}:`, jobErr);
        }
      }

      // Remove successful jobs from IndexedDB
      const remainingJobs = jobs.filter(job => !successfulJobIds.includes(job.dbId));
      if (remainingJobs.length > 0) {
        await StorageManager.setIndexedItem(this.pendingSyncKey, remainingJobs);
      } else {
        await StorageManager.removeIndexedItem(this.pendingSyncKey);
      }

    } catch (err) {
      console.error('Error syncing pending database jobs:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  public async hasPendingSyncs(): Promise<boolean> {
    const jobs = await StorageManager.getIndexedItem<PendingSaveJob[]>(this.pendingSyncKey) || [];
    return jobs.length > 0;
  }

  private updateLocalUserCache(userId: string, updatedDb: SavedDatabase): void {
    const storageKey = `case_diary_databases_${userId}`;
    const localDbs = StorageManager.getLocalItem<SavedDatabase[]>(storageKey, []);
    const filtered = localDbs.filter(db => db.id !== updatedDb.id);
    filtered.push(updatedDb);
    StorageManager.setLocalItem(storageKey, filtered);
  }

  private async queuePendingJob(job: PendingSaveJob): Promise<void> {
    const jobs = await StorageManager.getIndexedItem<PendingSaveJob[]>(this.pendingSyncKey) || [];
    const filtered = jobs.filter(j => j.dbId !== job.dbId);
    filtered.push(job);
    await StorageManager.setIndexedItem(this.pendingSyncKey, filtered);
  }
}

export const SupabaseService = new SupabaseServiceClass();
