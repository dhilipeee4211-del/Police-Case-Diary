import { ApiKeyStatus } from '../types';
import { StorageManager } from './StorageManager';
import { Logger } from './Logger';

class ApiKeyManagerService {
  private totalKeys: number = 0;
  private activeIndex: number = 0;
  private keyStatuses: ApiKeyStatus[] = [];
  private lastSwitchTime: number = 0;
  private processedRequestsCount: number = 0;
  private initialized: boolean = false;

  constructor() {
    this.loadState();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const response = await fetch('/api/engine/status');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.totalKeys = data.totalKeys;
          this.initializeStatuses();
          this.initialized = true;
          Logger.log(`Gemini Engine Status: Loaded ${this.totalKeys} keys from environment variables.`, 'SYSTEM');
        }
      }
    } catch (err) {
      console.error("Failed to initialize ApiKeyManager from backend:", err);
    }
  }

  private loadState(): void {
    this.activeIndex = StorageManager.getLocalItem<number>('gateway_backend_active_key_index', 0);
    this.lastSwitchTime = StorageManager.getLocalItem<number>('gateway_backend_last_switch_time', 0);
    this.processedRequestsCount = StorageManager.getLocalItem<number>('gateway_backend_processed_requests', 0);
    this.initializeStatuses();
  }

  private initializeStatuses(): void {
    const statuses: ApiKeyStatus[] = [];
    for (let i = 0; i < this.totalKeys; i++) {
      const existing = this.keyStatuses[i];
      statuses.push({
        key: `Key #${i + 1}`,
        index: i,
        status: existing ? existing.status : 'active',
        requestsProcessed: existing ? existing.requestsProcessed : 0,
        lastUsed: existing ? existing.lastUsed : 0,
        errorMessage: existing ? existing.errorMessage : undefined
      });
    }
    this.keyStatuses = statuses;
  }

  public getTotalKeysCount(): number {
    return this.totalKeys;
  }

  public getActiveKeyIndex(): number {
    return this.activeIndex;
  }

  public getActiveKey(): string | null {
    if (this.totalKeys === 0) return null;
    return `Index #${this.activeIndex}`;
  }

  public incrementRequests(): void {
    this.processedRequestsCount++;
    StorageManager.setLocalItem('gateway_backend_processed_requests', this.processedRequestsCount);
    const status = this.keyStatuses[this.activeIndex];
    if (status) {
      status.requestsProcessed++;
      status.lastUsed = Date.now();
    }
  }

  public getProcessedRequestsCount(): number {
    return this.processedRequestsCount;
  }

  public getLastSwitchTime(): number {
    return this.lastSwitchTime;
  }

  public rotateKey(newIndex?: number): void {
    const oldIndex = this.activeIndex;
    
    if (newIndex !== undefined) {
      this.activeIndex = newIndex % Math.max(1, this.totalKeys);
    } else {
      this.activeIndex = (this.activeIndex + 1) % Math.max(1, this.totalKeys);
    }

    if (this.activeIndex !== oldIndex) {
      this.lastSwitchTime = Date.now();
      StorageManager.setLocalItem('gateway_backend_last_switch_time', this.lastSwitchTime);
      StorageManager.setLocalItem('gateway_backend_active_key_index', this.activeIndex);
      Logger.log(`Automatically switching from Key #${oldIndex + 1} to Key #${this.activeIndex + 1}...`, 'WARNING');
    }
  }

  public markExhausted(index: number, errorMsg?: string): void {
    const status = this.keyStatuses[index];
    if (status) {
      status.status = 'exhausted';
      status.errorMessage = errorMsg || 'Quota Exceeded (429)';
      Logger.log(`Key #${index + 1} marked as EXHAUSTED: ${status.errorMessage}`, 'WARNING');
    }
  }

  public resetStatus(): void {
    this.keyStatuses.forEach(s => {
      s.status = 'active';
      s.errorMessage = undefined;
    });
    this.activeIndex = 0;
    this.lastSwitchTime = 0;
    StorageManager.setLocalItem('gateway_backend_active_key_index', 0);
    StorageManager.setLocalItem('gateway_backend_last_switch_time', 0);
    Logger.log('All API Key statuses reset to ACTIVE.', 'SYSTEM');
  }

  public getKeyStatuses(): ApiKeyStatus[] {
    return [...this.keyStatuses];
  }

  public isAllExhausted(): boolean {
    if (this.totalKeys === 0) return false;
    return this.keyStatuses.every(s => s.status === 'exhausted');
  }

  // Backwards compatibility with deleted frontend inputs
  public setKeys(_keys: string[]): void {}
  public getKeys(): string[] { return []; }
}

export const ApiKeyManager = new ApiKeyManagerService();
