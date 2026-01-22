// /api/transactions.js

import fs from "fs";
import path from "path";

// --------------------
// Local transactions storage
// --------------------
const TX_PATH = path.resolve("./transactions.json");

function readTxs() {
  if (!fs.existsSync(TX_PATH)) {
    fs.writeFileSync(TX_PATH, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(TX_PATH, "utf-8"));
}

function writeTxs(data) {
  fs.writeFileSync(TX_PATH, JSON.stringify(data, null, 2));
}

/**
 * Local-storage-backed transaction logger
 * Mirrors Firestore behavior closely
 */
export async function logTransaction(uid, txid, type, direction, amount) {
  try {
    const store = readTxs();

    if (!store[uid]) {
      store[uid] = [];
    }

    // De-duplication by txid
    if (store[uid].some(tx => tx.txid === txid)) {
      return true;
    }

    store[uid].unshift({
      txid,
      type,        // "SOL" | "ACASH"
      direction,   // "deposit" | "withdraw"
      amount: Number(amount),
      timestamp: Date.now()
    });

    // Keep only last 10 (most recent first)
    store[uid] = store[uid].slice(0, 10);

    writeTxs(store);
    return true;

  } catch (err) {
    console.error("TX LOG ERROR (non-fatal):", err.message);
    return false;
  }
}
