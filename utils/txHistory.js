// /utils/txHistory.js

const KEY = "anoma:txs";

export function logTx(tx) {
  const list = JSON.parse(localStorage.getItem(KEY)) || [];
  list.unshift({ ...tx, ts: Date.now() });

  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
}

export function getTxs() {
  return JSON.parse(localStorage.getItem(KEY)) || [];
}

export function clearTxs() {
  localStorage.removeItem(KEY);
}
