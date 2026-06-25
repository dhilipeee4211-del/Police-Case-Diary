import { SavedDatabase, CaseDiary } from "./types";

// Save database session (strictly in Supabase)
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

  const response = await fetch('/api/db/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newDb),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server returned error status ${response.status}`);
  }

  return newDb;
}

// Get all databases for the current user (strictly from Supabase)
export async function getSavedDatabases(userId: string): Promise<SavedDatabase[]> {
  const serverResponse = await fetch(`/api/db/list?userId=${encodeURIComponent(userId)}`);
  if (!serverResponse.ok) {
    throw new Error(`Failed to load databases from server: ${serverResponse.status}`);
  }

  const result = await serverResponse.json();
  if (result.success && Array.isArray(result.databases)) {
    return result.databases;
  }
  
  if (result.error) {
    throw new Error(result.error);
  }

  return [];
}

// Delete a database session (strictly in Supabase)
export async function deleteSavedDatabase(id: string, userId: string): Promise<void> {
  const serverResponse = await fetch('/api/db/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, userId }),
  });

  if (!serverResponse.ok) {
    const errorData = await serverResponse.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete database: ${serverResponse.status}`);
  }
}
