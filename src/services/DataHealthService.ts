import { SavedDatabase } from '../types';
import { DuplicateScanner, DuplicateGroup } from './DuplicateScanner';
import { DuplicateRemovalService } from './DuplicateRemovalService';
import { BackupService, BackupRecord } from './BackupService';
import { AuditLogService, AuditRecord } from './AuditLogService';

class DataHealthServiceService {
  /**
   * Scans the database and detects duplicates.
   */
  public scanDatabase(databases: SavedDatabase[]): DuplicateGroup[] {
    return DuplicateScanner.scan(databases);
  }

  /**
   * Filters duplicate groups.
   */
  public filterGroups(
    groups: DuplicateGroup[],
    params: {
      search?: string;
      station?: string;
      year?: string;
      court?: string;
      officer?: string;
    }
  ): DuplicateGroup[] {
    return DuplicateScanner.filter(groups, params);
  }

  /**
   * Removes duplicates from a single group.
   */
  public async removeGroupDuplicates(
    group: DuplicateGroup,
    adminEmail: string,
    databases: SavedDatabase[]
  ): Promise<void> {
    await DuplicateRemovalService.removeGroupDuplicates(group, adminEmail, databases);
  }

  /**
   * Performs bulk duplicate removal across all groups.
   */
  public async bulkRemoveAllDuplicates(
    groups: DuplicateGroup[],
    adminEmail: string,
    databases: SavedDatabase[]
  ): Promise<number> {
    return await DuplicateRemovalService.bulkRemoveAllDuplicates(groups, adminEmail, databases);
  }

  /**
   * Fetches audit history.
   */
  public async getAuditLogs(): Promise<AuditRecord[]> {
    return await AuditLogService.getAuditLogs();
  }

  /**
   * Fetches backup snapshots registry.
   */
  public async getBackups(): Promise<BackupRecord[]> {
    return await BackupService.getBackupsList();
  }

  /**
   * Restores a backup snapshot.
   */
  public async restoreBackup(backupId: string): Promise<void> {
    await BackupService.restoreBackup(backupId);
  }
}

export const DataHealthService = new DataHealthServiceService();
