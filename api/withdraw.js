// /api/withdraw.js

import fs from "fs";
import path from "path";
import { sendSOL } from "../utils/solana-utils.js";
import { logTransaction } from "./transactions.js";

// --------------------
// Local storage paths
// --------------------
const USERS_PATH = path.resolve("./users.json");
const STORAGE_PATH = path.resolve("./storage.json");

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --------------------

export default async function handler(req, res) {
  try {
    const { uid, destination, includeReward } = req.body;
    const amount = Number(req.body.amount);

    if (!uid || !destination || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Invalid or missing fields"
      });
    }

    const users = readJSON(USERS_PATH, {});
    const store = readJSON(STORAGE_PATH, {});
    const pricing = store["config/pricing"] || {};

    const user = users[uid];
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "User not found"
      });
    }

    const solBalance = Number(user.solBalance || 0);
    const rewardUsd = Number(user.reward || 0);

    if (amount > solBalance) {
      return res.status(400).json({
        ok: false,
        error: "Insufficient SOL balance"
      });
    }

    let totalSendSOL = amount;
    let newBalance = solBalance - amount;
    let rewardUsedUsd = 0;

    // 🔥 INCLUDE REWARD LOGIC
    if (includeReward === true && rewardUsd > 0) {
      const solUsd = Number(pricing.solUsd || 0);

      if (solUsd <= 0) {
        return res.status(500).json({
          ok: false,
          error: "SOL price unavailable"
        });
      }

      const rewardSol = rewardUsd / solUsd;
      totalSendSOL += rewardSol;
      rewardUsedUsd = rewardUsd;

      user.reward = 0; // reset reward
    }

    // persist balance changes BEFORE send (same intent as transaction)
    user.solBalance = newBalance;
    users[uid] = user;
    writeJSON(USERS_PATH, users);

    // 🔥 SEND SOL (ON-CHAIN)
    const sig = await sendSOL(destination, totalSendSOL);

    // 🔥 LOG WITHDRAW
    await logTransaction(uid, sig, "SOL", "withdraw", totalSendSOL);

    return res.json({
      ok: true,
      signature: sig,
      solBalance: newBalance,
      rewardClaimed: rewardUsedUsd
    });

  } catch (err) {
    console.error("WITHDRAW ERROR:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
