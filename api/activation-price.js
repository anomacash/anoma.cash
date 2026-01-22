// /api/activation-price.js

import fs from "fs";
import path from "path";

const ACTIVATION_USD_COST = 0.005;
const ROUND_STEP = 10;
const FALLBACK_ACASH_USD = 0.01;
const TARGET_SOL_DEPOSIT_FEE_USD = 2.0;

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

// --------------------

function roundUp(value, step) {
  return Math.ceil(value / step) * step;
}

export default async function handler(req, res) {
  try {
    // Acts like localStorage.getItem("config/pricing")
    const pricing = getItem("config/pricing");

    let acashUsd = FALLBACK_ACASH_USD;
    let solUsd = 0;

    if (pricing) {
      if (pricing.acashUsd > 0) {
        acashUsd = pricing.acashUsd;
      }
      if (pricing.solUsd > 0) {
        solUsd = pricing.solUsd;
      }
    }

    const rawRequired = ACTIVATION_USD_COST / acashUsd;
    const requiredACASH = roundUp(rawRequired, ROUND_STEP);

    const dynamicSolFee = solUsd > 0
      ? TARGET_SOL_DEPOSIT_FEE_USD / solUsd
      : 0.005;

    return res.json({
      ok: true,
      requiredACASH,
      usdCost: ACTIVATION_USD_COST,
      solDepositFee: dynamicSolFee,
      solDepositFeeUsd: TARGET_SOL_DEPOSIT_FEE_USD,
      solUsd
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
