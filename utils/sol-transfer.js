// /utils/sol-transfer.js

import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

export async function sendSol({ to, amount, rpc, fromPrivateKey }) {
  const connection = new Connection(rpc, "confirmed");

  const sender = Keypair.fromSecretKey(bs58.decode(fromPrivateKey));
  const receiver = new PublicKey(to);

  const lamports = Math.floor(amount * 1e9);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: receiver,
      lamports,
    })
  );

  const latest = await connection.getLatestBlockhash();
  tx.recentBlockhash = latest.blockhash;
  tx.feePayer = sender.publicKey;

  const signature = await connection.sendTransaction(tx, [sender]);
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}
