// /api/wallet.js

import fs from "fs";
import path from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import * as bip39 from "bip39";
import { createHash } from "crypto";

/* -------------------------------------------------------------
   LOCAL STORAGE
------------------------------------------------------------- */
const USERS_PATH = path.resolve("./users.json");
const TX_PATH = path.resolve("./transactions.json");

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* -------------------------------------------------------------
   SAFE BODY PARSER
------------------------------------------------------------- */
async function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/* -------------------------------------------------------------
   MAIN HANDLER
------------------------------------------------------------- */
export default async function handler(req, res) {
  try {
    const { action } = req.query;

    if (!action) {
      return res.status(400).json({ ok: false, error: "Missing action" });
    }

    if (action === "create") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, error: "Use GET" });
      return createWallet(req, res);
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    req.body = await parseBody(req);

    if (action === "import") return importWallet(req, res);
    if (action === "delete") return deleteWallet(req, res);

    return res.status(400).json({ ok: false, error: "Invalid action" });

  } catch (err) {
    console.error("WALLET API ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/* -------------------------------------------------------------
   CREATE WALLET
------------------------------------------------------------- */
async function createWallet(req, res) {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ ok: false, error: "Missing uid" });

  const users = readJSON(USERS_PATH, {});
  const existing = users[uid];

  if (existing?.seedPhrase) {
    return res.json({
      ok: true,
      seedPhrase: existing.seedPhrase,
      solDepositAddress: existing.solDepositAddress,
      splDepositAddress: existing.splDepositAddress
    });
  }

  const seedPhrase = bip39.generateMnemonic(128);
  const seed = await bip39.mnemonicToSeed(seedPhrase);

  const sol = deriveSolWallet(seed);
  const spl = nacl.sign.keyPair();

  users[uid] = {
    uid,
    seedPhrase,
    solDepositAddress: bs58.encode(sol.publicKey),
    solDepositPrivate: bs58.encode(sol.secretKey),
    splDepositAddress: bs58.encode(spl.publicKey),
    splDepositPrivate: JSON.stringify(Array.from(spl.secretKey)),
    solBalance: 0,
    acashBalance: 0,
    activationExpiry: 0,
    activationProgress: 0,
    createdAt: Date.now()
  };

  writeJSON(USERS_PATH, users);

  return res.json({
    ok: true,
    seedPhrase,
    solDepositAddress: users[uid].solDepositAddress,
    splDepositAddress: users[uid].splDepositAddress
  });
}

/* -------------------------------------------------------------
   IMPORT WALLET
------------------------------------------------------------- */
async function importWallet(req, res) {
  const { uid } = req.query;
  const { seedPhrase } = req.body;

  if (!uid || !seedPhrase)
    return res.status(400).json({ ok: false, error: "Missing fields" });

  if (!bip39.validateMnemonic(seedPhrase.trim()))
    return res.status(400).json({ ok: false, error: "Invalid seed phrase" });

  const seed = await bip39.mnemonicToSeed(seedPhrase.trim());

  const sol = deriveSolWallet(seed);
  const spl = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));

  const users = readJSON(USERS_PATH, {});

  users[uid] = {
    ...(users[uid] || {}),
    uid,
    seedPhrase: seedPhrase.trim(),
    solDepositAddress: bs58.encode(sol.publicKey),
    solDepositPrivate: bs58.encode(sol.secretKey),
    splDepositAddress: bs58.encode(spl.publicKey),
    splDepositPrivate: JSON.stringify(Array.from(spl.secretKey)),
    solBalance: 0,
    acashBalance: 0,
    activationExpiry: 0,
    activationProgress: 0,
    restoredAt: Date.now()
  };

  writeJSON(USERS_PATH, users);

  return res.json({
    ok: true,
    solDepositAddress: users[uid].solDepositAddress,
    splDepositAddress: users[uid].splDepositAddress
  });
}

/* -------------------------------------------------------------
   DELETE WALLET (RESET — SEED PRESERVED)
------------------------------------------------------------- */
async function deleteWallet(req, res) {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ ok: false, error: "Missing uid" });

  const users = readJSON(USERS_PATH, {});
  const txs = readJSON(TX_PATH, {});

  const user = users[uid];
  if (!user)
    return res.status(404).json({ ok: false, error: "User not found" });

  const { seedPhrase } = user;

  // delete user transactions
  delete txs[uid];
  writeJSON(TX_PATH, txs);

  // reset user (seed preserved)
  users[uid] = {
    uid,
    seedPhrase,
    solBalance: 0,
    acashBalance: 0,
    activationExpiry: 0,
    activationProgress: 0,
    lastResetAt: Date.now()
  };

  writeJSON(USERS_PATH, users);

  return res.json({ ok: true });
}

/* -------------------------------------------------------------
   SOL KEY DERIVATION
------------------------------------------------------------- */
function deriveSolWallet(seed) {
  const path = "m/44'/501'/0'/0'";
  const hash = createHash("sha256")
    .update(seed)
    .update(path)
    .digest();

  const keypair = nacl.sign.keyPair.fromSeed(hash.slice(0, 32));

  if (keypair.secretKey.length !== 64) {
    throw new Error("Derived SOL secret key is not 64 bytes");
  }

  return keypair;
}
