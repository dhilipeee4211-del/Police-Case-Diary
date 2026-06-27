import { ApiKeyStatus } from '../types';
import { StorageManager } from './StorageManager';
import { Logger } from './Logger';

const API_KEYS_STORAGE_KEY = 'gateway_gemini_api_keys';
const ACTIVE_KEY_INDEX_KEY = 'gateway_gemini_active_key_index';

class ApiKeyManagerService {
  private keys: string[] = [];
  private activeIndex: number = 0;
  private keyStatuses: ApiKeyStatus[] = [];

  constructor() {
    this.loadKeys();
  }

  public loadKeys(): void {
    this.keys = StorageManager.getLocalItem<string[]>(API_KEYS_STORAGE_KEY, []);
    this.activeIndex = StorageManager.getLocalItem<number>(ACTIVE_KEY_INDEX_KEY, 0);
    
    // Bounds check
    if (this.activeIndex >= this.keys.length) {
      this.activeIndex = 0;
    }

    this.initializeStatuses();
  }

  private initializeStatuses(): void {
    this.keyStatuses = this.keys.map((key, index) => {
      const existing = this.keyStatuses.find(s => s.key === key);
      return {
        key,
        index,
        status: existing ? existing.status : 'active',
        requestsProcessed: existing ? existing.requestsProcessed : 0,
        lastUsed: existing ? existing.lastUsed : 0,
        errorMessage: existing ? existing.errorMessage : undefined
      };
    });
  }

  public getKeys(): string[] {
    return [...this.keys];
  }

  public setKeys(newKeys: string[]): void {
    // Sanitize and filter empty values
    const cleaned = newKeys.map(k => k.trim()).filter(Boolean);
    this.keys = cleaned;
    StorageManager.setLocalItem(API_KEYS_STORAGE_KEY, cleaned);
    
    // Reset index if bounds changed
    if (this.activeIndex >= cleaned.length) {
      this.activeIndex = 0;
      StorageManager.setLocalItem(ACTIVE_KEY_INDEX_KEY, 0);
    }
    
    this.initializeStatuses();
    Logger.log(`API key list updated. Total keys configured: ${cleaned.length}`, 'SYSTEM');
  }

  public getActiveKey(): string | null {
    if (this.keys.length === 0) {
      return null;
    }
    return this.keys[this.activeIndex] || null;
  }

  public getActiveKeyIndex(): number {
    return this.activeIndex;
  }

  public incrementRequests(): void {
    const status = this.keyStatuses[this.activeIndex];
    if (status) {
      status.requestsProcessed++;
      status.lastUsed = Date.now();
    }
  }

  /**
   * Rotate to the next available (non-exhausted) key.
   * Returns the new active key, or null if all keys are exhausted.
   */
  public rotateKey(): string | null {
    if (this.keys.length === 0) {
      return null;
    }

    const startIndex = this.activeIndex;
    let nextIndex = (this.activeIndex + 1) % this.keys.length;

    while (nextIndex !== startIndex) {
      const status = this.keyStatuses[nextIndex];
      if (status && status.status === 'active') {
        this.activeIndex = nextIndex;
        StorageManager.setLocalItem(ACTIVE_KEY_INDEX_KEY, nextIndex);
        Logger.log(`Rotated to API Key index ${nextIndex + 1} of ${this.keys.length}`, 'SYSTEM');
        return this.keys[nextIndex];
      }
      nextIndex = (nextIndex + 1) % this.keys.length;
    }

    // Checked all keys, none are active
    Logger.log('API key rotation attempted, but all configured keys are exhausted.', 'ERROR');
    return null;
  }

  public markExhausted(key: string, errorMsg?: string): void {
    const status = this.keyStatuses.find(s => s.key === key);
    if (status) {
      status.status = 'exhausted';
      status.errorMessage = errorMsg || 'Quota exceeded (429)';
      Logger.log(`API Key index ${status.index + 1} marked as EXHAUSTED: ${status.errorMessage}`, 'WARNING');
    }
  }

  public resetStatus(): void {
    this.keyStatuses.forEach(s => {
      s.status = 'active';
      s.errorMessage = undefined;
    });
    this.activeIndex = 0;
    StorageManager.setLocalItem(ACTIVE_KEY_INDEX_KEY, 0);
    Logger.log('All API Key statuses reset to ACTIVE.', 'SYSTEM');
  }

  public getKeyStatuses(): ApiKeyStatus[] {
    return [...this.keyStatuses];
  }

  public isAllExhausted(): boolean {
    if (this.keys.length === 0) {
      return false; // Server fallback can still be tried
    }
    return this.keyStatuses.every(s => s.status === 'exhausted');
  }
}

export const ApiKeyManager = new ApiKeyManagerService();
