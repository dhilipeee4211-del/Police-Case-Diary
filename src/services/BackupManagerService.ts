import { Logger } from './Logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DuplicateBackupRecord {
  id: string;
  original_record_id: string;
  original_record: Record<string, any>;
  backup_timestamp: number;
  deleted_by: string;
  delete_reason: string;
  cleanup_session_id: string;
  original_created_date: string;
  original_updated_date: string;
}

export interface BackupListResponse {
  records: DuplicateBackupRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CleanupResult {
  success: boolean;
  sessionId: string;
  totalDeleted: number;
  backedUpCount: number;
  backupIds: string[];
  error?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class BackupManagerServiceClass {
  private readonly baseUrl = '/api';

  private async safeFetchJson(url: string, init?: RequestInit): Promise<{ res: Response; data: any }> {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Server returned non-JSON response (status ${res.status}): ${text.slice(0, 300)}`);
    }
    return { res, data };
  }

  /**
   * Lists all backup records from case_diary_duplicate_backup table, paginated.
   */
  public async listBackups(page = 1, pageSize = 50): Promise<BackupListResponse> {
    try {
      const { data } = await this.safeFetchJson(`${this.baseUrl}/health/backup/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, pageSize })
      });
      if (!data.success) throw new Error(data.error || 'Failed to list backups');
      return data as BackupListResponse;
    } catch (err: any) {
      Logger.log(`BackupManager: listBackups failed: ${err.message}`, 'ERROR');
      throw err;
    }
  }

  /**
   * Permanently deletes a backup record by its backup ID.
   */
  public async deleteBackup(id: string): Promise<void> {
    try {
      const { data } = await this.safeFetchJson(`${this.baseUrl}/health/backup/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!data.success) throw new Error(data.error || 'Failed to delete backup');
      Logger.log(`BackupManager: Permanently deleted backup ${id}`, 'SUCCESS');
    } catch (err: any) {
      Logger.log(`BackupManager: deleteBackup failed: ${err.message}`, 'ERROR');
      throw err;
    }
  }

  /**
   * Restores a backup record into the specified target database.
   * Returns:
   *  - { success: true } if restored
   *  - { success: false, reason: 'duplicate', message: string } if duplicate guard blocked
   */
  public async restoreBackup(
    id: string,
    targetDbId: string
  ): Promise<{ success: boolean; reason?: string; message?: string }> {
    try {
      const { data } = await this.safeFetchJson(`${this.baseUrl}/health/backup/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, targetDbId })
      });
      if (data.success) {
        Logger.log(`BackupManager: Restored backup ${id} → database ${targetDbId}`, 'SUCCESS');
      } else if (data.reason === 'duplicate') {
        Logger.log(`BackupManager: Restore blocked — duplicate record exists in target database.`, 'WARN' as any);
      } else if (data.error) {
        throw new Error(data.error);
      }
      return data;
    } catch (err: any) {
      Logger.log(`BackupManager: restoreBackup failed: ${err.message}`, 'ERROR');
      throw err;
    }
  }

  /**
   * Executes a transaction-safe cleanup of the specified duplicate groups
   * via the backend /api/health/cleanup endpoint.
   *
   * IMPORTANT: Only sends lightweight ID descriptors to the backend — NOT full
   * case diary objects — to stay well within Vercel's 4.5 MB request body limit.
   * The server fetches the full records from Supabase itself.
   *
   * The backend performs: Fetch → Backup → Verify → Delete → Rollback on failure.
   */
  public async runTransactionSafeCleanup(
    groups: Array<{
      policeStation: string;
      crimeNumber: string;
      originalRecord: Record<string, any>;
      duplicates: Array<Record<string, any>>;
    }>,
    adminEmail: string
  ): Promise<CleanupResult> {
    try {
      // Build a lightweight payload: only IDs, no full objects
      const lightweightGroups = groups.map(g => ({
        policeStation: g.policeStation,
        crimeNumber: g.crimeNumber,
        originalRecordId: g.originalRecord?.id || '',
        originalRecordDbId: g.originalRecord?.dbId || '',
        duplicateIds: (g.duplicates || []).map(d => ({ id: d.id, dbId: d.dbId || '' }))
      }));

      const { res, data } = await this.safeFetchJson(`${this.baseUrl}/health/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: lightweightGroups, adminEmail })
      });

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Cleanup failed with status ${res.status}`);
      }

      Logger.log(
        `BackupManager: Cleanup complete. Session: ${data.sessionId}. ` +
        `Deleted: ${data.totalDeleted}. Backed up: ${data.backedUpCount}.`,
        'SUCCESS'
      );

      return data as CleanupResult;
    } catch (err: any) {
      Logger.log(`BackupManager: runTransactionSafeCleanup failed: ${err.message}`, 'ERROR');
      throw err;
    }
  }

  /**
   * Formats a backup timestamp to a readable string.
   */
  public formatBackupDate(timestamp: number): string {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

export const BackupManagerService = new BackupManagerServiceClass();
