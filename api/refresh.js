// /api/refresh.js

import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const ACASH_MINT = process.env.ACASH_MINT;
const CRON_SECRET = process.env.CRON_SECRET;

// --------------------
// Local storage
// --------------------
const STORAGE_PATH = path.resolve("./storage.json");

function readStorage() {
  if (!fs.existsSync(STORAGE_PATH)) {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(STORAGE_PATH, "utf-8"));
}

function writeStorage(data) {
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2));
}

// --------------------

export default async function handler(req, res) {
  try {
    if (!CRON_SECRET) {
      return res.status(500).json({ ok: false, error: "CRON_SECRET missing" });
    }

    const store = readStorage();
    const pricing = store["config/pricing"] || {};

    /* ---------------------------------------------------------
       UPDATE ACASH PRICE (GECKOTERMINAL)
    --------------------------------------------------------- */
    try {
      const POOL_ID = "7DXVicvmBhHPD39omhegF67776dVvmQRpWuA7MxHENB3";

      const priceRes = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/pools/${POOL_ID}`
      );

      const json = await priceRes.json();
      const attrs = json?.data?.attributes;

      const price =
        Number(attrs?.base_token_price_usd) ||
        Number(attrs?.quote_token_price_usd);

      if (price > 0) {
        pricing.acashUsd = price;
        pricing.updatedAt = Math.floor(Date.now() / 1000);
        pricing.source = "geckoterminal";

        console.log("PRICE UPDATED (ACASH — GeckoTerminal):", price);
      } else {
        console.warn("PRICE UPDATE SKIPPED (ACASH): missing price fields");
      }

    } catch (err) {
      console.error("PRICE UPDATE FAILED (ACASH — non-fatal):", err.message);
    }

    /* ---------------------------------------------------------
       UPDATE SOLANA PRICE (COINGECKO)
    --------------------------------------------------------- */
    try {
      const solRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
      );

      const solJson = await solRes.json();
      const solPrice = Number(solJson?.solana?.usd);

      if (solPrice > 0) {
        pricing.solUsd = roundTo(solPrice, 2);
        pricing.solUpdatedAt = Math.floor(Date.now() / 1000);
        pricing.solSource = "coingecko";

        console.log("PRICE UPDATED (SOL — CoinGecko):", solPrice);
      } else {
        console.warn("PRICE UPDATE SKIPPED (SOL): invalid price");
      }

    } catch (err) {
      console.error("PRICE UPDATE FAILED (SOL — non-fatal):", err.message);
    }

    // persist pricing
    store["config/pricing"] = pricing;
    writeStorage(store);

    /* ---------------------------------------------------------
       CALL ACTIVATION CRON
    --------------------------------------------------------- */
    const host = req.headers.host;
    const protocol = host.includes("localhost") ? "http" : "https";
    const cronUrl = `${protocol}://${host}/api/activation-cron`;

    const cronResponse = await fetch(cronUrl, {
      method: "GET",
      headers: { "x-cron-secret": CRON_SECRET }
    });

    const text = await cronResponse.text();

    let cronJson;
    try {
      cronJson = JSON.parse(text);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "Cron returned non-JSON response",
        raw: text
      });
    }

    return res.json({
      ok: true,
      priceUpdated: true,
      solPriceUpdated: true,
      cron: cronJson
    });

  } catch (err) {
    console.error("REFRESH ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/* precision helper */
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
