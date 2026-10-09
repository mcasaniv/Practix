import { AppDatabase } from '../types';
import { DB_STORAGE_KEY } from '../constants';

const IDB_NAME = 'practix_offline_db';
const IDB_STORE = 'app_data';
const IDB_VERSION = 1;
const IDB_KEY_DB = 'current_database';

/**
 * Initialize IndexedDB instance with Promise wrapper
 */
function openIDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (e) => {
        console.warn('Could not open IndexedDB:', e);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB open error:', err);
      resolve(null);
    }
  });
}

/**
 * Save data to IndexedDB
 */
export async function saveToIndexedDB(key: string, data: any): Promise<boolean> {
  const db = await openIDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(data, key);

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('Error saving to IndexedDB:', req.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('Transaction error in IndexedDB:', err);
      resolve(false);
    }
  });
}

/**
 * Load data from IndexedDB
 */
export async function loadFromIndexedDB<T = any>(key: string): Promise<T | null> {
  const db = await openIDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve((req.result as T) ?? null);
      };
      req.onerror = () => {
        console.warn('Error loading from IndexedDB:', req.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('Transaction error in IndexedDB:', err);
      resolve(null);
    }
  });
}

/**
 * Prune bulky content from database object before saving to localStorage
 * so it stays well under the 5MB quota limit
 */
function pruneDatabaseForLocalStorage(db: AppDatabase): Partial<AppDatabase> {
  const cloned: AppDatabase = { ...db };

  // 1. Strip bulky data-URI (base64) images from course covers
  if (cloned.courseCovers) {
    const prunedCovers: Record<string, string> = {};
    for (const [k, v] of Object.entries(cloned.courseCovers)) {
      if (typeof v === 'string') {
        // Skip large data URLs in localStorage, keep regular web links
        if (!v.startsWith('data:image')) {
          prunedCovers[k] = v;
        }
      }
    }
    cloned.courseCovers = prunedCovers;
  }

  // 2. Strip avatarUrl if it is a large base64 data-URI
  if (cloned.userProfile?.avatarUrl?.startsWith('data:image')) {
    cloned.userProfile = {
      ...cloned.userProfile,
      avatarUrl: undefined
    };
  }

  return cloned;
}

/**
 * Safely saves the database to localStorage without throwing QuotaExceededError
 */
export function safeSaveToLocalStorage(db: AppDatabase): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const serialized = JSON.stringify(db);
    localStorage.setItem(DB_STORAGE_KEY, serialized);
    return true;
  } catch (error: any) {
    console.warn('localStorage.setItem failed (likely QuotaExceededError), attempting pruned save:', error?.name || error);

    try {
      // Attempt 1: Prune large base64 covers and avatars
      const pruned = pruneDatabaseForLocalStorage(db);
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(pruned));
      return true;
    } catch (prunedError) {
      console.warn('Pruned localStorage save also exceeded quota, attempting minimal metadata save:', prunedError);

      try {
        // Attempt 2: Keep only user progress and metadata, IndexedDB has the full questions
        const minimal: Partial<AppDatabase> = {
          results: db.results,
          totalPracticed: db.totalPracticed,
          totalFlashcardsPracticed: db.totalFlashcardsPracticed,
          userProfile: db.userProfile,
          customDecks: db.customDecks,
          savedExams: (db.savedExams || []).slice(-15) // Keep last 15 exams only in localStorage
        };
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(minimal));
        return true;
      } catch (minimalError) {
        // If even minimal fails, do not crash the application!
        console.error('All localStorage attempts failed due to storage limits. IndexedDB handles full storage.', minimalError);
        return false;
      }
    }
  }
}

/**
 * High-level save function:
 * Persists full database to IndexedDB asynchronously, and mirrors safe version to localStorage
 */
export async function saveAppDatabase(db: AppDatabase): Promise<void> {
  // 1. Full persistence in IndexedDB (no 5MB quota issue)
  try {
    await saveToIndexedDB(IDB_KEY_DB, db);
  } catch (err) {
    console.warn('Failed to save to IndexedDB:', err);
  }

  // 2. Safe persistence in localStorage for immediate sync bootstrap
  safeSaveToLocalStorage(db);
}

/**
 * High-level load function:
 * Checks IndexedDB first for complete data, falls back to localStorage
 */
export async function loadAppDatabase(): Promise<AppDatabase | null> {
  // Try IndexedDB first
  try {
    const fromIdb = await loadFromIndexedDB<AppDatabase>(IDB_KEY_DB);
    if (fromIdb && (fromIdb.questions?.length > 0 || Object.keys(fromIdb.results || {}).length > 0)) {
      return fromIdb;
    }
  } catch (err) {
    console.warn('Failed to read from IndexedDB:', err);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to parse localStorage db:', err);
  }

  return null;
}

/**
 * Remove database from all client storage
 */
export async function clearAppDatabaseStorage(): Promise<void> {
  try {
    localStorage.removeItem(DB_STORAGE_KEY);
  } catch {}

  try {
    const db = await openIDB();
    if (db) {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY_DB);
    }
  } catch (err) {
    console.warn('Failed to clear IndexedDB:', err);
  }
}
