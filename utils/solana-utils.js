// /utils/solana-utils.js
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";

import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction
} from "@solana/spl-token";

import bs58 from "bs58";

const RPC = process.env.SOLANA_RPC || process.env.SOLANA_RPC_URL;
const ACASH_MINT = process.env.ACASH_MINT;

/* -----------------------------------------------------------
   LOAD MAIN WALLET (BASE58)
----------------------------------------------------------- */
export function loadMainWallet() {
  const key = process.env.MAIN_WALLET_PRIVATE_KEY;
  if (!key) throw new Error("MAIN_WALLET_PRIVATE_KEY missing");

  const secretKey = bs58.decode(key);
  return Keypair.fromSecretKey(secretKey);
}

/* -----------------------------------------------------------
   GLOBAL CONNECTION
----------------------------------------------------------- */
export function getConnection() {
  return new Connection(RPC, "confirmed");
}

/* -----------------------------------------------------------
   SEND SOL
----------------------------------------------------------- */
export async function sendSOL(toAddress, amountSOL) {
  const connection = getConnection();
  const wallet = loadMainWallet();

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports: Math.floor(amountSOL * 1e9)
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
  return sig;
}

/* -----------------------------------------------------------
   SEND ACASH SPL TOKENS
----------------------------------------------------------- */
export async function sendSPL(toAddress, amountRaw) {
  const connection = getConnection();
  const wallet = loadMainWallet();

  const mintPk = new PublicKey(ACASH_MINT);
  const destPk = new PublicKey(toAddress);

  const sourceATA = await getAssociatedTokenAddress(mintPk, wallet.publicKey);
  const destATA = await getAssociatedTokenAddress(mintPk, destPk);

  const tx = new Transaction();

  // Create ATA for receiver if missing
  try {
    await getAccount(connection, destATA);
  } catch (e) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destATA,
        destPk,
        mintPk
      )
    );
  }

  // Transfer SPL ACASH
  tx.add(
    createTransferInstruction(
      sourceATA,
      destATA,
      wallet.publicKey,
      BigInt(amountRaw)
    )
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
  return sig;
}

/* -----------------------------------------------------------
   GET RAW TOKEN BALANCE (for cron)
----------------------------------------------------------- */
export async function getRawTokenBalance(pubkey) {
  const connection = getConnection();
  const mint = new PublicKey(ACASH_MINT);
  const userPk = new PublicKey(pubkey);
  const ata = await getAssociatedTokenAddress(mint, userPk);

  try {
    const bal = await connection.getTokenAccountBalance(ata);
    return {
      raw: BigInt(bal.value.amount),
      ui: Number(bal.value.uiAmount)
    };
  } catch {
    return { raw: BigInt(0), ui: 0 };
  }
}
