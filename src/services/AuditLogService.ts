import { CaseDiary } from '../types';
import { getSupabaseClient } from '../supabaseClient';
import { Logger } from './Logger';

export interface AuditRecord {
  id: string;
  adminEmail: string;
  timestamp: number;
  action: string;
  deletedRecordIds: string[];
  originalRecordId: string;
  ipAddress: string;
  browser: string;
  policeStation?: string;
  crimeNumber?: string;
  preservedCdDate?: string;
  deletedCount?: number;
}

const AUDIT_DB_ID = '__health_audit_logs__';

class AuditLogServiceClass {
  /**
   * Logs a health check cleaning action.
   */
  public async logAction(
    adminEmail: string,
    action: string,
    details: {
      deletedRecordIds: string[];
      originalRecordId: string;
      ipAddress?: string;
      browser?: string;
      policeStation?: string;
      crimeNumber?: string;
      preservedCdDate?: string;
    }
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const timestamp = Date.now();
    const auditId = `audit-${timestamp}-${Math.random().toString(36).substr(2, 5)}`;
    
    // Resolve browser info if missing
    const browserInfo = details.browser || (typeof navigator !== 'undefined' ? navigator.userAgent : 'NodeServer');
    const ipAddressVal = details.ipAddress || '127.0.0.1';

    const newAudit: AuditRecord = {
      id: auditId,
      adminEmail,
      timestamp,
      action,
      deletedRecordIds: details.deletedRecordIds,
      originalRecordId: details.originalRecordId,
      ipAddress: ipAddressVal,
      browser: browserInfo
    };

    try {
      // 1. Fetch current audits list
      const { data, error } = await supabase
        .from('case_databases')
        .select('*')
        .eq('id', AUDIT_DB_ID)
        .maybeSingle();

      if (error) throw error;

      let currentAuditDiaries: CaseDiary[] = [];
      if (data && Array.isArray(data.diaries)) {
        currentAuditDiaries = data.diaries;
      }

      // 2. Map AuditRecord properties into CaseDiary fields for database schema alignment
      const mappedDiary: CaseDiary = {
        id: newAudit.id,
        policeStation: 'HEALTH_AUDIT',
        district: newAudit.adminEmail,
        crNoAndSecOfLaw: newAudit.action,
        dateTimeAndPlaceOfOccurrence: newAudit.timestamp.toString(),
        dateOfCd: newAudit.browser, // Browser info
        dateOfReportTime: newAudit.ipAddress, // IP info
        complainant: 'Admin Audit Log Module',
        accusedList: [],
        propertyLostDetails: '',
        recoveredPropertyDetails: '',
        dateOfPreviousCaseDiary: '',
        stageOfTheCase: 'AUDIT_LOG_RECORD',
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
        remarks: JSON.stringify({
          deletedRecordIds: newAudit.deletedRecordIds,
          originalRecordId: newAudit.originalRecordId,
          policeStation: details.policeStation || '',
          crimeNumber: details.crimeNumber || '',
          preservedCdDate: details.preservedCdDate || '',
          deletedCount: newAudit.deletedRecordIds.length
        }),
        postedFor: '',
        nextHearingDate: '',
        attendedBy: 'System Audit'
      };

      const updatedAuditDiaries = [mappedDiary, ...currentAuditDiaries].slice(0, 1000); // Caps audits history limit at 1000

      // 3. Upsert audit registry row
      if (data) {
        await supabase
          .from('case_databases')
          .update({ diaries: updatedAuditDiaries })
          .eq('id', AUDIT_DB_ID);
      } else {
        await supabase
          .from('case_databases')
          .insert({
            id: AUDIT_DB_ID,
            user_id: 'SYSTEM_ADMIN',
            name: 'System Health Check Audit Logs Container',
            created_at: timestamp,
            diaries: updatedAuditDiaries
          });
      }

    } catch (err) {
      console.error('Failed to log audit action:', err);
    }
  }

  /**
   * Retrieves all logged audit actions.
   */
  public async getAuditLogs(): Promise<AuditRecord[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('case_databases')
        .select('*')
        .eq('id', AUDIT_DB_ID)
        .maybeSingle();

      if (error || !data || !Array.isArray(data.diaries)) {
        return [];
      }

      return data.diaries.map((diary: CaseDiary) => {
        let deletedRecordIds: string[] = [];
        let originalRecordId = '';
        let policeStation = '';
        let crimeNumber = '';
        let preservedCdDate = '';
        let deletedCount = 0;
        try {
          const detail = JSON.parse(diary.remarks || '{}');
          deletedRecordIds = detail.deletedRecordIds || [];
          originalRecordId = detail.originalRecordId || '';
          policeStation = detail.policeStation || '';
          crimeNumber = detail.crimeNumber || '';
          preservedCdDate = detail.preservedCdDate || '';
          deletedCount = detail.deletedCount || deletedRecordIds.length;
        } catch (_) {}

        return {
          id: diary.id,
          adminEmail: diary.district || '',
          timestamp: parseInt(diary.dateTimeAndPlaceOfOccurrence || '0', 10),
          action: diary.crNoAndSecOfLaw || '',
          deletedRecordIds,
          originalRecordId,
          browser: diary.dateOfCd || '',
          ipAddress: diary.dateOfReportTime || '',
          policeStation,
          crimeNumber,
          preservedCdDate,
          deletedCount
        };
      });
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      return [];
    }
  }
}

export const AuditLogService = new AuditLogServiceClass();
