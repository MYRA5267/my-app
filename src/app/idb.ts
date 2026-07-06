// ─── Локальные треки пользователя в IndexedDB ────────────────────────────────
// Блобы аудиофайлов сохраняются на устройстве и переживают перезапуск.

export interface LocalTrackRecord {
  id: number;
  title: string;
  artist: string;
  duration: string;
  c1: string;
  c2: string;
  blob: Blob;
}

const DB_NAME = "myra-local";
const STORE = "tracks";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalTrack(rec: LocalTrackRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadLocalTracks(): Promise<LocalTrackRecord[]> {
  try {
    const db = await openDb();
    const recs = await new Promise<LocalTrackRecord[]>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as LocalTrackRecord[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return recs.sort((a, b) => b.id - a.id);
  } catch {
    return []; // приватный режим или запрет хранилища — работаем без сохранения
  }
}

export async function deleteLocalTrack(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
