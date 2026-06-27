import { CaseDiary } from '../types';
import { parseCrimeNumber } from './DuplicateScanner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportValidationReport {
  totalRecords: number;
  validRecords: number;
  imported: number;
  skippedDuplicateInFile: number;
  skippedDuplicateInDatabase: number;
  invalidRecords: number;
  failedRecords: number;
  timeTaken: number; // ms
  skippedFileDetails: SkippedRecord[];
  skippedDatabaseDetails: SkippedRecord[];
  invalidDetails: InvalidRecord[];
  validDiaries: CaseDiary[];
}

export interface SkippedRecord {
  policeStation: string;
  crimeNumber: string;
  existingRecordId?: string;
  rowIndex?: number;
  reason: string;
}

export interface InvalidRecord {
  rowIndex: number;
  missingFields: string[];
  rawRow: Record<string, string>;
}

// ─── Field Normaliser ─────────────────────────────────────────────────────────

function normaliseKey(k: string): string {
  return k.trim().toLowerCase().replace(/[\s_\-\/\.]+/g, '');
}

function findField(row: Record<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    const normalised = normaliseKey(c);
    for (const key of Object.keys(row)) {
      if (normaliseKey(key) === normalised) {
        return row[key] ?? '';
      }
    }
  }
  return '';
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Detect delimiter
  const delimiters = [',', '\t', ';', '|'];
  const firstLine = lines[0];
  const delimiter = delimiters.reduce((best, d) =>
    (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');

  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.length === 0) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

// ─── CSV → CaseDiary Mapper ───────────────────────────────────────────────────

function mapRowToCaseDiary(row: Record<string, string>, rowIndex: number): { diary: CaseDiary | null; missingFields: string[] } {
  const policeStation = findField(row, ['policeStation', 'police_station', 'Police Station', 'station']);
  const crNoAndSecOfLaw = findField(row, ['crNoAndSecOfLaw', 'cr_no', 'crNo', 'Crime Number', 'crime_number', 'CR No', 'crNoAndSecOfLaw']);
  const dateOfCd = findField(row, ['dateOfCd', 'date_of_cd', 'Date of CD', 'CD Date', 'dateofcd']);
  const district = findField(row, ['district', 'District']);
  const courtNameAndPlace = findField(row, ['courtNameAndPlace', 'court_name', 'Court Name', 'court']);
  const attendedBy = findField(row, ['attendedBy', 'attended_by', 'Investigating Officer', 'officer']);
  const complainant = findField(row, ['complainant', 'Complainant', 'victim', 'Victim Name']);
  const stageOfTheCase = findField(row, ['stageOfTheCase', 'stage_of_case', 'Stage', 'Case Status']);
  const remarks = findField(row, ['remarks', 'Remarks', 'Diary Remarks', 'diary_remarks']);
  const courtRefNo = findField(row, ['courtRefNo', 'court_ref_no', 'Court Ref No', 'FIR No', 'firNo', 'fir_no']);
  const dateTimeAndPlaceOfOccurrence = findField(row, ['dateTimeAndPlaceOfOccurrence', 'date_time_place', 'Date Time Place', 'occurrenceDate']);
  const dateOfReportTime = findField(row, ['dateOfReportTime', 'date_of_report', 'Report Date']);
  const nextHearingDate = findField(row, ['nextHearingDate', 'next_hearing_date', 'Next Hearing Date']);
  const postedFor = findField(row, ['postedFor', 'posted_for', 'Posted For']);

  const missingFields: string[] = [];
  if (!policeStation.trim()) missingFields.push('Police Station');
  if (!crNoAndSecOfLaw.trim()) missingFields.push('Crime Number');

  if (missingFields.length > 0) {
    return { diary: null, missingFields };
  }

  const diary: CaseDiary = {
    id: `import-${Date.now()}-${rowIndex}-${Math.random().toString(36).substr(2, 4)}`,
    policeStation: policeStation.trim(),
    district: district.trim(),
    crNoAndSecOfLaw: crNoAndSecOfLaw.trim(),
    dateOfCd: dateOfCd.trim(),
    dateTimeAndPlaceOfOccurrence: dateTimeAndPlaceOfOccurrence.trim(),
    dateOfReportTime: dateOfReportTime.trim(),
    complainant: complainant.trim(),
    accusedList: [],
    propertyLostDetails: '',
    recoveredPropertyDetails: '',
    dateOfPreviousCaseDiary: '',
    stageOfTheCase: stageOfTheCase.trim(),
    courtRefNo: courtRefNo.trim(),
    hearingNo: '',
    courtNameAndPlace: courtNameAndPlace.trim(),
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
    remarks: remarks.trim(),
    postedFor: postedFor.trim(),
    nextHearingDate: nextHearingDate.trim(),
    attendedBy: attendedBy.trim(),
  };

  return { diary, missingFields: [] };
}

// ─── Deduplicate Within File ──────────────────────────────────────────────────

function deduplicateWithinFile(diaries: CaseDiary[]): {
  unique: CaseDiary[];
  skipped: SkippedRecord[];
} {
  const groupsMap = new Map<string, CaseDiary[]>();

  for (const diary of diaries) {
    const station = diary.policeStation.trim().toLowerCase();
    const crime = parseCrimeNumber(diary.crNoAndSecOfLaw).toLowerCase();
    const key = `${station}|${crime}`;
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(diary);
  }

  const unique: CaseDiary[] = [];
  const skipped: SkippedRecord[] = [];

  for (const [, group] of groupsMap.entries()) {
    if (group.length === 1) {
      unique.push(group[0]);
      continue;
    }

    // Sort descending: newest CD date first, then by ID
    group.sort((a, b) => {
      const da = a.dateOfCd ? new Date(a.dateOfCd.split(/[-\/]/).reverse().join('-')).getTime() : 0;
      const db_ = b.dateOfCd ? new Date(b.dateOfCd.split(/[-\/]/).reverse().join('-')).getTime() : 0;
      if (da !== db_) return db_ - da;
      return b.id > a.id ? 1 : -1;
    });

    unique.push(group[0]); // keep newest
    for (let i = 1; i < group.length; i++) {
      skipped.push({
        policeStation: group[i].policeStation,
        crimeNumber: parseCrimeNumber(group[i].crNoAndSecOfLaw),
        existingRecordId: group[0].id,
        reason: 'Duplicate inside imported file — older record skipped'
      });
    }
  }

  return { unique, skipped };
}

// ─── Check Against Existing Diaries ──────────────────────────────────────────

function checkAgainstExisting(
  incoming: CaseDiary[],
  existingDiaries: CaseDiary[]
): {
  valid: CaseDiary[];
  skipped: SkippedRecord[];
} {
  const existingKeys = new Set<string>(
    existingDiaries.map(d => {
      const station = d.policeStation.trim().toLowerCase();
      const crime = parseCrimeNumber(d.crNoAndSecOfLaw).toLowerCase();
      return `${station}|${crime}`;
    })
  );

  const valid: CaseDiary[] = [];
  const skipped: SkippedRecord[] = [];

  for (const diary of incoming) {
    const station = diary.policeStation.trim().toLowerCase();
    const crime = parseCrimeNumber(diary.crNoAndSecOfLaw).toLowerCase();
    const key = `${station}|${crime}`;

    if (existingKeys.has(key)) {
      const existingMatch = existingDiaries.find(d => {
        const s = d.policeStation.trim().toLowerCase();
        const c = parseCrimeNumber(d.crNoAndSecOfLaw).toLowerCase();
        return `${s}|${c}` === key;
      });

      skipped.push({
        policeStation: diary.policeStation,
        crimeNumber: parseCrimeNumber(diary.crNoAndSecOfLaw),
        existingRecordId: existingMatch?.id,
        reason: 'Already exists in database — duplicate skipped'
      });
    } else {
      valid.push(diary);
      // Add to existing keys to prevent later rows from duplicating it too
      existingKeys.add(key);
    }
  }

  return { valid, skipped };
}

// ─── Main Validation Entry Point ──────────────────────────────────────────────

/**
 * Validates a file content string (JSON database backup or CSV) against
 * an existing set of case diaries. Returns a full ImportValidationReport.
 *
 * @param fileContent  - Raw text content of the imported file
 * @param fileType     - 'json' | 'csv'
 * @param existingDiaries - All currently saved diaries to check duplicates against
 */
export function validateAndPlanImport(
  fileContent: string,
  fileType: 'json' | 'csv',
  existingDiaries: CaseDiary[]
): ImportValidationReport {
  const startTime = Date.now();
  const invalidDetails: InvalidRecord[] = [];
  let parsed: CaseDiary[] = [];

  // ── Step 1-2: Parse and map records ────────────────────────────────────────
  if (fileType === 'json') {
    try {
      const raw = JSON.parse(fileContent);

      // Support both plain array and { diaries: [...] } format
      const rawDiaries: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.diaries)
          ? raw.diaries
          : [];

      rawDiaries.forEach((d, i) => {
        if (!d.policeStation || !d.crNoAndSecOfLaw) {
          invalidDetails.push({
            rowIndex: i,
            missingFields: [
              ...(!d.policeStation ? ['Police Station'] : []),
              ...(!d.crNoAndSecOfLaw ? ['Crime Number'] : [])
            ],
            rawRow: { id: d.id || String(i) }
          });
        } else {
          // Assign new id to avoid ID collision on import
          parsed.push({
            ...d,
            id: `import-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`
          });
        }
      });
    } catch (e: any) {
      return {
        totalRecords: 0,
        validRecords: 0,
        imported: 0,
        skippedDuplicateInFile: 0,
        skippedDuplicateInDatabase: 0,
        invalidRecords: 1,
        failedRecords: 0,
        timeTaken: Date.now() - startTime,
        skippedFileDetails: [],
        skippedDatabaseDetails: [],
        invalidDetails: [{ rowIndex: 0, missingFields: ['File Parse Error: ' + e.message], rawRow: {} }],
        validDiaries: []
      };
    }
  } else {
    // CSV
    const rows = parseCSV(fileContent);
    rows.forEach((row, i) => {
      const { diary, missingFields } = mapRowToCaseDiary(row, i);
      if (!diary) {
        invalidDetails.push({ rowIndex: i + 1, missingFields, rawRow: row });
      } else {
        parsed.push(diary);
      }
    });
  }

  const totalRecords = parsed.length + invalidDetails.length;

  // ── Step 3: Already filtered invalid above ─────────────────────────────────

  // ── Step 4: Deduplicate within the file ────────────────────────────────────
  const { unique: afterFileDedup, skipped: skippedInFile } = deduplicateWithinFile(parsed);

  // ── Step 5: Check against existing database ────────────────────────────────
  const { valid: validDiaries, skipped: skippedInDb } = checkAgainstExisting(afterFileDedup, existingDiaries);

  const timeTaken = Date.now() - startTime;

  return {
    totalRecords,
    validRecords: validDiaries.length,
    imported: 0, // Will be updated after actual import
    skippedDuplicateInFile: skippedInFile.length,
    skippedDuplicateInDatabase: skippedInDb.length,
    invalidRecords: invalidDetails.length,
    failedRecords: 0,
    timeTaken,
    skippedFileDetails: skippedInFile,
    skippedDatabaseDetails: skippedInDb,
    invalidDetails,
    validDiaries
  };
}
