import { CaseDiary, SavedDatabase } from '../types';
import { getSupabaseClient } from '../supabaseClient';
import { Logger } from './Logger';

export interface BackupRecord {
  id: string; // e.g. "backup-17192348574"
  timestamp: number;
  adminEmail: string;
  description: string;
  payload: string; // Stringified JSON snapshot of affected databases containing the original diaries list
}

const BACKUP_DB_ID = '__health_backup__';

class BackupServiceClass {
  /**
   * Creates a backup snapshot of specific databases before duplicates are removed.
   */
  public async createBackup(
    affectedDatabases: SavedDatabase[],
    adminEmail: string,
    description: string
  ): Promise<string> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }

    const backupId = `backup-${Date.now()}`;
    const timestamp = Date.now();

    // Map database original state to a lightweight payload
    const snapshotPayload = affectedDatabases.map(db => ({
      id: db.id,
      name: db.name,
      diaries: db.diaries
    }));

    const newBackup: BackupRecord = {
      id: backupId,
      timestamp,
      adminEmail,
      description,
      payload: JSON.stringify(snapshotPayload)
    };

    Logger.log(`Creating database backup snapshot (ID: ${backupId})...`, 'SYSTEM');

    try {
      // 1. Fetch the existing backups container row from Supabase
      const { data, error } = await supabase
        .from('case_databases')
        .select('*')
        .eq('id', BACKUP_DB_ID)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load backups registry: ${error.message}`);
      }

      let currentBackupDiaries: CaseDiary[] = [];
      if (data && Array.isArray(data.diaries)) {
        currentBackupDiaries = data.diaries;
      }

      // 2. Map BackupRecord properties into CaseDiary fields to maintain full schema compliance
      const mappedDiary: CaseDiary = {
        id: newBackup.id,
        policeStation: 'HEALTH_BACKUP',
        district: newBackup.adminEmail,
        crNoAndSecOfLaw: newBackup.description,
        dateTimeAndPlaceOfOccurrence: newBackup.timestamp.toString(),
        dateOfCd: new Date(newBackup.timestamp).toLocaleDateString('en-GB'),
        dateOfReportTime: new Date(newBackup.timestamp).toLocaleTimeString(),
        complainant: 'Admin Data Health Module',
        accusedList: [],
        propertyLostDetails: '',
        recoveredPropertyDetails: '',
        dateOfPreviousCaseDiary: '',
        stageOfTheCase: 'BACKUP_RECORD',
        courtRefNo: '',
        hearingNo: '',
        courtNameAndPlace: '',
        whetherMagistratePresent: 'NO',
        whetherAppPpPresent: 'NO',
        whetherDefenceCounselPresent: 'NO',
        noOfPwsCited: '0',
        noOfPwsExaminedSoFar: '0',
        noOfPwsExaminedToday: '0',
        totalNoOfAccusedCharged: '0',
        totalNoOfAccusedPresent: '0',
        noOfAccusedPresent: '0',
        noOfAccusedAbsent: '0',
        remarks: newBackup.payload, // Save payload inside remarks
        postedFor: '',
        nextHearingDate: '',
        attendedBy: 'System Backup'
      };

      const updatedBackupDiaries = [mappedDiary, ...currentBackupDiaries];

      // 3. Upsert backups container row
      if (data) {
        const { error: updateError } = await supabase
          .from('case_databases')
          .update({ diaries: updatedBackupDiaries })
          .eq('id', BACKUP_DB_ID);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('case_databases')
          .insert({
            id: BACKUP_DB_ID,
            user_id: 'SYSTEM_ADMIN',
            name: 'System Health Check Backups Container',
            created_at: timestamp,
            diaries: updatedBackupDiaries
          });
        if (insertError) throw insertError;
      }

      Logger.log(`Backup snapshot ${backupId} created successfully.`, 'SUCCESS');
      return backupId;
    } catch (err: any) {
      console.error('Backup creation failed:', err);
      Logger.log(`Backup creation failed: ${err.message || err}`, 'ERROR');
      throw err;
    }
  }

  /**
   * Retrieves list of all completed backups.
   */
  public async getBackupsList(): Promise<BackupRecord[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('case_databases')
        .select('*')
        .eq('id', BACKUP_DB_ID)
        .maybeSingle();

      if (error || !data || !Array.isArray(data.diaries)) {
        return [];
      }

      return data.diaries.map((diary: CaseDiary) => ({
        id: diary.id,
        timestamp: parseInt(diary.dateTimeAndPlaceOfOccurrence || '0', 10),
        adminEmail: diary.district || '',
        description: diary.crNoAndSecOfLaw || '',
        payload: diary.remarks || ''
      }));
    } catch (err) {
      console.error('Failed to load backups list:', err);
      return [];
    }
  }

  /**
   * Restores a backup snapshot by database key, reverting to original diaries list.
   */
  public async restoreBackup(backupId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized.');
    }

    Logger.log(`Initiating restoration of backup snapshot ${backupId}...`, 'SYSTEM');

    try {
      const backups = await this.getBackupsList();
      const match = backups.find(b => b.id === backupId);
      if (!match) {
        throw new Error(`Backup snapshot ${backupId} not found.`);
      }

      const affectedSnapshots: { id: string; name: string; diaries: CaseDiary[] }[] = JSON.parse(match.payload);

      // Revert each database in the snapshot
      for (const snap of affectedSnapshots) {
        Logger.log(`Restoring original state of database: "${snap.name}" (ID: ${snap.id})...`, 'SYSTEM');
        
        // Fetch current to double check
        const { data: dbData, error: dbError } = await supabase
          .from('case_databases')
          .select('*')
          .eq('id', snap.id)
          .maybeSingle();

        if (dbError) {
          throw new Error(`Failed to load target database ${snap.id}: ${dbError.message}`);
        }

        if (dbData) {
          // Sync update
          const { error: restoreErr } = await supabase
            .from('case_databases')
            .update({ diaries: snap.diaries })
            .eq('id', snap.id);

          if (restoreErr) {
            throw new Error(`Failed to update database ${snap.id}: ${restoreErr.message}`);
          }
        }
      }

      // Delete this backup record from the array to maintain clean log states
      const { data, error } = await supabase
        .from('case_databases')
        .select('*')
        .eq('id', BACKUP_DB_ID)
        .maybeSingle();

      if (data && Array.isArray(data.diaries)) {
        const filteredDiaries = data.diaries.filter((d: CaseDiary) => d.id !== backupId);
        await supabase
          .from('case_databases')
          .update({ diaries: filteredDiaries })
          .eq('id', BACKUP_DB_ID);
      }

      Logger.log(`✅ Restoration of backup ${backupId} completed successfully. All original database records restored.`, 'SUCCESS');
    } catch (err: any) {
      console.error('Backup restoration failed:', err);
      Logger.log(`Restoration failed: ${err.message || err}`, 'ERROR');
      throw err;
    }
  }
}

export const BackupService = new BackupServiceClass();
