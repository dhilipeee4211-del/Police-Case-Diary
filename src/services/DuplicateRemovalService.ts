import { SavedDatabase } from '../types';
import { getSupabaseClient } from '../supabaseClient';
import { DuplicateGroup } from './DuplicateScanner';
import { BackupService } from './BackupService';
import { AuditLogService } from './AuditLogService';
import { Logger } from './Logger';

class DuplicateRemovalServiceService {
  /**
   * Removes duplicates within a single group, keeping only the original (oldest) entry.
   */
  public async removeGroupDuplicates(
    group: DuplicateGroup,
    adminEmail: string,
    databases: SavedDatabase[]
   ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client is not configured.');
    }

    const idsToDelete = group.duplicates.map(d => d.id);
    const dbIdsAffected = Array.from(new Set(group.duplicates.map(d => d.dbId).filter(Boolean))) as string[];

    // 1. Load affected databases from current state
    const affectedDbs = databases.filter(db => dbIdsAffected.includes(db.id) || db.id === group.originalRecord.dbId);

    // 2. Perform a backup before modifying
    const backupId = await BackupService.createBackup(
      affectedDbs,
      adminEmail,
      `Pre-deletion backup for duplicates in Crime ${group.crimeNumber} at PS ${group.policeStation}`
    );

    Logger.log(`Starting duplicates removal for Group Crime ${group.crimeNumber}...`, 'SYSTEM');

    try {
      // 3. For each affected database, filter its diaries array to remove duplicate IDs
      for (const db of affectedDbs) {
        const filteredDiaries = (db.diaries || []).filter(d => !idsToDelete.includes(d.id));

        const { error: updateErr } = await supabase
          .from('case_databases')
          .update({ diaries: filteredDiaries })
          .eq('id', db.id);

        if (updateErr) {
          throw new Error(`Failed to update database ${db.name}: ${updateErr.message}`);
        }
      }

      // 4. Audit Log
      await AuditLogService.logAction(
        adminEmail,
        `Removed duplicates for Crime No ${group.crimeNumber} at ${group.policeStation} (Preserved ID: ${group.originalRecord.id})`,
        {
          deletedRecordIds: idsToDelete,
          originalRecordId: group.originalRecord.id,
          policeStation: group.policeStation,
          crimeNumber: group.crimeNumber,
          preservedCdDate: group.originalRecord.dateOfCd || 'N/A'
        }
      );

      Logger.log(`Successfully cleaned duplicates for Group Crime ${group.crimeNumber}.`, 'SUCCESS');
    } catch (err: any) {
      console.error('Removal failed, reverting to backup...', err);
      Logger.log(`Removal failed: ${err.message || err}. Reverting database to original state...`, 'ERROR');
      
      // Roll back using the backup
      try {
        await BackupService.restoreBackup(backupId);
      } catch (rollbackErr: any) {
        Logger.log(`CRITICAL: Rollback failed during restore: ${rollbackErr.message || rollbackErr}`, 'ERROR');
      }

      throw err;
    }
  }

  /**
   * Performs bulk duplicate removal across all groups.
   * Returns the count of deleted duplicates.
   */
  public async bulkRemoveAllDuplicates(
    groups: DuplicateGroup[],
    adminEmail: string,
    databases: SavedDatabase[]
  ): Promise<number> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client is not configured.');
    }

    if (groups.length === 0) return 0;

    // Collect all duplicate IDs to delete
    const allIdsToDelete = new Set<string>();
    const allDbIdsAffected = new Set<string>();

    groups.forEach(g => {
      g.duplicates.forEach(d => {
        allIdsToDelete.add(d.id);
        if (d.dbId) allDbIdsAffected.add(d.dbId);
      });
      if (g.originalRecord.dbId) allDbIdsAffected.add(g.originalRecord.dbId);
    });

    const affectedDbs = databases.filter(db => allDbIdsAffected.has(db.id));

    // 1. Create bulk backup
    const totalToDelete = allIdsToDelete.size;
    const backupId = await BackupService.createBackup(
      affectedDbs,
      adminEmail,
      `Bulk safe cleanup: Removing ${totalToDelete} duplicate records across ${groups.length} groups.`
    );

    Logger.log(`Bulk cleanup: Modifying ${affectedDbs.length} database(s)...`, 'SYSTEM');

    const completedUpdates: { id: string; originalDiaries: any }[] = [];

    try {
      // 2. Perform updates
      for (const db of affectedDbs) {
        completedUpdates.push({ id: db.id, originalDiaries: db.diaries });
        const filteredDiaries = (db.diaries || []).filter(d => !allIdsToDelete.has(d.id));

        const { error: updateErr } = await supabase
          .from('case_databases')
          .update({ diaries: filteredDiaries })
          .eq('id', db.id);

        if (updateErr) {
          throw new Error(`Failed to update database ${db.name} (Bulk): ${updateErr.message}`);
        }
      }

      // 3. Log bulk actions
      for (const g of groups) {
        const deletedIdsForGroup = g.duplicates.map(d => d.id);
        await AuditLogService.logAction(
          adminEmail,
          `Bulk Removed duplicates for Crime No ${g.crimeNumber} at ${g.policeStation} (Preserved ID: ${g.originalRecord.id})`,
          {
            deletedRecordIds: deletedIdsForGroup,
            originalRecordId: g.originalRecord.id,
            policeStation: g.policeStation,
            crimeNumber: g.crimeNumber,
            preservedCdDate: g.originalRecord.dateOfCd || 'N/A'
          }
        );
      }

      Logger.log(`✅ Bulk cleanup completed. Preserved all original records.`, 'SUCCESS');
      return totalToDelete;
    } catch (err: any) {
      console.error('Bulk removal failed. Initiating transaction rollback...', err);
      Logger.log(`Bulk removal failed: ${err.message || err}. Initiating database rollback to restore previous state...`, 'ERROR');

      // Local Rollback Loop for immediate restore
      for (const update of completedUpdates) {
        try {
          await supabase
            .from('case_databases')
            .update({ diaries: update.originalDiaries })
            .eq('id', update.id);
        } catch (rollbackErr) {
          console.error(`Local rollback failed for db ${update.id}:`, rollbackErr);
        }
      }

      // Also invoke the backup restoration as a secondary safety net
      try {
        await BackupService.restoreBackup(backupId);
      } catch (backupRestoreErr) {
        console.error('Backup restoration safety-net also failed:', backupRestoreErr);
      }

      throw err;
    }
  }
}

export const DuplicateRemovalService = new DuplicateRemovalServiceService();
