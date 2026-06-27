import { CaseDiary } from '../types';
import { PdfReader } from './PdfReader';
import { GeminiClient } from './GeminiClient';

class ChunkProcessorClass {
  /**
   * Processes a specific chunk/page range.
   * Disposes of temporary memory structures immediately after completion.
   */
  public async processChunk(
    file: File,
    mode: 'free' | 'direct',
    startPage: number,
    endPage: number,
    onProgress: (step: string) => void
  ): Promise<CaseDiary[]> {
    let payload = '';

    if (mode === 'free') {
      // 1. In local text mode: extract and combine text for all pages in this chunk range
      let combinedText = '';
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        const pageText = await PdfReader.extractPageText(file, pageNum, onProgress);
        combinedText += `\n\n--- PAGE ${pageNum} ---\n\n` + pageText;
      }
      payload = combinedText;
    } else {
      // 2. In direct mode: slice pages range and convert to base64 PDF
      onProgress(`Slicing pages ${startPage} to ${endPage} from source document...`);
      payload = await PdfReader.extractPagesRangePdfBytes(file, startPage, endPage);
    }

    // Call Gemini API client to extract data
    onProgress(`Structuring page(s) ${startPage}-${endPage} using Gemini AI...`);
    const diaries = await GeminiClient.extractCaseDiaries(mode, payload, file.name, onProgress);

    // Explicitly run garbage collection cleanup on reader to dispose OCR workers
    // if we completed a scanned chunk, to prevent memory creep
    if (mode === 'free') {
      await PdfReader.disposeOCRWorker();
    }

    return diaries;
  }
}

export const ChunkProcessor = new ChunkProcessorClass();
