// /api/new-address.js

import fs from "fs";
import path from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import fetch from "node-fetch";

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  VersionedTransaction
} from "@solana/web3.js";

import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

/* -------------------------------------------------
   ENV
------------------------------------------------- */
const RPC = process.env.SOLANA_RPC;
const MAIN_WALLET_PRIVATE = process.env.MAIN_WALLET_PRIVATE_KEY;

const mainWallet = Keypair.fromSecretKey(
  bs58.decode(MAIN_WALLET_PRIVATE.trim())
);

/* -------------------------------------------------
   LOCAL STORAGE
------------------------------------------------- */
const USERS_PATH = path.resolve("./users.json");

function readUsers() {
  if (!fs.existsSync(USERS_PATH)) {
    fs.writeFileSync(USERS_PATH, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

/* =================================================
   HANDLER
================================================= */
export default async function handler(req, res) {
  try {
    const { uid, mode, count, mint } = req.query;

    /* -------------------------------------------------
       MODE: TOKEN METADATA 
    ------------------------------------------------- */
    if (mode === "tokenMetadata") {
      try {
        if (!mint) return res.json({ ok: false, reason: "no mint" });
        new PublicKey(mint);

        const r = await fetch(
          `https://data.solanatracker.io/tokens/${mint}`,
          {
            headers: {
              "x-api-key": process.env.SOLANATRACKER_API_KEY
            }
          }
        );

        const json = await r.json();
        const token = json?.token;

        if (!token) {
          return res.json({ ok: false, reason: "no token in response" });
        }

        return res.json({
          ok: true,
          symbol: token.symbol,
          name: token.name,
          image: token.image,
          decimals: token.decimals
        });

      } catch (err) {
        console.error("TOKEN METADATA ERROR:", err);
        return res.json({ ok: false });
      }
    }

    /* -------------------------------------------------
       UID CHECK
    ------------------------------------------------- */
    if (!uid) {
      return res.status(400).json({ ok: false, error: "Missing uid" });
    }

    const users = readUsers();
    const user = users[uid];

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    
    /* -------------------------------------------------
       MODE: BUNDLE BUY (SINGLE RECEIVER)
    ------------------------------------------------- */
    if (mode === "bundleBuy") {
      const { mint, receiver } = req.body;

      if (!mint || !receiver) {
        return res.status(400).json({
          ok: false,
          error: "Missing mint or receiver"
        });
      }

      let receiverPK;
      try {
        receiverPK = new PublicKey(receiver);
      } catch {
        return res.status(400).json({
          ok: false,
          error: "Invalid receiver address"
        });
      }

      const userSolBalance = Number(user.solBalance || 0);
      const RENT_BUFFER_SOL = 0.01;

      if (userSolBalance <= RENT_BUFFER_SOL) {
        return res.status(400).json({
          ok: false,
          error: "Insufficient SOL after rent buffer"
        });
      }

      const spendableSol = userSolBalance - RENT_BUFFER_SOL;
      const lamportsToSpend = Math.floor(spendableSol * 1e9);

      const connection = new Connection(RPC, "confirmed");
      const mintPK = new PublicKey(mint);

      const mintInfo = await connection.getAccountInfo(mintPK);
      if (!mintInfo) {
        return res.status(400).json({
          ok: false,
          error: "Mint account not found"
        });
      }

      const tokenProgramId = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      /* -------- DEBIT USER SOL (SAFE) -------- */
      users[uid].solBalance = userSolBalance - spendableSol;
      writeUsers(users);

      try {
        /* -------- ENSURE MAIN ATA -------- */
        const mainATA = await getAssociatedTokenAddress(
          mintPK,
          mainWallet.publicKey,
          false,
          tokenProgramId
        );

        if (!(await connection.getAccountInfo(mainATA))) {
          const ataTx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              mainWallet.publicKey,
              mainATA,
              mainWallet.publicKey,
              mintPK,
              tokenProgramId
            )
          );
          await sendAndConfirmTransaction(connection, ataTx, [mainWallet]);
        }

        /* -------- JUPITER QUOTE -------- */
        const quote = await fetch(
          `https://lite-api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mint}&amount=${lamportsToSpend}&slippageBps=100`
        ).then(r => r.json());

        if (!quote?.routePlan?.length) {
          throw new Error("No Jupiter route available");
        }

        /* -------- JUPITER SWAP -------- */
        const swap = await fetch(
          "https://lite-api.jup.ag/swap/v1/swap",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quoteResponse: quote,
              userPublicKey: mainWallet.publicKey.toBase58(),
              dynamicComputeUnitLimit: true,
              dynamicSlippage: true
            })
          }
        ).then(r => r.json());

        const swapTx = VersionedTransaction.deserialize(
          Buffer.from(swap.swapTransaction, "base64")
        );

        swapTx.sign([mainWallet]);

        const sig = await connection.sendRawTransaction(
          swapTx.serialize(),
          { skipPreflight: true, maxRetries: 2 }
        );

        await connection.confirmTransaction(sig, "confirmed");

        /* -------- SEND TOKENS TO RECEIVER -------- */
        const tokenBal = await connection.getTokenAccountBalance(mainATA);
        const totalTokens = BigInt(tokenBal?.value?.amount || 0n);

        const receiverATA = await getAssociatedTokenAddress(
          mintPK,
          receiverPK,
          false,
          tokenProgramId
        );

        const tx = new Transaction();

        if (!(await connection.getAccountInfo(receiverATA))) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              mainWallet.publicKey,
              receiverATA,
              receiverPK,
              mintPK,
              tokenProgramId
            )
          );
        }

        tx.add(
          createTransferInstruction(
            mainATA,
            receiverATA,
            mainWallet.publicKey,
            Number(totalTokens),
            [],
            tokenProgramId
          )
        );

        await sendAndConfirmTransaction(connection, tx, [mainWallet]);

        return res.json({
          ok: true,
          spentSOL: spendableSol,
          receiver
        });

      } catch (err) {
        // 🔁 rollback
        users[uid].solBalance = userSolBalance;
        writeUsers(users);

        console.error("SWAP BUY FAILED:", err);
        return res.status(500).json({
          ok: false,
          error: err.message
        });
      }
    }

    /* -------------------------------------------------
       NEW SOL DEPOSIT ADDRESS
    ------------------------------------------------- */
    const key = nacl.sign.keyPair();
    const pub = bs58.encode(key.publicKey);
    const priv = bs58.encode(key.secretKey);

    users[uid] = {
      ...user,
      solDepositAddress: pub,
      solDepositPrivate: priv
    };

    writeUsers(users);

    return res.json({
      ok: true,
      solDepositAddress: pub
    });

  } catch (err) {
    console.error("NEW ADDRESS ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
