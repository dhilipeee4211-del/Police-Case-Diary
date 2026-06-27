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

export function getRecordTimestamp(diary: CaseDiary, dbCreatedAt?: number): number {
  // If the ID starts with a timestamp (digits followed by hyphen e.g. 17192348574-x-abc)
  const idParts = diary.id.split('-');
  if (idParts[0] && /^\d+$/.test(idParts[0])) {
    const ts = parseInt(idParts[0], 10);
    if (!isNaN(ts)) return ts;
  }
  // Fallback to database created_at timestamp
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
        if (diary.id === '__reconstruction_metadata__') continue; // Skip reconstruction metadata diary
        
        const station = (diary.policeStation || '').trim();
        const crimeNo = parseCrimeNumber(diary.crNoAndSecOfLaw);
        
        if (!station || !crimeNo) continue; // Skip invalid records missing essential fields

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
        // Sort items ascending by age to find the oldest original record
        items.sort((a, b) => {
          const tA = getRecordTimestamp(a.diary, a.dbCreatedAt);
          const tB = getRecordTimestamp(b.diary, b.dbCreatedAt);
          return tA - tB;
        });

        // First item is the original (oldest)
        const originalItem = items[0];
        const duplicatesItems = items.slice(1);

        const originalDiary = { ...originalItem.diary, dbId: originalItem.dbId };
        const duplicatesDiaries = duplicatesItems.map(item => ({ ...item.diary, dbId: item.dbId }));

        const dates = items.map(item => item.diary.dateOfCd || item.diary.dateOfReportTime || 'N/A');
        
        const station = originalDiary.policeStation;
        const crimeNo = parseCrimeNumber(originalDiary.crNoAndSecOfLaw);

        duplicateGroups.push({
          id: key,
          policeStation: station,
          crimeNumber: crimeNo,
          totalCount: items.length,
          originalRecord: originalDiary,
          duplicates: duplicatesDiaries,
          createdDate: dates[0],
          lastUpdated: dates[dates.length - 1]
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
