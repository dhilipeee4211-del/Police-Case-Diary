import { CaseDiary, ReconstructionChunk, ReconstructionQueue } from '../types';
import { ProgressManager } from './ProgressManager';
import { Logger } from './Logger';

class ResumeManagerService {
  /**
   * Determine which pages are completed and fail-safely slice the remaining queue.
   */
  public filterRemainingChunks(
    chunks: ReconstructionChunk[],
    completedPages: number[]
  ): ReconstructionChunk[] {
    const completedSet = new Set(completedPages);
    
    return chunks.map(chunk => {
      // Check if all pages in this chunk range are already in completedPages list
      let allCompleted = true;
      for (let p = chunk.startPage; p <= chunk.endPage; p++) {
        if (!completedSet.has(p)) {
          allCompleted = false;
          break;
        }
      }

      if (allCompleted) {
        return {
          ...chunk,
          status: 'completed' as const
        };
      }
      return chunk;
    });
  }

  /**
   * Deduplicates case diaries based on unique key constraints.
   */
  public deduplicateDiaries(diaries: CaseDiary[]): CaseDiary[] {
    const seenKeys = new Set<string>();
    const filtered: CaseDiary[] = [];

    diaries.forEach(diary => {
      // Build unique key based on schema identifiers
      const key = `${(diary.crNoAndSecOfLaw || '').trim().toLowerCase()}_${(diary.policeStation || '').trim().toLowerCase()}_${(diary.dateOfCd || '').trim().toLowerCase()}`;
      
      // Always allow the metadata entry
      if (diary.id === '__reconstruction_metadata__') {
        filtered.push(diary);
        return;
      }

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        filtered.push(diary);
      } else {
        Logger.log(`Duplicate diary entry detected and removed: ${diary.crNoAndSecOfLaw} (${diary.dateOfCd})`, 'WARNING');
      }
    });

    return filtered;
  }
}

export const ResumeManager = new ResumeManagerService();
