// ======================================================================
// bus.js - DataBus / EventEmitter（UI・UDL・Engines を疎結合化）
// ======================================================================
//
// [TODO (JP)]
// - 現状はシンプルな Pub/Sub のままとし、Segment5 以降もロジックを追加しない
// - ログ機能やデバッグフックを追加する場合も「イベント内容の観察のみ」に留める
//
// [TODO (EN)]
// - Keep this as a simple Pub/Sub bus without business logic
// - If debug/logging is added in future segments, it MUST NOT alter payloads
// ======================================================================

const subscribers = {};

/**
 * イベント購読
 * Subscribe handler for an event name.
 */
export function on(eventName, handler) {
  if (!subscribers[eventName]) subscribers[eventName] = [];
  subscribers[eventName].push(handler);
}

/**
 * イベント発火
 * Emit event to all subscribers.
 */
export function emit(eventName, payload) {
  if (!subscribers[eventName]) return;
  subscribers[eventName].forEach((handler) => handler(payload));
}

// ⚠ 禁止事項 / DO NOT:
// - このファイルに状態管理やビジネスロジックを追加しないこと
// - IndexedDB や外部APIへのアクセスを入れないこと
