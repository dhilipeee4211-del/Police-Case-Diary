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
  const localDbs = getLocalDatabases(userId);
  const existingLocal = localDbs.find(db => db.id === existingDbId);

  const newDb: SavedDatabase = {
    id: existingDbId || `db-${Date.now()}`,
    userId,
    name,
    createdAt: Date.now(),
    diaries,
    synced: existingLocal ? existingLocal.synced : false,
  };

  // First, always update our client-side localStorage backup cache
  const updatedLocal = localDbs.filter((db) => db.id !== newDb.id);
  updatedLocal.push(newDb);
  saveLocalDatabases(userId, updatedLocal);

  try {
    const response = await fetch('/api/db/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDb),
    });

    if (response.ok) {
      // Mark as synced and re-save locally
      newDb.synced = true;
      const reLoadedDbs = getLocalDatabases(userId).filter((db) => db.id !== newDb.id);
      reLoadedDbs.push(newDb);
      saveLocalDatabases(userId, reLoadedDbs);
    } else {
      console.warn(`Server-side database save failed (${response.status}), saved locally in browser instead.`);
    }
  } catch (err) {
    console.warn("Network/Server offline. Saved case database securely in local browser storage.", err);
  }

  return newDb;
}

// Get all databases for the current user (merges server and localStorage seamlessly)
export async function getSavedDatabases(userId: string, email?: string): Promise<SavedDatabase[]> {
  const localDbs = getLocalDatabases(userId);

  try {
    let url = `/api/db/list?userId=${encodeURIComponent(userId)}`;
    if (email) {
      url += `&email=${encodeURIComponent(email)}`;
    }
    const serverResponse = await fetch(url);
    if (serverResponse.ok) {
      const result = await serverResponse.json();
      if (result.success && Array.isArray(result.databases)) {
        // Mark all databases loaded from the server as synced
        const serverDbs: SavedDatabase[] = result.databases.map((db: any) => ({
          ...db,
          synced: true,
        }));
        
        // Merge server and local databases
        const mergedMap = new Map<string, SavedDatabase>();
        
        // Load server databases first (these are guaranteed to exist on the server)
        serverDbs.forEach((db) => mergedMap.set(db.id, db));
        
        // Load local databases (check if some are unsynced or need update)
        localDbs.forEach((db) => {
          const existing = mergedMap.get(db.id);
          if (!existing) {
            // This database exists in local cache but is NOT on the server.
            // Check if it was previously synced to the server.
            // If it was previously synced or belongs to another user,
            // it means it was deleted on the server. Discard it!
            const isShared = db.userId !== userId;
            if (db.synced || isShared) {
              console.log(`Database ${db.id} ("${db.name}") was deleted on the server. Cleaning from local cache.`);
              return; // Discard: do not add to mergedMap
            }
            // Otherwise, it was created offline and has never been synced, so we keep it.
            mergedMap.set(db.id, db);
          } else {
            // It exists on both. Prefer local if newer, but keep synced: true.
            if (db.createdAt > (existing.createdAt || 0)) {
              mergedMap.set(db.id, { ...db, synced: true });
            }
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
export async function deleteSavedDatabase(id: string, userId: string, email?: string): Promise<void> {
  // 1. Delete from local storage
  const localDbs = getLocalDatabases(userId);
  const updatedLocal = localDbs.filter((db) => db.id !== id);
  saveLocalDatabases(userId, updatedLocal);

  // 2. Try to delete from server
  try {
    const serverResponse = await fetch('/api/db/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId, email }),
    });

    if (!serverResponse.ok) {
      console.warn(`Server delete returned status ${serverResponse.status}, deleted locally.`);
    }
  } catch (err) {
    console.warn("Could not sync deletion with server (server offline/unconfigured), deleted locally.", err);
  }
}

// Fetch a single database with its full diaries array (checking access control)
export async function getSavedDatabaseById(id: string, userId: string, email?: string): Promise<SavedDatabase | null> {
  const localDbs = getLocalDatabases(userId);
  const localDb = localDbs.find((db) => db.id === id);
  
  // If the local cache already has the full diaries list, return it
  if (localDb && Array.isArray(localDb.diaries) && localDb.diaries.length > 0) {
    return localDb;
  }

  // Otherwise, fetch from server
  try {
    let url = `/api/db/get?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(userId)}`;
    if (email) {
      url += `&email=${encodeURIComponent(email)}`;
    }
    const response = await fetch(url);
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.database) {
        const fullDb: SavedDatabase = { ...result.database, synced: true };
        
        // Cache the fully fetched database locally in browser
        const updatedLocal = localDbs.filter((db) => db.id !== fullDb.id);
        updatedLocal.push(fullDb);
        saveLocalDatabases(userId, updatedLocal);
        
        return fullDb;
      }
    }
  } catch (err) {
    console.error(`Failed to fetch database by ID (${id}) from server:`, err);
  }

  return localDb || null;
}
