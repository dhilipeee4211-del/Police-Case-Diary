import { CaseDiary } from '../types';
import { Logger } from './Logger';

class ValidationServiceClass {
  /**
   * Cleans, repairs, and parses structured JSON output from Gemini.
   */
  public parseAndValidateDiaries(jsonStr: string): CaseDiary[] {
    let cleaned = jsonStr.trim();
    
    // Strip markdown wrappers
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    let parsed: any = null;

    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      Logger.log('Initial JSON parse failed. Attempting robust repairs...', 'WARNING');
      
      // Repair: Fix invalid backslashes (e.g. unescaped backslashes not part of valid escape codes)
      let repaired = cleaned.replace(/\\(?!["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

      // Repair: Remove trailing commas in arrays/objects
      repaired = repaired.replace(/,(\s*[\]}])/g, '$1');

      try {
        parsed = JSON.parse(repaired);
      } catch (err2) {
        Logger.log('Second JSON parse failed. Attempting bracket-balancing repair...', 'WARNING');
        try {
          repaired = this.balanceBrackets(repaired);
          parsed = JSON.parse(repaired);
        } catch (err3: any) {
          throw new Error(`JSON Repair failed. Invalid JSON returned by Gemini API: ${err3.message || err3}`);
        }
      }
    }

    if (!parsed) {
      throw new Error('Gemini API returned an empty or invalid JSON response.');
    }

    // Standardize to array
    const rawList = Array.isArray(parsed) ? parsed : [parsed];
    
    // Map and validate fields to strictly match the CaseDiary shape
    return rawList.map((item, index) => {
      return {
        id: item.id || `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
        policeStation: this.sanitizeString(item.policeStation, 'VIKKIRAMANGALAM'),
        district: this.sanitizeString(item.district, 'ARIYALUR'),
        crNoAndSecOfLaw: this.sanitizeString(item.crNoAndSecOfLaw, '0288/2018 U/s 143, 341 IPC'),
        dateTimeAndPlaceOfOccurrence: this.sanitizeString(item.dateTimeAndPlaceOfOccurrence),
        dateOfCd: this.sanitizeString(item.dateOfCd),
        dateOfReportTime: this.sanitizeString(item.dateOfReportTime),
        complainant: this.sanitizeString(item.complainant),
        accusedList: Array.isArray(item.accusedList) 
          ? item.accusedList.map((acc: any, aIdx: number) => ({
              sNo: this.sanitizeString(acc.sNo, String(aIdx + 1)),
              nameAndAddress: this.sanitizeString(acc.nameAndAddress, 'Unknown Accused')
            }))
          : [],
        propertyLostDetails: this.sanitizeString(item.propertyLostDetails, 'Nil'),
        recoveredPropertyDetails: this.sanitizeString(item.recoveredPropertyDetails, 'Nil'),
        dateOfPreviousCaseDiary: this.sanitizeString(item.dateOfPreviousCaseDiary),
        stageOfTheCase: this.sanitizeString(item.stageOfTheCase, 'PENDING TRIAL'),
        courtRefNo: this.sanitizeString(item.courtRefNo),
        hearingNo: this.sanitizeString(item.hearingNo, '1'),
        courtNameAndPlace: this.sanitizeString(item.courtNameAndPlace),
        whetherMagistratePresent: this.sanitizeYesNo(item.whetherMagistratePresent, 'YES'),
        whetherAppPpPresent: this.sanitizeYesNo(item.whetherAppPpPresent, 'YES'),
        whetherDefenceCounselPresent: this.sanitizeYesNo(item.whetherDefenceCounselPresent, 'NO'),
        noOfPwsCited: this.sanitizeNumeric(item.noOfPwsCited),
        noOfPwsExaminedSoFar: this.sanitizeNumeric(item.noOfPwsExaminedSoFar),
        noOfPwsExaminedToday: this.sanitizeNumeric(item.noOfPwsExaminedToday),
        totalNoOfAccusedCharged: this.sanitizeNumeric(item.totalNoOfAccusedCharged, '1'),
        totalNoOfAccusedPresent: this.sanitizeNumeric(item.totalNoOfAccusedPresent || item.noOfAccusedPresent), // support fallback
        noOfAccusedPresent: this.sanitizeNumeric(item.noOfAccusedPresent || item.totalNoOfAccusedPresent),
        noOfAccusedAbsent: this.sanitizeNumeric(item.noOfAccusedAbsent),
        remarks: this.sanitizeString(item.remarks, 'No remarks transcribed.'),
        postedFor: this.sanitizeString(item.postedFor),
        nextHearingDate: this.sanitizeString(item.nextHearingDate),
        attendedBy: this.sanitizeString(item.attendedBy),
        isSavedDraft: item.isSavedDraft ?? true,
        dbId: item.dbId
      };
    });
  }

  private sanitizeString(val: any, defaultVal = ''): string {
    if (val === undefined || val === null) return defaultVal;
    return String(val).trim();
  }

  private sanitizeYesNo(val: any, defaultVal: 'YES' | 'NO' = 'YES'): string {
    if (!val) return defaultVal;
    const clean = String(val).trim().toUpperCase();
    return clean === 'YES' || clean === 'NO' ? clean : defaultVal;
  }

  private sanitizeNumeric(val: any, defaultVal = '0'): string {
    if (val === undefined || val === null) return defaultVal;
    const clean = String(val).trim().replace(/[^\d]/g, '');
    return clean || defaultVal;
  }

  /**
   * Repairs truncated JSON string by matching brackets and quotes.
   */
  private balanceBrackets(str: string): string {
    let state = 'normal'; // 'normal', 'string', 'escape'
    const stack: string[] = [];
    let clean = str.trim();

    // Iterate character by character to track open states
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      if (state === 'normal') {
        if (char === '"') {
          state = 'string';
        } else if (char === '{' || char === '[') {
          stack.push(char);
        } else if (char === '}') {
          if (stack[stack.length - 1] === '{') {
            stack.pop();
          }
        } else if (char === ']') {
          if (stack[stack.length - 1] === '[') {
            stack.pop();
          }
        }
      } else if (state === 'string') {
        if (char === '\\') {
          state = 'escape';
        } else if (char === '"') {
          state = 'normal';
        }
      } else if (state === 'escape') {
        state = 'string';
      }
    }

    // If truncated inside escape character, drop it
    if (state === 'escape') {
      clean = clean.substring(0, clean.length - 1);
      state = 'string';
    }

    // If truncated inside string, close the quote
    if (state === 'string') {
      clean += '"';
    }

    // Pop opening elements from stack and append matching closing items
    while (stack.length > 0) {
      const last = stack.pop();
      if (last === '{') {
        // Strip trailing comma before closing object if any
        clean = clean.trim().replace(/,$/, '');
        clean += '}';
      } else if (last === '[') {
        // Strip trailing comma before closing array if any
        clean = clean.trim().replace(/,$/, '');
        clean += ']';
      }
    }

    return clean;
  }
}

export const ValidationService = new ValidationServiceClass();
