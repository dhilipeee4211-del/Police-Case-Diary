import { CaseDiary } from '../types';
import { ApiKeyManager } from './ApiKeyManager';
import { RetryManager } from './RetryManager';
import { ValidationService } from './ValidationService';
import { Logger } from './Logger';

export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
}

class GeminiClientService {
  private readonly timeoutMs = 90000; // 90-second timeout limit for large requests

  /**
   * Request Case Diary extraction from Gemini API via server endpoints.
   */
  public async extractCaseDiaries(
    mode: 'free' | 'direct',
    data: string,
    filename: string,
    onProgress: (step: string) => void
  ): Promise<CaseDiary[]> {
    const apiEndpoint = mode === 'free' ? '/api/extract-text' : '/api/extract';
    const requestBody = mode === 'free' 
      ? { text: data, filename }
      : { file: data, filename };

    let retryCount = 0;

    while (true) {
      const activeKey = ApiKeyManager.getActiveKey();
      const keyIndexStr = activeKey ? `Key index ${ApiKeyManager.getActiveKeyIndex() + 1}` : 'Server default keys';

      Logger.log(`Sending extraction request to ${apiEndpoint} using ${keyIndexStr}...`, 'AI');

      // Set up timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (activeKey) {
          headers['x-gemini-key'] = activeKey;
        }

        ApiKeyManager.incrementRequests();

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            throw new Error('Expected JSON response from server, but received: ' + contentType);
          }

          const result = await response.json();

          // Server fallback used due to internal quota exhaustion
          if (result && result.fallbackUsed) {
            const errorMsg = result.message || 'Gemini API keys exhausted on server side fallback';
            throw new QuotaExhaustedError(errorMsg);
          }

          if (result && result.success && result.data) {
            // Process and validate diaries list
            const rawJson = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
            const parsedDiaries = ValidationService.parseAndValidateDiaries(rawJson);
            Logger.log(`Successfully extracted and validated ${parsedDiaries.length} records.`, 'SUCCESS');
            return parsedDiaries;
          } else {
            throw new Error(result.error || 'Server extraction endpoint returned success: false');
          }
        }

        // Handle error responses (status codes >= 400)
        const status = response.status;
        const errText = await response.text();
        let errMsg = '';
        try {
          const parsedErr = JSON.parse(errText);
          errMsg = parsedErr.error || parsedErr.message || errText;
        } catch {
          errMsg = errText || `HTTP Status ${status}`;
        }

        const isQuotaError =
          status === 429 ||
          errMsg.toLowerCase().includes('quota exceeded') ||
          errMsg.toLowerCase().includes('resource_exhausted') ||
          errMsg.toLowerCase().includes('rate limit');

        if (isQuotaError) {
          Logger.log(`Quota exceeded (429) detected for ${keyIndexStr}.`, 'WARNING');
          if (activeKey) {
            ApiKeyManager.markExhausted(activeKey, errMsg);
            const nextKey = ApiKeyManager.rotateKey();
            if (nextKey) {
              onProgress('Quota exceeded. Rotating Gemini API key...');
              continue; // Immediately retry with the rotated key
            }
          }
          // If we have no more keys to rotate to
          throw new QuotaExhaustedError(`All configured API keys have been exhausted. Queue paused.`);
        }

        // Non-quota error, check retry capability
        throw { status, message: errMsg };

      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err instanceof QuotaExhaustedError) {
          throw err;
        }

        // Check if aborted due to timeout
        let finalError = err;
        if (err.name === 'AbortError') {
          finalError = new Error(`Request timed out after ${this.timeoutMs / 1000}s`);
        }

        if (RetryManager.isRetryable(finalError) && retryCount < RetryManager.getMaxRetries()) {
          const delay = RetryManager.getDelay(retryCount);
          retryCount++;
          Logger.log(`Transient extraction failure: ${finalError.message || finalError}. Retrying in ${delay / 1000}s... (Attempt ${retryCount}/${RetryManager.getMaxRetries()})`, 'SYSTEM');
          onProgress(`Retrying request in ${delay / 1000}s... (Attempt ${retryCount}/${RetryManager.getMaxRetries()})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If not retryable or max retries exceeded, propagate error
        throw finalError;
      }
    }
  }
}

export const GeminiClient = new GeminiClientService();
