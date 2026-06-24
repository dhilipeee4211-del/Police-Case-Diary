import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { SavedDatabase, CaseDiary } from "./types";

const LOCAL_STORAGE_KEY = "police_case_diary_databases";

// Helper to check if user is a guest user
function isGuest(userId: string): boolean {
  return !userId || userId.startsWith("guest-");
}

// Save database session (both Firestore and LocalStorage fallback)
export async function saveSavedDatabase(
  name: string,
  diaries: CaseDiary[],
  userId: string,
  existingDbId?: string
): Promise<SavedDatabase> {
  // BUG FIX 3: Preserve original createdAt on updates — only set Date.now() for new records.
  // Previously every save (including edits) used Date.now(), corrupting the creation time
  // and always pushing the item to the top of the list.
  const existingRecord = existingDbId
    ? getLocalDatabases().find((item) => item.id === existingDbId)
    : undefined;

  const newDb: SavedDatabase = {
    id: existingDbId || `db-${Date.now()}`,
    userId,
    name,
    createdAt: existingRecord?.createdAt ?? Date.now(), // preserve original timestamp
    diaries,
  };

  // 1. Always save to Local Storage first for reliable immediate feedback
  try {
    let localDbs = getLocalDatabases();
    localDbs = localDbs.filter((item) => item.id !== newDb.id);
    localDbs.unshift(newDb);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localDbs));
  } catch (err) {
    console.error("Local storage save error:", err);
  }

  // 2. If signed in as non-guest, save to Firestore
  if (!isGuest(userId)) {
    try {
      const docRef = doc(collection(db, "databases"), newDb.id);
      await setDoc(docRef, newDb);
      console.log("Successfully saved database to Firestore:", newDb.id);
    } catch (err) {
      console.warn("Firestore save failed, fell back to Local Storage:", err);
    }
  }

  return newDb;
}

// Get all databases for the current user
export async function getSavedDatabases(userId: string): Promise<SavedDatabase[]> {
  // BUG FIX 2: Filter local databases strictly by userId.
  // Previously `|| isGuest(userId)` caused ALL guest entries to be shown to
  // any guest session, leaking data across sessions.
  const localDbs = getLocalDatabases().filter((item) => item.userId === userId);

  if (isGuest(userId)) {
    return localDbs;
  }

  // Try to load from Firestore for authenticated (Google) users
  try {
    const q = query(collection(db, "databases"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    const firestoreDbs: SavedDatabase[] = [];
    querySnapshot.forEach((docSnap) => {
      firestoreDbs.push(docSnap.data() as SavedDatabase);
    });

    firestoreDbs.sort((a, b) => b.createdAt - a.createdAt);

    // BUG FIX 1: Always merge — even when Firestore returns 0 items.
    // Previously `if (firestoreDbs.length > 0)` meant a brand-new Google account
    // (empty Firestore) would skip the merge entirely and never see local data.
    // Now we always build the merged map so local-only entries are always included.
    const mergedDbsMap = new Map<string, SavedDatabase>();

    // Firestore wins on conflict (higher priority / source of truth)
    firestoreDbs.forEach((item) => mergedDbsMap.set(item.id, item));

    // Supplement with any local-only items for this user (e.g. saved while offline)
    localDbs.forEach((item) => {
      if (!mergedDbsMap.has(item.id)) {
        mergedDbsMap.set(item.id, item);
      }
    });

    const merged = Array.from(mergedDbsMap.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );

    // Sync merged list back to local storage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));

    // BUG FIX 4: Push any local-only entries up to Firestore so they survive
    // on other devices / after clearing local storage.
    const firestoreIds = new Set(firestoreDbs.map((item) => item.id));
    const localOnlyEntries = localDbs.filter((item) => !firestoreIds.has(item.id));

    if (localOnlyEntries.length > 0) {
      console.log(`Uploading ${localOnlyEntries.length} local-only entries to Firestore...`);
      await Promise.all(
        localOnlyEntries.map((item) =>
          setDoc(doc(collection(db, "databases"), item.id), {
            ...item,
            userId, // ensure userId is always the current authenticated user
          })
        )
      );
    }

    return merged;
  } catch (err) {
    console.warn("Failed to fetch from Firestore, utilizing Local Storage:", err);
    return localDbs;
  }
}

// Delete a database session
export async function deleteSavedDatabase(id: string, userId: string): Promise<void> {
  // 1. Delete from Local Storage
  try {
    const localDbs = getLocalDatabases().filter((item) => item.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localDbs));
  } catch (err) {
    console.error("Local storage deletion error:", err);
  }

  // 2. Delete from Firestore if authenticated
  if (!isGuest(userId)) {
    try {
      const docRef = doc(db, "databases", id);
      await deleteDoc(docRef);
      console.log("Successfully deleted database from Firestore:", id);
    } catch (err) {
      console.warn("Failed to delete database from Firestore:", err);
    }
  }
}

// Local storage getter with automatic de-duplication
function getLocalDatabases(): SavedDatabase[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: SavedDatabase[] = data ? JSON.parse(data) : [];

    if (Array.isArray(list)) {
      const uniqueList: SavedDatabase[] = [];
      const seenIds = new Set<string>();

      for (const item of list) {
        if (item && item.id && !seenIds.has(item.id)) {
          seenIds.add(item.id);
          uniqueList.push(item);
        }
      }

      // Write back if we cleaned up duplicates
      if (uniqueList.length !== list.length) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(uniqueList));
      }
      return uniqueList;
    }
    return [];
  } catch (err) {
    console.error("Error reading from local storage:", err);
    return [];
  }
}