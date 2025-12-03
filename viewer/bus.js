// viewer/bus.js
// ----------------------------------------------------
// EventBus（DataBus） - 全レイヤーを疎結合化するイベントハブ
// ----------------------------------------------------

const subscribers = {};

export function on(eventName, handler) {
  if (!subscribers[eventName]) subscribers[eventName] = [];
  subscribers[eventName].push(handler);
}

export function emit(eventName, payload) {
  if (!subscribers[eventName]) return;
  subscribers[eventName].forEach(handler => handler(payload));
}

// (AI 注意) ここにはロジックを絶対に書かない。
// 状態も持たない。純粋な EventEmitter として扱う。
