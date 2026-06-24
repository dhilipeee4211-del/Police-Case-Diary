import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  orderBy 
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
  const newDb: SavedDatabase = {
    id: existingDbId || `db-${Date.now()}`,
    userId,
    name,
    createdAt: Date.now(),
    diaries
  };

  // 1. Always save to Local Storage first for reliable immediate feedback
  try {
    const localDbs = getLocalDatabases();
    localDbs.unshift(newDb); // Add to the top of the list
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
  const localDbs = getLocalDatabases().filter(item => item.userId === userId || isGuest(userId));

  if (isGuest(userId)) {
    return localDbs;
  }

  // Try to load from Firestore
  try {
    const q = query(
      collection(db, "databases"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const firestoreDbs: SavedDatabase[] = [];
    querySnapshot.forEach((doc) => {
      firestoreDbs.push(doc.data() as SavedDatabase);
    });

    // Sort firestore items descending by date
    firestoreDbs.sort((a, b) => b.createdAt - a.createdAt);

    if (firestoreDbs.length > 0) {
      // Merge unique items between local storage and firestore to ensure no data loss
      const mergedDbsMap = new Map<string, SavedDatabase>();
      
      // Load Firestore items first (higher priority)
      firestoreDbs.forEach(item => mergedDbsMap.set(item.id, item));
      
      // Supplement with any local-only items for this user
      localDbs.forEach(item => {
        if (!mergedDbsMap.has(item.id)) {
          mergedDbsMap.set(item.id, item);
        }
      });

      const merged = Array.from(mergedDbsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      
      // Sync merged back to local storage
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn("Failed to fetch from Firestore, utilizing Local Storage:", err);
  }

  return localDbs;
}

// Delete a database session
export async function deleteSavedDatabase(id: string, userId: string): Promise<void> {
  // 1. Delete from Local Storage
  try {
    const localDbs = getLocalDatabases().filter(item => item.id !== id);
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

// Local storage direct getter
function getLocalDatabases(): SavedDatabase[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Error reading from local storage:", err);
    return [];
  }
}
