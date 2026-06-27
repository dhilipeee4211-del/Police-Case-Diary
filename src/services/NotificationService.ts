export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationEvent {
  message: string;
  type: NotificationType;
  title?: string;
  duration?: number;
}

export type NotificationListener = (event: NotificationEvent) => void;

class NotificationServiceClass {
  private listeners: Set<NotificationListener> = new Set();

  public notify(message: string, type: NotificationType = 'info', title?: string, duration = 4000): void {
    const event: NotificationEvent = { message, type, title, duration };
    this.listeners.forEach(l => {
      try {
        l(event);
      } catch (err) {
        console.error('Notification listener failed:', err);
      }
    });
  }

  public success(message: string, title?: string): void {
    this.notify(message, 'success', title);
  }

  public error(message: string, title?: string): void {
    this.notify(message, 'error', title);
  }

  public warn(message: string, title?: string): void {
    this.notify(message, 'warning', title);
  }

  public info(message: string, title?: string): void {
    this.notify(message, 'info', title);
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const NotificationService = new NotificationServiceClass();
