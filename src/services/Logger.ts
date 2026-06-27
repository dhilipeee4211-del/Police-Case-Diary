export type LogType = 'SYSTEM' | 'OCR' | 'AI' | 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export interface LogMessage {
  timestamp: number;
  message: string;
  type: LogType;
  formatted: string;
}

export type LogListener = (logs: LogMessage[]) => void;

class LoggerService {
  private logs: LogMessage[] = [];
  private listeners: Set<LogListener> = new Set();

  public log(message: string, type: LogType = 'INFO'): void {
    const timestamp = Date.now();
    const dateStr = new Date(timestamp).toLocaleTimeString();
    const formatted = `[${dateStr}] [${type}] ${message}`;

    const newLog: LogMessage = {
      timestamp,
      message,
      type,
      formatted,
    };

    this.logs.push(newLog);
    
    // Log to standard console as well
    if (type === 'ERROR') {
      console.error(formatted);
    } else if (type === 'WARNING') {
      console.warn(formatted);
    } else if (type === 'SUCCESS') {
      console.log('%c' + formatted, 'color: green; font-weight: bold;');
    } else if (type === 'AI') {
      console.log('%c' + formatted, 'color: darkorange;');
    } else {
      console.log(formatted);
    }

    this.notifyListeners();
  }

  public getLogs(): LogMessage[] {
    return [...this.logs];
  }

  public getFormattedLogs(): string[] {
    return this.logs.map(l => l.formatted);
  }

  public clear(): void {
    this.logs = [];
    this.notifyListeners();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    // Send current logs to listener immediately
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const currentLogs = [...this.logs];
    this.listeners.forEach(listener => {
      try {
        listener(currentLogs);
      } catch (err) {
        console.error('Error notifying log listener:', err);
      }
    });
  }
}

export const Logger = new LoggerService();
