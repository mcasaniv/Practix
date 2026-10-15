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

  // 3. Strip custom decks covers if they are base64
  if (cloned.customDecks) {
    cloned.customDecks = cloned.customDecks.map(d => {
      if (d.coverUrl?.startsWith('data:image')) {
        return { ...d, coverUrl: undefined };
      }
      return d;
    });
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
    console.warn('localStorage.setItem failed (QuotaExceededError), attempting pruned save:', error?.name || error);

    try {
      // Free existing storage before re-trying with pruned version
      localStorage.removeItem(DB_STORAGE_KEY);
      const pruned = pruneDatabaseForLocalStorage(db);
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(pruned));
      return true;
    } catch (prunedError) {
      console.warn('Pruned localStorage save also exceeded quota, attempting minimal metadata save:', prunedError);

      try {
        localStorage.removeItem(DB_STORAGE_KEY);
        // Keep only user progress and metadata, IndexedDB has the full questions
        const minimal: Partial<AppDatabase> = {
          results: db.results,
          totalPracticed: db.totalPracticed,
          totalFlashcardsPracticed: db.totalFlashcardsPracticed,
          userProfile: db.userProfile,
          customDecks: (db.customDecks || []).map(d => ({ ...d, questions: [], readingTexts: [] })),
          savedExams: (db.savedExams || []).slice(-10), // Keep last 10 exams only in localStorage
          incorrectQuestionIds: db.incorrectQuestionIds
        };
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(minimal));
        return true;
      } catch (minimalError) {
        // If even minimal fails, do not crash the application!
        console.error('All localStorage attempts failed due to storage limits. IndexedDB handles full storage safely.', minimalError);
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
  // 1. Full persistence in IndexedDB (no 5MB quota limit, can store hundreds of MBs)
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
    if (fromIdb && (
      (fromIdb.questions && fromIdb.questions.length > 0) ||
      (fromIdb.readingTexts && fromIdb.readingTexts.length > 0) ||
      (fromIdb.flashcards && fromIdb.flashcards.length > 0) ||
      Object.keys(fromIdb.results || {}).length > 0
    )) {
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
 * Compresses an image file before storing as base64, reducing storage size by ~98%
 * (e.g. from 2MB to ~25KB-50KB) while maintaining visual crispness for avatars and cards.
 */
export function compressImageFile(file: File, maxWidth = 600, maxHeight = 600, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) {
          resolve('');
          return;
        }
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxHeight) {
            if (width / maxWidth > height / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    } catch {
      resolve('');
    }
  });
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
