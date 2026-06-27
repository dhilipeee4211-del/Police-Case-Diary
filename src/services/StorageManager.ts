const INDEXED_DB_NAME = 'GatewayRecoveryDB';
const OBJECT_STORE_NAME = 'states';
const DB_VERSION = 2;

class StorageManagerService {
  // LocalStorage Helpers
  public getLocalItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (err) {
      console.warn(`Failed to read key ${key} from localStorage:`, err);
      return defaultValue;
    }
  }

  public setLocalItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Failed to write key ${key} to localStorage:`, err);
    }
  }

  public removeLocalItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error(`Failed to remove key ${key} from localStorage:`, err);
    }
  }

  // IndexedDB Helpers
  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(INDEXED_DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
            db.createObjectStore(OBJECT_STORE_NAME);
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error || new Error('Failed to open IndexedDB'));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public getIndexedItem<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      this.getDB()
        .then((db) => {
          try {
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
              db.close();
              resolve(null);
              return;
            }
            const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
            const store = transaction.objectStore(OBJECT_STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
              db.close();
              resolve(request.result as T | null);
            };

            request.onerror = () => {
              db.close();
              resolve(null);
            };
          } catch (err) {
            console.warn('IndexedDB get error:', err);
            db.close();
            resolve(null);
          }
        })
        .catch((err) => {
          console.warn('IndexedDB open error in getIndexedItem:', err);
          resolve(null);
        });
    });
  }

  public setIndexedItem<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      this.getDB()
        .then((db) => {
          try {
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
              db.close();
              resolve();
              return;
            }
            const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(OBJECT_STORE_NAME);
            store.put(value, key);

            transaction.oncomplete = () => {
              db.close();
              resolve();
            };

            transaction.onerror = () => {
              db.close();
              resolve();
            };
          } catch (err) {
            console.warn('IndexedDB set error:', err);
            db.close();
            resolve();
          }
        })
        .catch((err) => {
          console.warn('IndexedDB open error in setIndexedItem:', err);
          resolve();
        });
    });
  }

  public removeIndexedItem(key: string): Promise<void> {
    return new Promise((resolve) => {
      this.getDB()
        .then((db) => {
          try {
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
              db.close();
              resolve();
              return;
            }
            const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(OBJECT_STORE_NAME);
            store.delete(key);

            transaction.oncomplete = () => {
              db.close();
              resolve();
            };

            transaction.onerror = () => {
              db.close();
              resolve();
            };
          } catch (err) {
            console.warn('IndexedDB delete error:', err);
            db.close();
            resolve();
          }
        })
        .catch((err) => {
          console.warn('IndexedDB open error in removeIndexedItem:', err);
          resolve();
        });
    });
  }
}

export const StorageManager = new StorageManagerService();
