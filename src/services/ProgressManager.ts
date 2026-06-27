import { ProgressMetadata, CaseDiary } from '../types';
import { StorageManager } from './StorageManager';
import { Logger } from './Logger';

class ProgressManagerService {
  private readonly progressPrefix = 'gateway_reconstruction_progress_';

  /**
   * Save progress state to LocalStorage.
   */
  public saveProgress(pdfId: string, metadata: ProgressMetadata): void {
    const key = `${this.progressPrefix}${pdfId}`;
    StorageManager.setLocalItem(key, metadata);
  }

  /**
   * Load progress state from LocalStorage.
   */
  public loadProgress(pdfId: string): ProgressMetadata | null {
    const key = `${this.progressPrefix}${pdfId}`;
    return StorageManager.getLocalItem<ProgressMetadata | null>(key, null);
  }

  /**
   * Remove progress state from LocalStorage.
   */
  public clearProgress(pdfId: string): void {
    const key = `${this.progressPrefix}${pdfId}`;
    StorageManager.removeLocalItem(key);
  }

  /**
   * Encodes progress metadata into a special CaseDiary object.
   * This object can be stored inside the JSONB `diaries` column in Supabase,
   * satisfying database progress persistence without changing the Supabase schema.
   */
  public serializeMetadataToDiary(metadata: ProgressMetadata): CaseDiary {
    return {
      id: '__reconstruction_metadata__',
      policeStation: '__reconstruction_metadata__',
      district: '',
      crNoAndSecOfLaw: metadata.pdfId, // store PDF ID
      dateTimeAndPlaceOfOccurrence: metadata.filename, // store filename
      dateOfCd: String(metadata.currentPage), // store current page
      dateOfReportTime: JSON.stringify({
        completedPages: metadata.completedPages,
        failedPages: metadata.failedPages,
        remainingPages: metadata.remainingPages,
        queueState: metadata.queueState,
        currentBatch: metadata.currentBatch,
        retryCount: metadata.retryCount,
        apiKeyIndex: metadata.apiKeyIndex,
        timestamp: metadata.timestamp,
        resumeToken: metadata.resumeToken
      }),
      complainant: '',
      accusedList: [],
      propertyLostDetails: '',
      recoveredPropertyDetails: '',
      dateOfPreviousCaseDiary: '',
      stageOfTheCase: '',
      courtRefNo: '',
      hearingNo: '',
      courtNameAndPlace: '',
      whetherMagistratePresent: 'YES',
      whetherAppPpPresent: 'YES',
      whetherDefenceCounselPresent: 'NO',
      noOfPwsCited: '0',
      noOfPwsExaminedSoFar: '0',
      noOfPwsExaminedToday: '0',
      totalNoOfAccusedCharged: '0',
      totalNoOfAccusedPresent: '0',
      noOfAccusedPresent: '0',
      noOfAccusedAbsent: '0',
      remarks: '',
      postedFor: '',
      nextHearingDate: '',
      attendedBy: '',
      isSavedDraft: false
    };
  }

  /**
   * Deserializes progress metadata from a special CaseDiary object.
   */
  public deserializeDiaryToMetadata(diary: CaseDiary): ProgressMetadata | null {
    if (diary.id !== '__reconstruction_metadata__' && diary.policeStation !== '__reconstruction_metadata__') {
      return null;
    }

    try {
      const details = JSON.parse(diary.dateOfReportTime);
      return {
        pdfId: diary.crNoAndSecOfLaw,
        filename: diary.dateTimeAndPlaceOfOccurrence,
        currentPage: Number(diary.dateOfCd),
        completedPages: details.completedPages || [],
        failedPages: details.failedPages || [],
        remainingPages: details.remainingPages || [],
        queueState: details.queueState || 'idle',
        currentBatch: details.currentBatch || 0,
        retryCount: details.retryCount || 0,
        apiKeyIndex: details.apiKeyIndex || 0,
        timestamp: details.timestamp || Date.now(),
        resumeToken: details.resumeToken
      };
    } catch (err) {
      console.error('Failed to parse progress metadata from diary item:', err);
      return null;
    }
  }

  /**
   * Filters out the metadata diaries from the active display list.
   */
  public filterMetadataDiaries(diaries: CaseDiary[]): CaseDiary[] {
    return diaries.filter(d => d.id !== '__reconstruction_metadata__');
  }

  /**
   * Extracts the progress metadata diary item from the array if it exists.
   */
  public extractMetadataDiary(diaries: CaseDiary[]): CaseDiary | undefined {
    return diaries.find(d => d.id === '__reconstruction_metadata__');
  }
}

export const ProgressManager = new ProgressManagerService();
