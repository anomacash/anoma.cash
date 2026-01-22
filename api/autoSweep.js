// =====================================================
// /api/autoSweep.js 
// =====================================================

import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  VersionedTransaction
} from "@solana/web3.js";

import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  createBurnInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

import nacl from "tweetnacl";
import bs58 from "bs58";
import fetch from "node-fetch";
import { logTransaction } from "./transactions.js";
import { closeAccount } from "@solana/spl-token";

// -----------------------------------------------------
// ENV & MAIN WALLET
// -----------------------------------------------------
const RPC = process.env.SOLANA_RPC;
const MAIN_WALLET_PUBLIC = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);
const MAIN_WALLET_PRIVATE = process.env.MAIN_WALLET_PRIVATE_KEY;
const ACASH_MINT = process.env.ACASH_MINT;

const SOL_MINT = "So11111111111111111111111111111111111111112";
const ACASH_BURN_USD = 0.5;

const mainWallet = Keypair.fromSecretKey(
  bs58.decode(MAIN_WALLET_PRIVATE.trim())
);

export { mainWallet };

const BURN_RATE = 0.30;

// -----------------------------------------------------
// HELPERS
// -----------------------------------------------------
async function getTokenProgramId(connection, mintPK) {
  const mintInfo = await connection.getAccountInfo(mintPK);
  if (!mintInfo) throw new Error("Mint not found");

  return mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
}

// -----------------------------------------------------
// ACASH BURN
// -----------------------------------------------------
async function burnFromMain(amount) {
  try {
    if (amount <= 0) return;

    const connection = new Connection(RPC, "processed");
    const mint = new PublicKey(ACASH_MINT);

    const mainBal = await connection.getBalance(mainWallet.publicKey);
    if (mainBal < 0.005 * 1e9) {
      console.error("Main wallet SOL too low — skipping burn.");
      return;
    }

    const tokenProgramId = await getTokenProgramId(connection, mint);

    const mainATA = await getAssociatedTokenAddress(
      mint,
      mainWallet.publicKey,
      false,
      tokenProgramId
    );

    const burnTx = new Transaction().add(
      createBurnInstruction(
        mainATA,
        mint,
        mainWallet.publicKey,
        amount,
        [],
        tokenProgramId
      )
    );

    await sendAndConfirmTransaction(connection, burnTx, [mainWallet]);
    console.log("ACASH burned:", amount / 1e6);

  } catch (err) {
    console.error("ACASH BURN FAILED:", err.message);
  }
}

  // -----------------------------------------------------
  // SWEEP ACASH
  // -----------------------------------------------------
  export async function sweepACASH(fromPub, fromPrivArray, amount, uid) {
    try {
      const connection = new Connection(RPC, "processed");
      const userWallet = Keypair.fromSecretKey(Uint8Array.from(fromPrivArray));
      const fromAddress = new PublicKey(fromPub);
      const mint = new PublicKey(ACASH_MINT);
  
      const tokenProgramId = await getTokenProgramId(connection, mint);
  
      const fromATA = await getAssociatedTokenAddress(
        mint,
        fromAddress,
        false,
        tokenProgramId
      );
  
      const mainATA = await getAssociatedTokenAddress(
        mint,
        mainWallet.publicKey,
        false,
        tokenProgramId
      );
  
      const tx = new Transaction();
      tx.feePayer = mainWallet.publicKey;
  
      if (!(await connection.getAccountInfo(mainATA))) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            mainWallet.publicKey,
            mainATA,
            mainWallet.publicKey,
            mint,
            tokenProgramId
          )
        );
      }
  
      tx.add(
        createTransferInstruction(
          fromATA,
          mainATA,
          fromAddress,
          amount,
          [],
          tokenProgramId
        )
      );
  
      const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        [mainWallet, userWallet]
      );
  
      await logTransaction(uid, sig, "ACASH", "deposit", amount / 1e6);
      await burnFromMain(Math.floor(amount * BURN_RATE));
  
      return { ok: true };
  
    } catch (err) {
      console.error("ACASH SWEEP ERROR:", err.message);
      return { ok: false };
    }
  }
  
  // -----------------------------------------------------
  // SOL SWEEP — SAFE VERSION (NON-BLOCKING, NO EXPIRY)
  // -----------------------------------------------------
  export async function forwardSOL(fromPub, fromPriv, uid) {
    try {
      const connection = new Connection(RPC, "confirmed");
      const fromKey = new PublicKey(fromPub);
  
      const secretKey =
        typeof fromPriv === "string"
          ? bs58.decode(fromPriv.trim())
          : Uint8Array.from(fromPriv);
  
      const wallet = Keypair.fromSecretKey(secretKey);
  
      const realBal = await connection.getBalance(fromKey);
  
      if (realBal < 10_000) {
        return { ok: false, error: "dust balance" };
      }
  
      // ---------------------------------------------
      // 1) Build a dummy message to estimate fee
      // ---------------------------------------------
      const { blockhash } =
        await connection.getLatestBlockhash();
  
      const message = new Transaction({
        feePayer: fromKey,
        recentBlockhash: blockhash
      }).add(
        SystemProgram.transfer({
          fromPubkey: fromKey,
          toPubkey: MAIN_WALLET_PUBLIC,
          lamports: realBal // temp value for fee calc
        })
      ).compileMessage();
  
      // ---------------------------------------------
      // 2) Modern fee estimation
      // ---------------------------------------------
      const feeResult =
        await connection.getFeeForMessage(message);
  
      const estimatedFee = feeResult.value || 5000;
  
      const sendAmount = realBal - estimatedFee;
  
      if (sendAmount <= 0) {
        return { ok: false, error: "not enough for fee" };
      }
  
      // ---------------------------------------------
      // 3) REAL TRANSACTION (SEND ONLY — NO CONFIRM WAIT)
      // ---------------------------------------------
      const tx = new Transaction({
        feePayer: fromKey,
        recentBlockhash: blockhash
      }).add(
        SystemProgram.transfer({
          fromPubkey: fromKey,
          toPubkey: MAIN_WALLET_PUBLIC,
          lamports: sendAmount
        })
      );
  
      const sig = await connection.sendTransaction(
        tx,
        [wallet],
        {
          skipPreflight: false,
          maxRetries: 3
        }
      );
  
      // Log tx submission only (confirmation handled elsewhere)
      await logTransaction(uid, sig, "SOL", "deposit", sendAmount / 1e9);
  
      return { ok: true, signature: sig };
  
    } catch (err) {
      console.error("SOL SWEEP ERROR:", err.message);
      return { ok: false, error: err.message };
    }
  }

// -----------------------------------------------------
// BUY & BURN ACASH
// -----------------------------------------------------
export async function buyAndBurnACASHFromFee(solUsdPrice) {
  try {
    if (!solUsdPrice || solUsdPrice <= 0) return;

    const connection = new Connection(RPC, "confirmed");
    const mintPK = new PublicKey(ACASH_MINT);

    const solAmount = ACASH_BURN_USD / solUsdPrice;
    const lamports = Math.floor(solAmount * 1e9);

    if (lamports < 10_000) return;

    const tokenProgramId = await getTokenProgramId(connection, mintPK);

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

    const quote = await fetch(
      `https://lite-api.jup.ag/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${ACASH_MINT}&amount=${lamports}&slippageBps=100`
    ).then(r => r.json());

    if (!quote?.routePlan?.length) return;

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

    const tx = VersionedTransaction.deserialize(
      Buffer.from(swap.swapTransaction, "base64")
    );

    tx.sign([mainWallet]);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 2
    });

    await connection.confirmTransaction(sig, "confirmed");

    const bal = await connection.getTokenAccountBalance(mainATA);
    const amount = BigInt(bal.value.amount);

    if (amount > 0n) {
      await burnFromMain(Number(amount));
    }

  } catch (err) {
    console.error("BUY & BURN FAILED:", err.message);
  }
}
