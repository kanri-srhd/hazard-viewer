// ======================================================================
// indexeddb.js - IndexedDB キャッシュレイヤー
// ======================================================================
//
// [TODO (JP)]
// - Segment5: 必要であれば snapshot の中から Parcel / Hazard / Capacity を個別に参照するヘルパー追加
// - Phase6 : hazardCache / capacityCache ストアを追加し、WMTS/空容量の再計算を削減
// - Future : Snapshot のバージョン管理（過去との比較・ロールバックなど）
//
// [TODO (EN)]
// - Segment5: Add helper to query partial fields (parcel/hazard/capacity) from snapshot
// - Phase6 : Add hazardCache / capacityCache stores to reduce recomputation
// - Future : Implement snapshot versioning (history / rollback)
// ======================================================================

const DB_NAME = "srhd-viewer";
const DB_VERSION = 1;

let db = null;

/**
 * IndexedDB オープン
 * Open IndexedDB connection.
 */
export async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains("sites")) {
        database.createObjectStore("sites", { keyPath: "siteId" });
      }
      // TODO(JP): Phase6 で hazardCache / capacityCache ストアを追加
      // TODO(EN): Add "hazardCache" and "capacityCache" stores in Phase6
    };

    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    req.onerror = (e) => {
      console.error("[indexeddb] open error", e);
      reject(e);
    };
  });
}

/**
 * Snapshot 保存
 * Save UnifiedSiteSnapshot for a given siteId.
 */
export async function saveSnapshot(siteId, snapshot) {
  if (!db) await openDB();
  const tx = db.transaction("sites", "readwrite");
  tx.objectStore("sites").put({ siteId, snapshot, updatedAt: Date.now() });
}

/**
 * Snapshot 読み込み
 * Load UnifiedSiteSnapshot from cache.
 */
export async function loadSnapshotFromCache(siteId) {
  if (!db) await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction("sites", "readonly");
    const req = tx.objectStore("sites").get(siteId);
    req.onsuccess = () => {
      resolve(req.result?.snapshot ?? null);
    };
    req.onerror = () => {
      resolve(null);
    };
  });
}

// ⚠ 禁止事項 / DO NOT:
// - UI レイヤーからこのモジュールを直接 import しないこと
// - Engines からこのモジュールを直接 import しないこと
//   （必ず UnifiedLayer 経由で呼ばれること）
// - IndexedDB のスキーマをここで変更しないこと
//   （将来的なスキーマ変更はバージョン管理を含めて検討すること）