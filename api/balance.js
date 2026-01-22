// /api/balance.js (LOCAL STORAGE VERSION)

import fs from "fs";
import path from "path";

import {
  sweepACASH,
  forwardSOL,
  buyAndBurnACASHFromFee
} from "./autoSweep.js";

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

const RPC = process.env.SOLANA_RPC;
const ACASH_MINT = new PublicKey(process.env.ACASH_MINT);
const connection = new Connection(RPC, "confirmed");

// constants
const PLATFORM_FEE_USD = 2.0;
const REWARD_USD = 0.5;

// --------------------
// Local storage paths
// --------------------
const USERS_PATH = path.resolve("./utils/balance.js");
const STORAGE_PATH = path.resolve("./utils/localStore.js");

// --------------------
// Local storage helpers
// --------------------
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

async function getACASH(wallet) {
  try {
    const owner = new PublicKey(wallet);
    const ata = await getAssociatedTokenAddress(ACASH_MINT, owner);
    const acc = await getAccount(connection, ata);
    return Number(acc.amount) / 1e6;
  } catch {
    return 0;
  }
}

async function getSOL(wallet) {
  try {
    return (await connection.getBalance(new PublicKey(wallet))) / 1e9;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  try {
    const { uid, action } = req.query;
    if (!uid) {
      return res.status(400).json({ ok: false, error: "Missing uid" });
    }

    const users = readJSON(USERS_PATH, {});
    const pricingStore = readJSON(STORAGE_PATH, {});
    const pricing = pricingStore["config/pricing"] || {};

    const solUsd = Number(pricing.solUsd || 0);

    const u = users[uid];
    if (!u) {
      return res.status(404).json({ ok: false, error: "Wallet not found" });
    }

    if (req.method === "POST" && action === "refresh") {
      console.log("Refreshing balance for UID:", uid);

      const onchainACASH = await getACASH(u.splDepositAddress);
      const onchainSOL = await getSOL(u.solDepositAddress);

      let newACASH = Number(u.acashBalance || 0);
      let newSOL = Number(u.solBalance || 0);
      let newReward = Number(u.reward || 0);

      /* ---------------- ACASH SWEEP ---------------- */
      if (onchainACASH > 0) {
        const acashPrivate = JSON.parse(
          u.splDepositPrivate.trim().replace(/^[^\[]+/, "")
        );

        const sweep = await sweepACASH(
          u.splDepositAddress,
          acashPrivate,
          Math.round(onchainACASH * 1e6),
          uid
        );

        if (sweep.ok) {
          newACASH += onchainACASH;
        }
      }

      /* ---------------- SOL SWEEP ---------------- */
      const MIN_SOL_SWEEP = 0.00002;

      if (onchainSOL > MIN_SOL_SWEEP) {
        const sweep = await forwardSOL(
          u.solDepositAddress,
          u.solDepositPrivate,
          uid
        );

        if (sweep.ok && sweep.signature) {
          const status = await connection.getSignatureStatus(
            sweep.signature,
            { searchTransactionHistory: true }
          );

          const confirmed =
            status?.value?.confirmationStatus === "confirmed" ||
            status?.value?.confirmationStatus === "finalized";

          if (confirmed) {
            await buyAndBurnACASHFromFee(solUsd);

            newReward += REWARD_USD;

            const platformFeeSOL =
              solUsd > 0 ? PLATFORM_FEE_USD / solUsd : 0.005;

            const withdrawable = onchainSOL - platformFeeSOL;

            if (withdrawable > 0) {
              newSOL += withdrawable;
            }
          } else {
            console.warn(
              "SOL sweep pending or expired — balance not updated yet",
              sweep.signature
            );
          }
        }
      }

      /* ---------------- SAVE ---------------- */
      users[uid] = {
        ...u,
        acashBalance: Number(newACASH),
        solBalance: Number(newSOL),
        reward: Number(newReward),
        lastRefreshed: Date.now()
      };

      writeJSON(USERS_PATH, users);

      return res.json({
        ok: true,
        solBalance: users[uid].solBalance || 0,
        acashBalance: users[uid].acashBalance || 0,
        reward: users[uid].reward || 0,
        solUsd
      });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });

  } catch (err) {
    console.error("BALANCE ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
