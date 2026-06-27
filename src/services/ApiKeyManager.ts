import { ApiKeyStatus, RotationHistoryEvent } from '../types';
import { StorageManager } from './StorageManager';
import { Logger } from './Logger';

type ApiKeyManagerListener = () => void;

class ApiKeyManagerService {
  private totalKeys: number = 0;
  private activeIndex: number = 0;
  private keyStatuses: ApiKeyStatus[] = [];
  private lastSwitchTime: number = 0;
  private processedRequestsCount: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private initialized: boolean = false;
  private rotationHistory: RotationHistoryEvent[] = [];
  private listeners: Set<ApiKeyManagerListener> = new Set();

  constructor() {
    this.loadState();
  }

  public subscribe(listener: ApiKeyManagerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => {
      try {
        l();
      } catch (err) {
        console.error('Error notifying ApiKeyManager listener:', err);
      }
    });
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
          this.notifyListeners();
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
    this.successfulRequests = StorageManager.getLocalItem<number>('gateway_backend_successful_requests', 0);
    this.failedRequests = StorageManager.getLocalItem<number>('gateway_backend_failed_requests', 0);
    this.rotationHistory = StorageManager.getLocalItem<RotationHistoryEvent[]>('gateway_backend_rotation_history', []);
    this.initializeStatuses();
  }

  private initializeStatuses(): void {
    const statuses: ApiKeyStatus[] = [];
    for (let i = 0; i < this.totalKeys; i++) {
      const existing = this.keyStatuses[i];
      statuses.push({
        key: `Key #${i + 1}`,
        index: i,
        status: existing ? existing.status : (i === this.activeIndex ? 'active' : 'waiting'),
        requestsProcessed: existing ? existing.requestsProcessed : 0,
        lastUsed: existing ? existing.lastUsed : 0,
        errorMessage: existing ? existing.errorMessage : undefined,
        requests: existing ? existing.requests : 0,
        retries: existing ? existing.retries : 0,
        currentRetry: existing ? existing.currentRetry : undefined,
        maxRetry: existing ? existing.maxRetry : undefined,
        retryDelay: existing ? existing.retryDelay : undefined,
        lastRetryTime: existing ? existing.lastRetryTime : undefined,
        switchTime: existing ? existing.switchTime : undefined,
        reason: existing ? existing.reason : undefined,
        processing: existing ? existing.processing : undefined
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
      status.requests++;
      status.lastUsed = Date.now();
      status.status = 'active';
    }
    this.notifyListeners();
  }

  public incrementSuccess(): void {
    this.successfulRequests++;
    StorageManager.setLocalItem('gateway_backend_successful_requests', this.successfulRequests);
    const status = this.keyStatuses[this.activeIndex];
    if (status) {
      status.status = 'healthy';
    }
    this.notifyListeners();
  }

  public incrementFailure(): void {
    this.failedRequests++;
    StorageManager.setLocalItem('gateway_backend_failed_requests', this.failedRequests);
    this.notifyListeners();
  }

  public getProcessedRequestsCount(): number {
    return this.processedRequestsCount;
  }

  public getSuccessfulRequestsCount(): number {
    return this.successfulRequests;
  }

  public getFailedRequestsCount(): number {
    return this.failedRequests;
  }

  public getLastSwitchTime(): number {
    return this.lastSwitchTime;
  }

  public updateProcessing(index: number, page: string): void {
    const status = this.keyStatuses[index];
    if (status) {
      status.processing = page;
      if (status.status !== 'quota_exhausted' && status.status !== 'auth_failed') {
        status.status = 'active';
      }
    }
    this.notifyListeners();
  }

  public updateRetryStatus(index: number, current: number, max: number, delaySeconds: number): void {
    const status = this.keyStatuses[index];
    if (status) {
      status.status = 'retrying';
      status.currentRetry = current;
      status.maxRetry = max;
      status.retryDelay = delaySeconds;
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      status.lastRetryTime = timeStr;
      status.retries++;

      console.log(`%c🟠 Retry ${current}/${max}`, 'color: orange; font-weight: bold');
    }
    this.notifyListeners();
  }

  public rotateKey(newIndex?: number, reason: string = 'Automatic Rotation'): void {
    const oldIndex = this.activeIndex;
    const oldKeyNum = `Key #${oldIndex + 1}`;
    
    if (newIndex !== undefined) {
      this.activeIndex = newIndex % Math.max(1, this.totalKeys);
    } else {
      this.activeIndex = (this.activeIndex + 1) % Math.max(1, this.totalKeys);
    }

    const newKeyNum = `Key #${this.activeIndex + 1}`;

    if (this.activeIndex !== oldIndex) {
      this.lastSwitchTime = Date.now();
      const switchTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      
      StorageManager.setLocalItem('gateway_backend_last_switch_time', this.lastSwitchTime);
      StorageManager.setLocalItem('gateway_backend_active_key_index', this.activeIndex);
      
      const oldStatus = this.keyStatuses[oldIndex];
      if (oldStatus && oldStatus.status === 'active') {
        oldStatus.status = 'waiting';
      }
      
      const newStatus = this.keyStatuses[this.activeIndex];
      if (newStatus) {
        newStatus.status = 'active';
        newStatus.switchTime = switchTimeStr;
      }

      console.log(`%c🔄 Switching to ${newKeyNum}`, 'color: dodgerblue; font-weight: bold');
      console.log(`%c🟢 ${newKeyNum} Activated`, 'color: green; font-weight: bold');

      this.addHistoryEvent({
        time: switchTimeStr,
        keyNumber: newKeyNum,
        previousStatus: 'Waiting',
        newStatus: 'Active',
        reason,
        page: newStatus?.processing || 'N/A',
        retries: String(newStatus?.retries || 0)
      });
      
      Logger.log(`Automatically switching from ${oldKeyNum} to ${newKeyNum}...`, 'WARNING');
    }
    this.notifyListeners();
  }

  public markExhausted(index: number, errorMsg?: string): void {
    const status = this.keyStatuses[index];
    if (status && status.status !== 'quota_exhausted') {
      const isAuthError = errorMsg?.includes('API_KEY_INVALID') || errorMsg?.includes('API key not valid');
      status.status = isAuthError ? 'auth_failed' : 'quota_exhausted';
      status.errorMessage = errorMsg || 'Quota Exceeded (429)';
      status.reason = isAuthError ? 'API_KEY_INVALID' : 'RESOURCE_EXHAUSTED';
      
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      status.switchTime = timeStr;

      console.log(`%c🔴 Key #${index + 1} Quota Exhausted`, 'color: red; font-weight: bold');

      this.addHistoryEvent({
        time: timeStr,
        keyNumber: `Key #${index + 1}`,
        previousStatus: 'Active',
        newStatus: isAuthError ? 'Authentication Failed' : 'Quota Exhausted',
        reason: status.reason,
        page: status.processing || 'N/A',
        retries: String(status.retries)
      });

      Logger.log(`Key #${index + 1} marked as EXHAUSTED: ${status.errorMessage}`, 'WARNING');
    }
    this.notifyListeners();
  }

  public addHistoryEvent(event: RotationHistoryEvent): void {
    this.rotationHistory = [event, ...this.rotationHistory].slice(0, 100);
    StorageManager.setLocalItem('gateway_backend_rotation_history', this.rotationHistory);
    this.notifyListeners();
  }

  public getRotationHistory(): RotationHistoryEvent[] {
    return this.rotationHistory;
  }

  public resetStatus(): void {
    this.keyStatuses.forEach((s, i) => {
      s.status = i === 0 ? 'active' : 'waiting';
      s.errorMessage = undefined;
      s.requests = 0;
      s.requestsProcessed = 0;
      s.retries = 0;
      s.currentRetry = undefined;
      s.maxRetry = undefined;
      s.retryDelay = undefined;
      s.lastRetryTime = undefined;
      s.switchTime = undefined;
      s.reason = undefined;
      s.processing = undefined;
    });
    this.activeIndex = 0;
    this.lastSwitchTime = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.processedRequestsCount = 0;
    this.rotationHistory = [];
    
    StorageManager.setLocalItem('gateway_backend_active_key_index', 0);
    StorageManager.setLocalItem('gateway_backend_last_switch_time', 0);
    StorageManager.setLocalItem('gateway_backend_processed_requests', 0);
    StorageManager.setLocalItem('gateway_backend_successful_requests', 0);
    StorageManager.setLocalItem('gateway_backend_failed_requests', 0);
    StorageManager.setLocalItem('gateway_backend_rotation_history', []);
    
    Logger.log('All API Key statuses reset to ACTIVE.', 'SYSTEM');
    this.notifyListeners();
  }

  public getKeyStatuses(): ApiKeyStatus[] {
    return [...this.keyStatuses];
  }

  public isAllExhausted(): boolean {
    if (this.totalKeys === 0) return false;
    return this.keyStatuses.every(s => s.status === 'quota_exhausted' || s.status === 'auth_failed');
  }

  public setKeys(_keys: string[]): void {}
  public getKeys(): string[] { return []; }
}

export const ApiKeyManager = new ApiKeyManagerService();
