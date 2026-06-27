import { CaseDiary, SavedDatabase } from '../types';

export interface DuplicateGroup {
  id: string; // group id based on station and crime number
  policeStation: string;
  crimeNumber: string;
  totalCount: number;
  originalRecord: CaseDiary;
  duplicates: CaseDiary[];
  createdDate: string; // date of oldest
  lastUpdated: string; // date of newest
}

export function parseCrimeNumber(crNoAndSecOfLaw: string): string {
  if (!crNoAndSecOfLaw) return '';
  // Match digits followed by slash followed by 2 to 4 digits (e.g. 123/2025 or 0288/18)
  const match = crNoAndSecOfLaw.match(/(\d+)\/(\d{2,4})/);
  if (match) {
    return match[0].trim();
  }
  // Fallback to the whole string trimmed
  return crNoAndSecOfLaw.trim();
}

export function parseCdDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // Try standard Date parsing (e.g. YYYY-MM-DD)
  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d;

  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = clean.split(/[/\-]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (p0 > 1000) {
        return new Date(p0, p1 - 1, p2);
      } else if (p2 > 1000) {
        return new Date(p2, p1 - 1, p0);
      }
    }
  }
  return null;
}

export function getRecordTimestamp(diary: CaseDiary, dbCreatedAt?: number): number {
  const idParts = diary.id.split('-');
  if (idParts[0] && /^\d+$/.test(idParts[0])) {
    const ts = parseInt(idParts[0], 10);
    if (!isNaN(ts)) return ts;
  }
  if (dbCreatedAt) {
    return Number(dbCreatedAt);
  }
  return 0;
}

class DuplicateScannerService {
  /**
   * Scans all databases and detects duplicate diary groups based on matching Police Station and Crime Number.
   */
  public scan(databases: SavedDatabase[]): DuplicateGroup[] {
    const groupsMap = new Map<string, { dbId: string; diary: CaseDiary; dbCreatedAt: number }[]>();

    // Step 1: Accumulate all entries from all databases (excluding hidden system metadata records)
    for (const db of databases) {
      if (db.id.startsWith('__')) continue; // Skip metadata
      const diariesList = db.diaries || [];
      
      for (const diary of diariesList) {
        if (diary.id === '__reconstruction_metadata__') continue;
        
        const station = (diary.policeStation || '').trim();
        const crimeNo = parseCrimeNumber(diary.crNoAndSecOfLaw);
        
        if (!station || !crimeNo) continue;

        const key = `${station.toLowerCase()}|${crimeNo.toLowerCase()}`;
        
        if (!groupsMap.has(key)) {
          groupsMap.set(key, []);
        }
        groupsMap.get(key)!.push({ dbId: db.id, diary, dbCreatedAt: Number(db.createdAt) });
      }
    }

    const duplicateGroups: DuplicateGroup[] = [];

    // Step 2: Identify groups with size > 1 (meaning there are duplicates)
    for (const [key, items] of groupsMap.entries()) {
      if (items.length > 1) {
        // Sort items descending (newest first)
        items.sort((a, b) => {
          // 1. CD Date (dateOfCd)
          const dateA = parseCdDate(a.diary.dateOfCd);
          const dateB = parseCdDate(b.diary.dateOfCd);

          if (dateA && dateB) {
            const diff = dateB.getTime() - dateA.getTime();
            if (diff !== 0) return diff;
          } else if (dateA) {
            return -1;
          } else if (dateB) {
            return 1;
          }

          // 2. updated_at (or updatedAt)
          const updA = (a.diary as any).updated_at || (a.diary as any).updatedAt || 0;
          const updB = (b.diary as any).updated_at || (b.diary as any).updatedAt || 0;
          if (updA && updB) {
            const diff = new Date(updB).getTime() - new Date(updA).getTime();
            if (diff !== 0) return diff;
          } else if (updA) {
            return -1;
          } else if (updB) {
            return 1;
          }

          // 3. created_at (getRecordTimestamp or dbCreatedAt)
          const tA = getRecordTimestamp(a.diary, a.dbCreatedAt);
          const tB = getRecordTimestamp(b.diary, b.dbCreatedAt);
          const diffTs = tB - tA;
          if (diffTs !== 0) return diffTs;

          // 4. Highest ID (keep the highest ID first)
          if (a.diary.id > b.diary.id) return -1;
          if (a.diary.id < b.diary.id) return 1;

          return 0;
        });

        // First item is the master/original (newest)
        const originalItem = items[0];
        const duplicatesItems = items.slice(1);

        const originalDiary = { ...originalItem.diary, dbId: originalItem.dbId };
        const duplicatesDiaries = duplicatesItems.map(item => ({ ...item.diary, dbId: item.dbId }));

        // oldest is the last item
        const oldestItem = items[items.length - 1];
        const createdDate = oldestItem.diary.dateOfCd || oldestItem.diary.dateOfReportTime || 'N/A';
        const lastUpdated = originalDiary.dateOfCd || originalDiary.dateOfReportTime || 'N/A';
        
        const station = originalDiary.policeStation;
        const crimeNo = parseCrimeNumber(originalDiary.crNoAndSecOfLaw);

        duplicateGroups.push({
          id: key,
          policeStation: station,
          crimeNumber: crimeNo,
          totalCount: items.length,
          originalRecord: originalDiary,
          duplicates: duplicatesDiaries,
          createdDate,
          lastUpdated
        });
      }
    }

    return duplicateGroups;
  }

  /**
   * Applies filters and search parameters to duplicate groups.
   */
  public filter(
    groups: DuplicateGroup[],
    params: {
      search?: string;
      station?: string;
      year?: string;
      court?: string;
      officer?: string;
    }
  ): DuplicateGroup[] {
    let filtered = [...groups];

    // Search query: police station name, crime number, or specific record IDs
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(g => 
        g.policeStation.toLowerCase().includes(q) ||
        g.crimeNumber.toLowerCase().includes(q) ||
        g.originalRecord.id.toLowerCase().includes(q) ||
        g.duplicates.some(d => d.id.toLowerCase().includes(q))
      );
    }

    // Filter by Police Station (Exact or contains)
    if (params.station && params.station !== 'all') {
      const st = params.station.toLowerCase();
      filtered = filtered.filter(g => g.policeStation.toLowerCase() === st);
    }

    // Filter by Crime Number Year
    if (params.year && params.year !== 'all') {
      const yr = params.year;
      filtered = filtered.filter(g => {
        const parts = g.crimeNumber.split('/');
        return parts[1] === yr || (parts[1] && parts[1].endsWith(yr));
      });
    }

    // Filter by Court
    if (params.court && params.court !== 'all') {
      const crt = params.court.toLowerCase();
      filtered = filtered.filter(g => 
        (g.originalRecord.courtNameAndPlace || '').toLowerCase() === crt ||
        g.duplicates.some(d => (d.courtNameAndPlace || '').toLowerCase() === crt)
      );
    }

    // Filter by Investigating Officer
    if (params.officer && params.officer !== 'all') {
      const off = params.officer.toLowerCase();
      filtered = filtered.filter(g => 
        (g.originalRecord.attendedBy || '').toLowerCase() === off ||
        g.duplicates.some(d => (d.attendedBy || '').toLowerCase() === off)
      );
    }

    return filtered;
  }
}

export const DuplicateScanner = new DuplicateScannerService();
