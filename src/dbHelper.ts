import { SavedDatabase, CaseDiary } from "./types";

const LOCAL_STORAGE_KEY_PREFIX = "case_diary_databases_";

// Helper to load databases from browser's local storage
function getLocalDatabases(userId: string): SavedDatabase[] {
  try {
    const data = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Failed to read databases from localStorage:", err);
    return [];
  }
}

// Helper to save databases to browser's local storage
function saveLocalDatabases(userId: string, databases: SavedDatabase[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(databases));
  } catch (err) {
    console.error("Failed to write databases to localStorage:", err);
  }
}

// Save database session (supports server sync with robust local storage fallback)
export async function saveSavedDatabase(
  name: string,
  diaries: CaseDiary[],
  userId: string,
  existingDbId?: string
): Promise<SavedDatabase> {
  const newDb: SavedDatabase = {
    id: existingDbId || `db-${Date.now()}`,
    userId,
    name,
    createdAt: Date.now(),
    diaries,
  };

  // First, always update our client-side localStorage backup cache
  const localDbs = getLocalDatabases(userId);
  const updatedLocal = localDbs.filter((db) => db.id !== newDb.id);
  updatedLocal.push(newDb);
  saveLocalDatabases(userId, updatedLocal);

  try {
    const response = await fetch('/api/db/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDb),
    });

    if (!response.ok) {
      console.warn(`Server-side database save failed (${response.status}), saved locally in browser instead.`);
    }
  } catch (err) {
    console.warn("Network/Server offline. Saved case database securely in local browser storage.", err);
  }

  return newDb;
}

// Get all databases for the current user (merges server and localStorage seamlessly)
export async function getSavedDatabases(userId: string): Promise<SavedDatabase[]> {
  const localDbs = getLocalDatabases(userId);

  try {
    const serverResponse = await fetch(`/api/db/list?userId=${encodeURIComponent(userId)}`);
    if (serverResponse.ok) {
      const result = await serverResponse.json();
      if (result.success && Array.isArray(result.databases)) {
        const serverDbs: SavedDatabase[] = result.databases;
        
        // Merge server and local databases (prefer local if newer, keep unique IDs)
        const mergedMap = new Map<string, SavedDatabase>();
        
        // Load server databases
        serverDbs.forEach((db) => mergedMap.set(db.id, db));
        
        // Load local databases (if some local changes are newer or not synced)
        localDbs.forEach((db) => {
          const existing = mergedMap.get(db.id);
          if (!existing || db.createdAt > (existing.createdAt || 0)) {
            mergedMap.set(db.id, db);
          }
        });

        const mergedDbs = Array.from(mergedMap.values());
        
        // Update local storage cache to match merged results
        saveLocalDatabases(userId, mergedDbs);
        
        // Sort descending by creation date
        return mergedDbs.sort((a, b) => b.createdAt - a.createdAt);
      }
    }
  } catch (err) {
    console.warn("Could not reach database server, loading from local browser storage cache:", err);
  }

  // Fallback to local storage if server is completely offline or unconfigured
  return localDbs.sort((a, b) => b.createdAt - a.createdAt);
}

// Delete a database session (deletes from both server and local storage)
export async function deleteSavedDatabase(id: string, userId: string): Promise<void> {
  // 1. Delete from local storage
  const localDbs = getLocalDatabases(userId);
  const updatedLocal = localDbs.filter((db) => db.id !== id);
  saveLocalDatabases(userId, updatedLocal);

  // 2. Try to delete from server
  try {
    const serverResponse = await fetch('/api/db/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId }),
    });

    if (!serverResponse.ok) {
      console.warn(`Server delete returned status ${serverResponse.status}, deleted locally.`);
    }
  } catch (err) {
    console.warn("Could not sync deletion with server (server offline/unconfigured), deleted locally.", err);
  }
}
