// viewer/storage/indexeddb.js
// ----------------------------------------------------
// IndexedDB キャッシュの読み書き（UDL 経由のみ）
// ----------------------------------------------------

const DB_NAME = "srhd-viewer";
const DB_VERSION = 1;

let db = null;

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains("sites")) {
        db.createObjectStore("sites", { keyPath: "siteId" });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = (e) => reject(e);
  });
}

export async function saveSnapshot(siteId, snapshot) {
  if (!db) await openDB();
  const tx = db.transaction("sites", "readwrite");
  tx.objectStore("sites").put({ siteId, snapshot });
}

export async function loadSnapshotFromCache(siteId) {
  if (!db) await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction("sites", "readonly");
    const req = tx.objectStore("sites").get(siteId);
    req.onsuccess = () => resolve(req.result?.snapshot ?? null);
    req.onerror = () => resolve(null);
  });
}
// 注意: このモジュールは純粋に IndexedDB への読み書きのみを担当する。
// ビジネスロジックや状態管理は他のレイヤーに任せる。