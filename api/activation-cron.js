import fs from "fs";
import path from "path";
import { sweepACASH, forwardSOL } from "./autoSweep.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

const RPC = process.env.SOLANA_RPC;
const ACASH_MINT = new PublicKey(process.env.ACASH_MINT);

// --------------------
// Local Storage Mock
// --------------------
const STORAGE_PATH = path.resolve("./utils/localStore.js");

function readStorage() {
  if (!fs.existsSync(STORAGE_PATH)) {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify({}), "utf-8");
  }
  return JSON.parse(fs.readFileSync(STORAGE_PATH, "utf-8"));
}

function getItem(key) {
  const data = readStorage();
  return data[key] ?? null;
}

function setItem(key, value) {
  const data = readStorage();
  data[key] = value;
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2));
}

// --------------------

const ACTIVATION_USD_COST = 0.005;
const ACTIVATION_DURATION = 1800;
const ROUND_STEP = 10;
const TARGET_SOL_DEPOSIT_FEE_USD = 2.0;
const ROUND_SOL_DECIMALS = 6;

const connection = new Connection(RPC, "confirmed");

async function getACASH(wallet) {
  try {
    const owner = new PublicKey(wallet);
    const ata = await getAssociatedTokenAddress(ACASH_MINT, owner);
    const info = await connection.getAccountInfo(ata);
    if (!info) return 0;
    const token = await getAccount(connection, ata);
    return Number(token.amount) / 1e6;
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

function roundUp(value, step) {
  return Math.ceil(value / step) * step;
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// --------------------
// Handler
// --------------------
export default async function handler(req, res) {
  try {
    // Acts like localStorage.getItem("config/pricing")
    const pricing = getItem("config/pricing");

    if (!pricing) {
      throw new Error("Missing local config/pricing");
    }

    const solPrice = Number(pricing.solanaUsd || pricing.solUsd || 0);
    const feeSOL = solPrice > 0
      ? TARGET_SOL_DEPOSIT_FEE_USD / solPrice
      : 0.01;

    const SOL_DEPOSIT_FEE = roundTo(feeSOL, ROUND_SOL_DECIMALS);

    return res.json({
      ok: true,
      solUsd: solPrice,
      solDepositFee: SOL_DEPOSIT_FEE,
      solDepositFeeUsd: TARGET_SOL_DEPOSIT_FEE_USD
    });

  } catch (err) {
    console.error("ACTIVATION PRICE ERROR:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
